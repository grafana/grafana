package router

import (
	"context"
	"fmt"
	"net/http"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// fetch implements [sourceFetcher]: one discovery request to discoveryHost.
func (st *singleTenantFallback) fetch(ctx context.Context) ([]Backend, int, error) {
	if st.discoveryHost == nil {
		return nil, 0, nil
	}
	client := &http.Client{Transport: st.transport, Timeout: singleTenantLookupTimeout}

	groups, err := discoverGroupResources(ctx, client, st.discoveryHost.String())
	if err != nil {
		return nil, 0, err
	}

	backends := make([]Backend, 0, len(groups))
	for _, discovered := range groups {
		key, err := discoveredGroupKey(discovered)
		if err != nil {
			return nil, 0, fmt.Errorf("fingerprinting single-tenant discovery: %w", err)
		}
		backends = append(backends, &fallbackBackend{
			group:     discovered.group,
			discovery: discovered.discovery,
			key:       "st:" + key,
			st:        st,
		})
	}
	return backends, 0, nil
}

var (
	_ Backend               = (*fallbackBackend)(nil)
	_ CallerScopedDiscovery = (*fallbackBackend)(nil)
)

type fallbackBackend struct {
	group     v1.APIGroup
	discovery *apidiscoveryv2.APIGroupDiscovery
	key       string
	st        http.Handler
}

// Discovery implements [DiscoveryProvider] with the resources from the last poll.
func (f *fallbackBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if f.discovery == nil {
		return apidiscoveryv2.APIGroupDiscovery{}, false
	}
	return *f.discovery, true
}

// Group implements [Backend].
func (f *fallbackBackend) Group() v1.APIGroup {
	return f.group
}

// Source implements [Backend].
func (f *fallbackBackend) Source() string { return sourceSingleTenant }

// Key implements [Backend].
func (f *fallbackBackend) Key() string {
	return f.key
}

// Load implements [Backend].
func (f *fallbackBackend) Load(context.Context) (http.Handler, error) {
	return f.st, nil
}

// CallerScopedDiscovery implements [CallerScopedDiscovery]: the discovery
// host's view of the group is only the default for callers without a stack.
func (f *fallbackBackend) CallerScopedDiscovery() {}
