package provider

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	kindv1alpha1 "github.com/demo/manifest/pkg/generated/kind/v1alpha1"
)

// The version every namespaced group serves.
const namespacedVersion = "v1"

// manifestsPage is the response of the _manifests route, as the Grafana router reads it.
type manifestsPage struct {
	Manifests []*app.ManifestData `json:"manifests"`
	Continue  string              `json:"continue"`
}

// manifestsHandler serves the _manifests route: one manifest per namespace and
// apiGroup of the Kind objects, for the group
// <apiGroup>.<namespace>.<owner group>, with a kind for each Kind object.
type manifestsHandler struct {
	kinds      *kindv1alpha1.KindClient
	ownerGroup string
}

func (h *manifestsHandler) serve(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	limit, offset, err := pageParams(req)
	if err != nil {
		return writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	// List as the plugin itself, across every namespace. The route is called
	// by the router's service identity, so passing ctx on would exchange the
	// router's token for one on its behalf, which the local token exchange
	// refuses.
	listCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	list, err := h.kinds.ListAll(listCtx, resource.NamespaceAll, resource.ListOptions{})
	if err != nil {
		return writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	manifests := h.buildManifests(list.Items)
	page := manifestsPage{Manifests: []*app.ManifestData{}}
	if offset < len(manifests) {
		end := min(offset+limit, len(manifests))
		page.Manifests = manifests[offset:end]
		if end < len(manifests) {
			page.Continue = strconv.Itoa(end)
		}
	}
	return writeJSON(w, http.StatusOK, page)
}

// buildManifests groups the Kind objects by namespace and apiGroup, sorted by group.
func (h *manifestsHandler) buildManifests(items []kindv1alpha1.Kind) []*app.ManifestData {
	byGroup := map[string]*app.ManifestData{}
	for _, item := range items {
		group := fmt.Sprintf("%s.%s.%s", item.Spec.ApiGroup, item.Namespace, h.ownerGroup)
		manifest, ok := byGroup[group]
		if !ok {
			manifest = &app.ManifestData{
				AppName:          item.Spec.ApiGroup,
				AppDisplayName:   item.Spec.ApiGroup,
				Group:            group,
				PreferredVersion: namespacedVersion,
				Versions:         []app.ManifestVersion{{Name: namespacedVersion, Served: true}},
			}
			byGroup[group] = manifest
		}
		version := &manifest.Versions[0]
		if slices.ContainsFunc(version.Kinds, func(k app.ManifestVersionKind) bool { return k.Kind == item.Spec.Name }) {
			// Two Kind objects declare the same kind; the first wins.
			continue
		}
		version.Kinds = append(version.Kinds, declaredKind(item.Spec.Name))
	}

	manifests := make([]*app.ManifestData, 0, len(byGroup))
	for _, manifest := range byGroup {
		slices.SortFunc(manifest.Versions[0].Kinds, func(a, b app.ManifestVersionKind) int { return cmp.Compare(a.Kind, b.Kind) })
		manifests = append(manifests, manifest)
	}
	slices.SortFunc(manifests, func(a, b *app.ManifestData) int { return cmp.Compare(a.Group, b.Group) })
	return manifests
}

// declaredKind is the kind a Kind object declares: namespaced, not in folders,
// with a spec of a title and a description.
func declaredKind(name string) app.ManifestVersionKind {
	folderScoped := false
	schema, err := app.VersionSchemaFromMap(map[string]any{
		name: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"spec": map[string]any{"$ref": "#/components/schemas/spec"},
			},
			"required": []any{"spec"},
		},
		"spec": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"title":       map[string]any{"type": "string"},
				"description": map[string]any{"type": "string"},
			},
		},
	}, name)
	if err != nil {
		// The schema is fixed, so this is a programming error.
		panic(err)
	}
	return app.ManifestVersionKind{
		Kind:         name,
		Plural:       strings.ToLower(name) + "s",
		Scope:        string(resource.NamespacedScope),
		FolderScoped: &folderScoped,
		Schema:       schema,
	}
}

func pageParams(req *app.CustomRouteRequest) (limit, offset int, err error) {
	limit = 100
	query := req.URL.Query()
	if v := query.Get("limit"); v != "" {
		if limit, err = strconv.Atoi(v); err != nil || limit <= 0 {
			return 0, 0, fmt.Errorf("invalid limit %q", v)
		}
	}
	if v := query.Get("continue"); v != "" {
		if offset, err = strconv.Atoi(v); err != nil || offset < 0 {
			return 0, 0, fmt.Errorf("invalid continue %q", v)
		}
	}
	return limit, offset, nil
}

func writeJSON(w app.CustomRouteResponseWriter, status int, body any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(body)
}
