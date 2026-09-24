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

// discoverGroups fetches and decodes the discovery document a target apiserver
// exposes at /apis. Aggregate targets have no RouteBackend CR to define what
// they serve, so this active discovery call is unavoidable; forward backends
// avoid it by learning their group from their CR instead.
//
// The request asks for the aggregated discovery format (aggregatedDiscoveryJSON)
// ahead of the classic one. This matters for a target running the standalone
// apiextensions apiserver (baas_apiserver): its plain, no-Accept-header /apis
// response is served from a static map only ever populated for
// apiextensions.k8s.io itself at startup, never updated as CRDs come and go --
// CRD-backed groups are only ever pushed into the aggregated-discovery manager.
// Without requesting that format explicitly, this poll would silently never see
// any CRD group on that target. A target that doesn't support the aggregated
// format (older or non-k8s-style servers) still negotiates down to the classic
// one, which decodeDiscoveryResponse falls back to.
func discoverGroups(ctx context.Context, client *http.Client, baseURL string) ([]metav1.APIGroup, error) {
	// Trim a trailing slash before joining: a configured "https://host/" would
	// otherwise produce "//apis", which most servers route differently than
	// "/apis" -- silently breaking discovery for that target.
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

	// Normalize a trailing slash out of the base path, on a copy so the caller
	// keeps ownership of base (aggregateTarget.base is shared by every group on
	// that target). ProxyRequest.SetURL's joiner happens to collapse "/" + "/x"
	// today, so this is belt-and-braces rather than a live bug -- but it makes
	// the "base path has no trailing slash" invariant local and explicit here
	// instead of resting on a stdlib join detail, the same invariant
	// discoverGroups relies on for the discovery URL.
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
