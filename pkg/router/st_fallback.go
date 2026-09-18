package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/authlib/types"
	lru "github.com/hashicorp/golang-lru/v2"
	"golang.org/x/sync/singleflight"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// LoaderWithSingleTenantFallback supplies the standalone router's handler for unmatched requests.
type LoaderWithSingleTenantFallback interface {
	SingleTenantFallback() http.Handler
}

const (
	// Bound stale routing after a rename, move, or deletion; cache hits do not extend this TTL.
	singleTenantCacheTTL = 5 * time.Minute
	// Retry unknown stacks sooner so newly created stacks can become reachable.
	singleTenantNotFoundTTL   = 30 * time.Second
	singleTenantLookupTimeout = 5 * time.Second
)

type singleTenantHost struct {
	host      *url.URL
	expiresAt time.Time
}

// singleTenantFallback forwards requests without a matching multi-tenant route to
// the single-tenant stack identified by the request namespace. Although this is
// not an ideal routing path, it gives clients a single entry point that will
// resolve ALL /apis requests regardless where they live (MT, or ST)
type singleTenantFallback struct {
	cache         *lru.Cache[int64, singleTenantHost]
	lookups       singleflight.Group
	resolveHost   func(context.Context, int64) (string, error)
	fallback      http.Handler
	discoveryHost *url.URL
	transport     *http.Transport
}

type singleTenantFallbackOptions struct {
	cacheSize     int
	resolveHost   func(context.Context, int64) (string, error)
	discoveryHost *url.URL
	transport     *http.Transport
}

func newSingleTenantFallback(opts singleTenantFallbackOptions) (*singleTenantFallback, error) {
	cache, err := lru.New[int64, singleTenantHost](opts.cacheSize)
	if err != nil {
		return nil, err
	}

	if opts.resolveHost == nil {
		return nil, fmt.Errorf("single-tenant host resolver is required")
	}
	if u := opts.discoveryHost; u != nil && ((u.Scheme != "http" && u.Scheme != "https") || u.Host == "") {
		return nil, fmt.Errorf("single-tenant discovery URL must be an absolute HTTP(S) URL")
	}

	if opts.transport == nil {
		opts.transport = http.DefaultTransport.(*http.Transport).Clone()
	}

	return &singleTenantFallback{
		fallback:      http.NotFoundHandler(),
		cache:         cache,
		resolveHost:   opts.resolveHost,
		discoveryHost: opts.discoveryHost,
		transport:     opts.transport,
	}, nil
}

func (st *singleTenantFallback) cachedHost(stackID int64) (*url.URL, bool) {
	entry, ok := st.cache.Get(stackID)
	return entry.host, ok && time.Now().Before(entry.expiresAt)
}

func (st *singleTenantFallback) hostForNamespace(ctx context.Context, namespace string) (*url.URL, error) {
	info, err := types.ParseNamespace(namespace)
	if err != nil || info.StackID < 1 {
		return nil, nil
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if host, ok := st.cachedHost(info.StackID); ok {
		return host, nil
	}

	result := st.lookups.DoChan(namespace, func() (any, error) {
		return st.lookupHost(ctx, info.StackID)
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-result:
		if result.Err != nil {
			return nil, result.Err
		}
		return result.Val.(*url.URL), nil
	}
}

func (st *singleTenantFallback) lookupHost(ctx context.Context, stackID int64) (*url.URL, error) {
	if host, ok := st.cachedHost(stackID); ok {
		return host, nil
	}
	// One caller cancelling must not cancel the lookup shared by other callers.
	lookupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), singleTenantLookupTimeout)
	defer cancel()
	host, err := st.resolveHost(lookupCtx, stackID)
	if err != nil {
		return nil, err
	}
	var target *url.URL
	if host != "" {
		target, err = url.Parse(host)
		if err != nil {
			return nil, err
		}
		if (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" {
			return nil, fmt.Errorf("invalid stack host URL: %q", host)
		}
	}
	ttl := singleTenantCacheTTL
	if target == nil {
		ttl = singleTenantNotFoundTTL
	}
	st.cache.Add(stackID, singleTenantHost{host: target, expiresAt: time.Now().Add(ttl)})
	return target, nil
}

func (st *singleTenantFallback) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if (req.URL.Path == apisPrefix || req.URL.Path == apisPrefix+"/") && st.discoveryHost != nil {
		st.forward(st.discoveryHost, w, req)
		return
	}
	parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/"), "/")
	if len(parts) > 1 && parts[1] != "" {
		switch parts[0] {
		case "apis":
			if len(parts) > 4 && parts[2] != "" && parts[3] == "namespaces" && parts[4] != "" {
				host, err := st.hostForNamespace(req.Context(), parts[4])
				if err != nil {
					http.Error(w, "stack lookup unavailable", http.StatusServiceUnavailable)
					return
				}
				if host == nil { // unknown host
					st.fallback.ServeHTTP(w, req)
					return
				}
				st.forward(host, w, req)
				return
			}
			fallthrough // same behavior as openapi
		case "openapi":
			if st.discoveryHost != nil {
				st.forward(st.discoveryHost, w, req)
				return
			}
		}
	}

	st.fallback.ServeHTTP(w, req)
}

func (st *singleTenantFallback) forward(host *url.URL, w http.ResponseWriter, req *http.Request) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(host)
		},
		Transport:      st.transport,
		ModifyResponse: rejectBackendRedirects,
	}
	proxy.ServeHTTP(w, req)
}

// Helper function called when the fallback is directly used as a loader (testing)
func (st *singleTenantFallback) SingleTenantFallback() http.Handler {
	return st
}

// Load implements [RoutesLoader].
func (st *singleTenantFallback) Load(ctx context.Context) ([]Backend, error) {
	if st.discoveryHost == nil {
		return nil, nil
	}
	client := &http.Client{Transport: st.transport, Timeout: singleTenantLookupTimeout}

	groups, err := discoverGroups(ctx, client, st.discoveryHost.String())
	if err != nil {
		return nil, err
	}

	backends := make([]Backend, 0, len(groups))
	for _, group := range groups {
		groupJSON, err := json.Marshal(group)
		if err != nil {
			return nil, fmt.Errorf("fingerprinting single-tenant discovery: %w", err)
		}
		backends = append(backends, &fallbackBackend{
			group: group,
			key:   hashHex(string(groupJSON)),
			st:    st,
		})
	}
	return backends, nil
}

func (st *singleTenantFallback) Notify(context.Context) (<-chan struct{}, error) {
	return make(<-chan struct{}), nil
}

var (
	_ RoutesLoader = (*singleTenantFallback)(nil)
	_ Backend      = (*fallbackBackend)(nil)
)

type fallbackBackend struct {
	group v1.APIGroup
	key   string
	st    http.Handler
}

// Group implements [Backend].
func (f *fallbackBackend) Group() v1.APIGroup {
	return f.group
}

// Key implements [Backend].
func (f *fallbackBackend) Key() string {
	return f.key
}

// Load implements [Backend].
func (f *fallbackBackend) Load(context.Context) (http.Handler, error) {
	return f.st, nil
}
