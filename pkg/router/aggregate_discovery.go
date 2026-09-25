package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// discoverGroups fetches a target's /apis discovery document. It asks for the
// aggregated format first: the standalone apiextensions apiserver lists
// CRD-backed groups only there, never in its plain /apis response. Servers
// without it fall back to the classic APIGroupList.
func discoverGroups(ctx context.Context, client *http.Client, baseURL string) ([]metav1.APIGroup, error) {
	// A trailing slash would produce "//apis", which servers route differently.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(baseURL, "/")+apisPrefix, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building discovery request: %w", err)
	}
	req.Header.Set("Accept", aggregatedDiscoveryJSON+", application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: discovery request to %s failed: %w", baseURL, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: discovery request to %s returned status %d", baseURL, resp.StatusCode)
	}

	return decodeDiscoveryResponse(resp, baseURL)
}

// decodeDiscoveryResponse decodes an /apis response as aggregated discovery
// when the server actually served that format (its Content-Type carries the
// apidiscovery.k8s.io group), and as the classic APIGroupList otherwise -- a
// target may ignore the requested Accept header entirely and always answer
// with the classic format.
func decodeDiscoveryResponse(resp *http.Response, baseURL string) ([]metav1.APIGroup, error) {
	if strings.Contains(resp.Header.Get("Content-Type"), "apidiscovery.k8s.io") {
		var list apidiscoveryv2.APIGroupDiscoveryList
		if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
			return nil, fmt.Errorf("router: decoding APIGroupDiscoveryList from %s: %w", baseURL, err)
		}
		return apiGroupDiscoveryListToGroups(list), nil
	}

	var list metav1.APIGroupList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("router: decoding APIGroupList from %s: %w", baseURL, err)
	}
	return list.Groups, nil
}

// apiGroupDiscoveryListToGroups converts the aggregated discovery document into
// the classic APIGroup shape the rest of this package already expects
// (matchesAnyPattern, newAggregateBackend). Versions keep the priority order
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

// aggregateBackend is a Backend for one group discovered on a fixed
// aggregate target (baas_apiserver or cloud_app_platform_apiserver). Its
// Load proxies to the target's own host, same shape as forwardBackend --
// the difference is entirely in how Group/Key are learned (discovery poll
// vs a RouteBackend CR), not in how requests are served.
type aggregateBackend struct {
	targetName string
	group      metav1.APIGroup
	key        string
	proxy      *httputil.ReverseProxy
}

var _ Backend = &aggregateBackend{}

func newAggregateBackend(targetName string, group metav1.APIGroup, base *url.URL, transport http.RoundTripper) (Backend, error) {
	body, err := json.Marshal(group)
	if err != nil {
		return nil, fmt.Errorf("router: fingerprinting discovered group %q: %w", group.Name, err)
	}
	sum := sha256.Sum256(body)
	key := "aggregate:" + targetName + ":" + hex.EncodeToString(sum[:])[:16]

	// Copy base, since every group on the target shares it, and drop any
	// trailing slash.
	target := *base
	target.Path = strings.TrimRight(target.Path, "/")

	return &aggregateBackend{
		targetName: targetName,
		group:      group,
		key:        key,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(&target) },
			Transport:      newBackendTransport(transport),
			ModifyResponse: rejectBackendRedirects,
		},
	}, nil
}

func (b *aggregateBackend) Group() metav1.APIGroup { return b.group }
func (b *aggregateBackend) Key() string            { return b.key }
func (b *aggregateBackend) Load(context.Context) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		b.proxy.ServeHTTP(w, req)
	}), nil
}
