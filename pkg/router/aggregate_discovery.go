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

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// discoverGroups fetches and decodes the APIGroupList a target apiserver
// exposes at /apis. This is the one place this router actively dials an
// upstream to learn what it serves -- see AGENTS.md's discovery section for
// why this is necessary here but not for forward backends.
func discoverGroups(ctx context.Context, client *http.Client, baseURL string) ([]metav1.APIGroup, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+apisPrefix, nil)
	if err != nil {
		return nil, fmt.Errorf("router: building discovery request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("router: discovery request to %s failed: %w", baseURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("router: discovery request to %s returned status %d", baseURL, resp.StatusCode)
	}

	var list metav1.APIGroupList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("router: decoding APIGroupList from %s: %w", baseURL, err)
	}
	return list.Groups, nil
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

	return &aggregateBackend{
		targetName: targetName,
		group:      group,
		key:        key,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(base) },
			Transport:      transport,
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
