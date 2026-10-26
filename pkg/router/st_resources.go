package router

import (
	"context"
	"net/http"
	"slices"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// singleTenantResourcesGroup is split between its multi-tenant backend and
// the single-tenant stacks; see [singleTenantResourcesHandler.handlerFor].
const singleTenantResourcesGroup = "dashboard.grafana.app"

// singleTenantOnlyResources of singleTenantResourcesGroup are served by the
// single-tenant stacks in every version, whatever the request.
var singleTenantOnlyResources = []string{"librarypanels", "snapshots"}

// resourceFromPath returns the resource that path addresses, namespaced or
// across namespaces, including its items and subresources. Discovery and
// OpenAPI address no resource.
func resourceFromPath(path string) (string, bool) {
	var buf [6]string
	parts := pathParts(path, buf[:0])
	if len(parts) < 4 || parts[0] != "apis" {
		return "", false
	}
	resource := parts[3]
	if resource == "namespaces" {
		if len(parts) < 6 || parts[4] == "" {
			return "", false
		}
		resource = parts[5]
	}
	return resource, resource != ""
}

var (
	_ Backend              = (*singleTenantResourcesBackend)(nil)
	_ DiscoveryProvider    = (*singleTenantResourcesBackend)(nil)
	_ ManifestProvider     = (*singleTenantResourcesBackend)(nil)
	_ PluginStatusProvider = (*singleTenantResourcesBackend)(nil)
)

// singleTenantResourcesBackend serves singleTenantResourcesGroup from its own
// backend and the ST fallback, per request. The group's discovery and OpenAPI
// come from its own backend.
// It is never wrapped around a caller-scoped (ST) backend, so it does not
// forward CallerScopedDiscovery.
type singleTenantResourcesBackend struct {
	Backend
	st http.Handler
}

func (b *singleTenantResourcesBackend) Load(ctx context.Context) (http.Handler, error) {
	next, err := b.Backend.Load(ctx)
	if err != nil {
		return nil, err
	}
	return &singleTenantResourcesHandler{next: next, st: b.st}, nil
}

// Discovery implements [DiscoveryProvider]; the embedded Backend interface
// does not promote it.
func (b *singleTenantResourcesBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if p, ok := b.Backend.(DiscoveryProvider); ok {
		return p.Discovery()
	}
	return apidiscoveryv2.APIGroupDiscovery{}, false
}

// Manifest implements [ManifestProvider]; the embedded Backend interface does
// not promote it.
func (b *singleTenantResourcesBackend) Manifest() (*app.ManifestData, bool) {
	if p, ok := b.Backend.(ManifestProvider); ok {
		return p.Manifest()
	}
	return nil, false
}

// PluginStatus implements [PluginStatusProvider]; the embedded Backend
// interface does not promote it.
func (b *singleTenantResourcesBackend) PluginStatus() (PluginStatus, bool) {
	if p, ok := b.Backend.(PluginStatusProvider); ok {
		return p.PluginStatus()
	}
	return PluginStatus{}, false
}

type singleTenantResourcesHandler struct {
	next http.Handler
	st   http.Handler
}

// handlerFor sends singleTenantOnlyResources to the stacks. Otherwise users'
// writes go to the stacks, and reads and every request from a non-user
// identity, such as an access policy, go to the multi-tenant backend.
// It lets serveThroughBreaker apply the chosen handler's breakers, so a
// failing stack never opens the group breaker of the multi-tenant backend.
func (h *singleTenantResourcesHandler) handlerFor(req *http.Request) http.Handler {
	if resource, ok := resourceFromPath(req.URL.Path); ok && slices.Contains(singleTenantOnlyResources, resource) {
		return h.st
	}
	// Read requests all go to MT
	if req.Method == http.MethodGet || req.Method == http.MethodHead {
		return h.next
	}
	// Create/Update/Delete requests from real users should use ST
	requester, _ := identity.GetRequester(req.Context())
	if requester != nil && requester.IsIdentityType(types.TypeUser) {
		return h.st
	}
	return h.next
}

func (h *singleTenantResourcesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.handlerFor(req).ServeHTTP(w, req)
}
