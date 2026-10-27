package router

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"

	"github.com/grafana/grafana-app-sdk/app"
)

// defaultSingleTenantResources are served by single-tenant stacks even though
// the rest of their group has moved to a multi-tenant backend.
const defaultSingleTenantResources = "dashboard.grafana.app/v0alpha1/librarypanels, dashboard.grafana.app/v0alpha1/snapshots"

// singleTenantResource is one version and resource of a group whose requests
// always go to the ST fallback.
type singleTenantResource struct {
	version  string
	resource string
}

// parseSingleTenantResources parses a comma-separated list of
// group/version/resource entries into the resources of each group.
func parseSingleTenantResources(raw string) (map[string][]singleTenantResource, error) {
	byGroup := map[string][]singleTenantResource{}
	for entry := range strings.SplitSeq(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.Split(entry, "/")
		if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
			return nil, fmt.Errorf("st_resources: %q is not group/version/resource", entry)
		}
		byGroup[parts[0]] = append(byGroup[parts[0]], singleTenantResource{version: parts[1], resource: parts[2]})
	}
	return byGroup, nil
}

// matchesSingleTenantResource reports whether path addresses one of resources, namespaced or
// across namespaces, including its items and subresources. Discovery and
// OpenAPI for the group never match, so they stay with the group's backend.
func matchesSingleTenantResource(resources []singleTenantResource, path string) bool {
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(parts) < 4 || parts[0] != "apis" {
		return false
	}
	resource := parts[3]
	if resource == "namespaces" {
		if len(parts) < 6 || parts[4] == "" {
			return false
		}
		resource = parts[5]
	}
	for _, r := range resources {
		if r.version == parts[2] && r.resource == resource {
			return true
		}
	}
	return false
}

var (
	_ Backend              = (*singleTenantResourcesBackend)(nil)
	_ DiscoveryProvider    = (*singleTenantResourcesBackend)(nil)
	_ ManifestProvider     = (*singleTenantResourcesBackend)(nil)
	_ PluginStatusProvider = (*singleTenantResourcesBackend)(nil)
	_ RestrictedGroup      = (*singleTenantResourcesBackend)(nil)
)

// singleTenantResourcesBackend serves a group from its own backend, except
// for resources still served by single-tenant stacks, which go to the ST
// fallback. The group's discovery and OpenAPI come from its own backend.
// It is never wrapped around a caller-scoped (ST) backend, so it does not
// forward CallerScopedDiscovery.
type singleTenantResourcesBackend struct {
	Backend
	resources []singleTenantResource
	st        http.Handler
}

func (b *singleTenantResourcesBackend) Load(ctx context.Context) (http.Handler, error) {
	next, err := b.Backend.Load(ctx)
	if err != nil {
		return nil, err
	}
	return &singleTenantResourcesHandler{next: next, st: b.st, resources: b.resources}, nil
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

// RestrictedGroup implements [RestrictedGroup]; the embedded Backend
// interface does not promote it.
func (b *singleTenantResourcesBackend) RestrictedGroup() bool {
	return restrictedBackend(b.Backend)
}

type singleTenantResourcesHandler struct {
	next      http.Handler
	st        http.Handler
	resources []singleTenantResource
}

// handlerFor lets serveThroughBreaker apply the chosen handler's breakers, so
// a failing stack never opens the group breaker of the multi-tenant backend.
func (h *singleTenantResourcesHandler) handlerFor(req *http.Request) http.Handler {
	if matchesSingleTenantResource(h.resources, req.URL.Path) {
		return h.st
	}
	return h.next
}

func (h *singleTenantResourcesHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.handlerFor(req).ServeHTTP(w, req)
}
