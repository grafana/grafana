package router

import (
	"net/http"
	"slices"

	"github.com/grafana/authlib/types"

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

// splitSingleTenantResources is the cloud loader's merge step that splits
// singleTenantResourcesGroup per request between its own backend and st. The
// group's discovery and OpenAPI still come from its own backend. A group only
// the stacks serve is left to them.
func splitSingleTenantResources(st http.Handler) mergeStep {
	return func(backends map[string]Backend) {
		b, ok := backends[singleTenantResourcesGroup]
		// A caller-scoped backend is the stacks' own, and wrappedBackend can't
		// forward that marker.
		if _, callerScoped := b.(CallerScopedDiscovery); !ok || callerScoped {
			return
		}
		backends[singleTenantResourcesGroup] = &wrappedBackend{Backend: b, wrap: func(next http.Handler) http.Handler {
			return &singleTenantResourcesHandler{next: next, st: st}
		}}
	}
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

// groupHandler implements [requestRouter]: the group is the multi-tenant
// backend's, and its breaker is the one the group reports.
func (h *singleTenantResourcesHandler) groupHandler() http.Handler {
	return h.next
}

func (h *singleTenantResourcesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.handlerFor(req).ServeHTTP(w, req)
}
