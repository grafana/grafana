package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/grafana/authlib/types"
)

// singleTenantStack is what a resolver reports for a stack; the zero value means not found.
type singleTenantStack struct {
	URL       string // where the router connects
	PublicURL string // its host is sent as the Host header, when set
	Slug      string // expected grafana-stack response header, when set
}

type singleTenantTarget struct {
	url  *url.URL
	host string
	slug string
}

type singleTenantHost struct {
	host      *singleTenantTarget
	expiresAt time.Time
}

// stackLookupCounts counts grafana.com stack lookups by result, for metrics.
type stackLookupCounts struct {
	cacheHit, resolved, notFound, throttled, failed atomic.Uint64
}

func (c *stackLookupCounts) record(target *singleTenantTarget, err error) {
	switch {
	case errors.Is(err, errStackLookupThrottled):
		c.throttled.Add(1)
	case err != nil:
		c.failed.Add(1)
	case target == nil:
		c.notFound.Add(1)
	default:
		c.resolved.Add(1)
	}
}

func (c *stackLookupCounts) byResult() map[string]uint64 {
	return map[string]uint64{
		"cache_hit": c.cacheHit.Load(), "resolved": c.resolved.Load(), "not_found": c.notFound.Load(),
		"throttled": c.throttled.Load(), "error": c.failed.Load(),
	}
}

// errStackLookupThrottled means the lookup rate limit was reached. It is never cached.
var errStackLookupThrottled = errors.New("router: stack lookup throttled")

func (st *singleTenantFallback) cachedHost(stackID int64) (*singleTenantTarget, bool) {
	entry, ok := st.cache.Get(stackID)
	return entry.host, ok && time.Now().Before(entry.expiresAt)
}

func (st *singleTenantFallback) hostForNamespace(ctx context.Context, namespace string) (*singleTenantTarget, error) {
	info, err := types.ParseNamespace(namespace)
	if err != nil || info.StackID < 1 {
		return nil, nil
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if host, ok := st.cachedHost(info.StackID); ok {
		st.lookupsBy.cacheHit.Add(1)
		return host, nil
	}

	result := st.lookups.DoChan(strconv.FormatInt(info.StackID, 10), func() (any, error) {
		return st.lookupHost(ctx, info.StackID)
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-result:
		if result.Err != nil {
			return nil, result.Err
		}
		return result.Val.(*singleTenantTarget), nil
	}
}

func (st *singleTenantFallback) lookupHost(ctx context.Context, stackID int64) (target *singleTenantTarget, err error) {
	if host, ok := st.cachedHost(stackID); ok {
		st.lookupsBy.cacheHit.Add(1)
		return host, nil
	}
	defer func() { st.lookupsBy.record(target, err) }()
	// Fail fast rather than queue: waiting would hold requests open under a flood.
	if st.lookupLimiter != nil && !st.lookupLimiter.Allow() {
		return nil, errStackLookupThrottled
	}
	// One caller cancelling must not cancel the lookup shared by other callers.
	lookupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), singleTenantLookupTimeout)
	defer cancel()
	host, err := st.resolveHost(lookupCtx, stackID)
	if err != nil {
		return nil, err
	}
	if host.URL != "" {
		u, err := url.Parse(host.URL)
		if err != nil {
			return nil, err
		}
		if (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return nil, fmt.Errorf("invalid stack host URL: %q", host.URL)
		}
		target = &singleTenantTarget{url: u, slug: host.Slug}
		// Stacks enforce their domain, redirecting any other Host to their public URL.
		if host.PublicURL != "" {
			public, err := url.Parse(host.PublicURL)
			if err != nil {
				return nil, fmt.Errorf("invalid stack public URL: %w", err)
			}
			target.host = public.Host
		}
	}
	ttl := singleTenantCacheTTL
	if target == nil {
		ttl = singleTenantNotFoundTTL
	}
	st.cache.Add(stackID, singleTenantHost{host: target, expiresAt: time.Now().Add(ttl)})
	return target, nil
}

// maxStackResponseBytes bounds a grafana.com instance response.
const maxStackResponseBytes = 1 << 20 // 1MB

// The results of this call are cached
func newGComURLResolver(gcomBaseURL string, gcomToken string) func(context.Context, int64) (singleTenantStack, error) {
	// mirroring grafana's pkg/services/gcom
	type instance struct {
		ID   int    `json:"id"`
		Slug string `json:"slug"`
		URL  string `json:"url"`
	}

	return func(ctx context.Context, stackID int64) (singleTenantStack, error) {
		url, err := url.JoinPath(gcomBaseURL, "instances", strconv.FormatInt(stackID, 10))
		if err != nil {
			return singleTenantStack{}, err
		}

		// #nosec G704 -- the base URL is operator-controlled Grafana configuration and stackID is an integer.
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return singleTenantStack{}, fmt.Errorf("creating gcom instance request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+gcomToken)
		// #nosec G704 -- req targets the operator-controlled Grafana.com API URL constructed above.
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return singleTenantStack{}, fmt.Errorf("fetching gcom instance: %w", err)
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode == http.StatusNotFound {
			return singleTenantStack{}, nil
		}
		if resp.StatusCode != http.StatusOK {
			return singleTenantStack{}, fmt.Errorf("fetching gcom instance: unexpected status code %d", resp.StatusCode)
		}

		var result instance
		if err := decodeLimitedJSON(resp.Body, maxStackResponseBytes, &result); err != nil {
			return singleTenantStack{}, fmt.Errorf("decoding gcom instance: %w", err)
		}
		return singleTenantStack{
			URL:       fmt.Sprintf("http://%s-grafana-http.%s.svc.cluster.local.:80", result.Slug, "hosted-grafana"),
			PublicURL: result.URL,
			Slug:      result.Slug,
		}, nil
	}
}
