package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"slices"
	"strings"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// discoveredGroup is one group from a target's /apis document. discovery holds
// its resources when the target served the aggregated format, and is nil for
// the classic format, which lists only versions.
type discoveredGroup struct {
	group     metav1.APIGroup
	discovery *apidiscoveryv2.APIGroupDiscovery
}

// discoverGroupResources fetches a target's /apis discovery document. It asks
// for the aggregated format first: the standalone apiextensions apiserver lists
// CRD-backed groups only there, never in its plain /apis response. Servers
// without it fall back to the classic APIGroupList. Each group keeps its
// resources when the target served the aggregated format. The reserved
// discovery group is left out.
func discoverGroupResources(ctx context.Context, client *http.Client, baseURL string) ([]discoveredGroup, error) {
	// A trailing slash would produce "//apis", which servers route differently.
	// #nosec G704 -- baseURL is operator-controlled configuration: an aggregate target's url or st_discovery_url.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(baseURL, "/")+apisPrefix, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building discovery request: %w", err)
	}
	req.Header.Set("Accept", aggregatedDiscoveryJSON+", application/json")
	// #nosec G704 -- req targets the operator-configured base URL above.
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: discovery request to %s failed: %w", baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: discovery request to %s returned status %d", baseURL, resp.StatusCode)
	}

	groups, err := decodeDiscoveryResponse(resp, baseURL)
	// A target that is itself a router always lists the discovery group,
	// which this router serves itself; drop it quietly, since it is expected.
	return slices.DeleteFunc(groups, func(g discoveredGroup) bool { return g.group.Name == discoveryGroup }), err
}

// decodeLimitedJSON decodes a JSON body of at most limit bytes into v. A
// polled source must not be able to make the router buffer without bound.
func decodeLimitedJSON(body io.Reader, limit int64, v any) error {
	data, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		return err
	}
	if int64(len(data)) > limit {
		return fmt.Errorf("response is larger than %d bytes", limit)
	}
	return json.Unmarshal(data, v)
}

// decodeDiscoveryResponse decodes an /apis response as aggregated discovery
// when the server actually served that format (its Content-Type carries the
// apidiscovery.k8s.io group), and as the classic APIGroupList otherwise -- a
// target may ignore the requested Accept header entirely and always answer
// with the classic format.
func decodeDiscoveryResponse(resp *http.Response, baseURL string) ([]discoveredGroup, error) {
	if strings.Contains(resp.Header.Get("Content-Type"), "apidiscovery.k8s.io") {
		var list apidiscoveryv2.APIGroupDiscoveryList
		if err := decodeLimitedJSON(resp.Body, int64(maxDiscoveryDocBytes), &list); err != nil {
			return nil, fmt.Errorf("router: decoding APIGroupDiscoveryList from %s: %w", baseURL, err)
		}
		groups := apiGroupDiscoveryListToGroups(list)
		discovered := make([]discoveredGroup, len(groups))
		for i := range groups {
			discovered[i] = discoveredGroup{group: groups[i], discovery: &list.Items[i]}
		}
		return discovered, nil
	}

	var list metav1.APIGroupList
	if err := decodeLimitedJSON(resp.Body, int64(maxDiscoveryDocBytes), &list); err != nil {
		return nil, fmt.Errorf("router: decoding APIGroupList from %s: %w", baseURL, err)
	}
	discovered := make([]discoveredGroup, len(list.Groups))
	for i, group := range list.Groups {
		discovered[i] = discoveredGroup{group: group}
	}
	return discovered, nil
}

// apiGroupDiscoveryListToGroups converts the aggregated discovery document into
// the classic APIGroup shape the rest of this package already expects
// (matchesAnyPattern, newDiscoveredAggregateBackend). Versions keep the priority order
// the upstream server returned them in; the first entry becomes
// PreferredVersion, matching that ordering convention.
func apiGroupDiscoveryListToGroups(list apidiscoveryv2.APIGroupDiscoveryList) []metav1.APIGroup {
	groups := make([]metav1.APIGroup, 0, len(list.Items))
	for _, item := range list.Items {
		group := metav1.APIGroup{Name: item.Name}
		for _, v := range item.Versions {
			group.Versions = append(group.Versions, metav1.GroupVersionForDiscovery{
				GroupVersion: item.Name + "/" + v.Version,
				Version:      v.Version,
			})
		}
		if len(group.Versions) > 0 {
			group.PreferredVersion = group.Versions[0]
		}
		groups = append(groups, group)
	}
	return groups
}

// aggregateBackend is a Backend for one group discovered on a configured
// aggregate target ([router.aggregate.<name>]). Its Load proxies to the
// target's own host.
type aggregateBackend struct {
	targetName string
	group      metav1.APIGroup
	discovery  *apidiscoveryv2.APIGroupDiscovery
	key        string
	proxy      *httputil.ReverseProxy
}

var (
	_ Backend           = (*aggregateBackend)(nil)
	_ DiscoveryProvider = (*aggregateBackend)(nil)
)

// newDiscoveredAggregateBackend keeps the group's resources from the poll, so
// /apis can be built without asking the target again. They are part
// of the key, so a resource change on the target republishes discovery.
func newDiscoveredAggregateBackend(targetName string, discovered discoveredGroup, base *url.URL, transport http.RoundTripper) (Backend, error) {
	group := discovered.group
	key, err := discoveredGroupKey(discovered)
	if err != nil {
		return nil, fmt.Errorf("router: fingerprinting discovered group %q: %w", group.Name, err)
	}
	key = "aggregate:" + targetName + ":" + key

	// Copy base, since every group on the target shares it, and drop any
	// trailing slash.
	target := *base
	target.Path = strings.TrimRight(target.Path, "/")

	return &aggregateBackend{
		targetName: targetName,
		group:      group,
		discovery:  discovered.discovery,
		key:        key,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { rewriteOutbound(pr, &target) },
			Transport:      newBackendTransport(transport),
			ModifyResponse: rejectBackendRedirects,
			ErrorHandler:   proxyErrorHandler,
			FlushInterval:  streamingFlushInterval,
			BufferPool:     proxyBuffers,
		},
	}, nil
}

func (b *aggregateBackend) Group() metav1.APIGroup { return b.group }
func (b *aggregateBackend) Key() string            { return b.key }
func (b *aggregateBackend) Source() string         { return aggregateSource(b.targetName) }
func (b *aggregateBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if b.discovery == nil {
		return apidiscoveryv2.APIGroupDiscovery{}, false
	}
	return *b.discovery, true
}

// discoveredGroupKey fingerprints a discovered group and its resources, so a
// change to either is a new key.
func discoveredGroupKey(d discoveredGroup) (string, error) {
	body, err := json.Marshal(struct {
		Group     metav1.APIGroup
		Discovery *apidiscoveryv2.APIGroupDiscovery
	}{d.group, d.discovery})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])[:16], nil
}
func (b *aggregateBackend) Load(context.Context) (http.Handler, error) {
	return b.proxy, nil
}
