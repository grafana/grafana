package keysroutes

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Build only hands the client to the handler; nothing here calls it.
type fakeStore struct{ resourcepb.ResourceStoreClient }

type fakeBuilder struct {
	gvs []schema.GroupVersion
}

func (b *fakeBuilder) GetGroupVersions() []schema.GroupVersion { return b.gvs }

type resourceBuilder struct {
	*fakeBuilder
	infos []utils.ResourceInfo
}

func (b *resourceBuilder) GetResourceInfos(schema.GroupVersion) []utils.ResourceInfo {
	return b.infos
}
func (b *fakeBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (b *fakeBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, builder.APIGroupOptions) error {
	return nil
}
func (b *fakeBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (b *fakeBuilder) AllowedV0Alpha1Resources() []string                  { return nil }

// Root mounts, flattened so assertions read as the endpoints do.
func paths(routes []builder.GroupVersionRoutes) map[string][]string {
	return pathsAt(routes, func(r *builder.APIRoutes) []builder.APIRouteHandler { return r.Root })
}

// Namespace mounts, which the host prefixes with .../namespaces/{namespace}/.
func namespacedPaths(routes []builder.GroupVersionRoutes) map[string][]string {
	return pathsAt(routes, func(r *builder.APIRoutes) []builder.APIRouteHandler { return r.Namespace })
}

func pathsAt(routes []builder.GroupVersionRoutes, pick func(*builder.APIRoutes) []builder.APIRouteHandler) map[string][]string {
	out := map[string][]string{}
	for _, r := range routes {
		if r.Routes == nil {
			continue
		}
		for _, h := range pick(r.Routes) {
			out[r.GroupVersion.String()] = append(out[r.GroupVersion.String()], h.Path)
		}
	}
	return out
}

func TestBuild_NothingMountedWhenOffOrUnusable(t *testing.T) {
	b := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
	}}}

	assert.Nil(t, Build(false, nil, fakeStore{}, b, nil), "disabled")
	// A server with no resource store has nothing to list keys from.
	assert.Nil(t, Build(true, nil, nil, b, nil), "no client")
}

// Which kinds get the route, against the compiled-in manifests.
func TestBuild_MountsServedNamespacedKinds(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}}
	got := paths(Build(true, nil, fakeStore{}, []builder.APIGroupBuilder{b}, nil))

	assert.Contains(t, got["dashboard.grafana.app/v1"], "dashboards/list-keys")
	assert.Contains(t, got["folder.grafana.app/v1"], "folders/list-keys")
	// A manifest describes kinds this process may not serve.
	assert.NotContains(t, got, "playlist.grafana.app/v0alpha1")
}

// One manifest shape per rule that decides whether a kind is mounted.
func TestBuild_MountingRules(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	builders := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{gv}}}

	manifest := func(served bool, kinds ...app.ManifestVersionKind) []*app.ManifestData {
		return []*app.ManifestData{{
			Group: gv.Group,
			Versions: []app.ManifestVersion{{
				Name:   gv.Version,
				Served: served,
				Kinds:  kinds,
			}},
		}}
	}
	widget := app.ManifestVersionKind{Kind: "Widget", Plural: "widgets", Scope: supportedKindScope}

	for name, tc := range map[string]struct {
		manifests []*app.ManifestData
		want      []string
	}{
		// Unlike search, there is no per-kind enrolment gate: no SearchFields here.
		"namespaced kind is mounted": {
			manifests: manifest(true, widget),
			want:      []string{"widgets/list-keys"},
		},
		"cluster-scoped kind is skipped": {
			manifests: manifest(true, widget,
				app.ManifestVersionKind{Kind: "Cluster", Plural: "clusters", Scope: "Cluster"}),
			want: []string{"widgets/list-keys"},
		},
		"unserved version is skipped": {
			manifests: manifest(false, widget),
			want:      nil,
		},
	} {
		t.Run(name, func(t *testing.T) {
			got := paths(BuildFromManifests(tc.manifests, true, nil, fakeStore{}, builders, nil))
			if tc.want == nil {
				assert.Empty(t, got)
				return
			}
			assert.Equal(t, tc.want, got[gv.String()])
		})
	}
}

// A kind reaching only one slot is served at one scope and absent at the other.
func TestBuild_MountsBothScopes(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	builders := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{gv}}}
	manifests := []*app.ManifestData{{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name:   gv.Version,
			Served: true,
			Kinds: []app.ManifestVersionKind{
				{Kind: "Widget", Plural: "widgets", Scope: supportedKindScope},
			},
		}},
	}}

	routes := BuildFromManifests(manifests, true, nil, fakeStore{}, builders, nil)

	want := map[string][]string{gv.String(): {"widgets/list-keys"}}
	assert.Equal(t, want, paths(routes), "cluster-wide mount")
	assert.Equal(t, want, namespacedPaths(routes), "namespaced mount")
}

func TestBuild_MountsBuilderAdvertisedKinds(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}

	routes := BuildFromManifests(nil, true, nil, fakeStore{}, builders, nil)

	want := map[string][]string{gv.String(): {"widgets/list-keys"}}
	assert.Equal(t, want, paths(routes), "cluster-wide mount")
	assert.Equal(t, want, namespacedPaths(routes), "namespaced mount")
}

func TestBuild_SkipsBuilderAdvertisedClusterScopedKinds(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "clusters", "cluster", "Cluster", nil, nil, utils.TableColumns{})
	info = info.WithClusterScope()
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}

	routes := BuildFromManifests(nil, true, nil, fakeStore{}, builders, nil)

	assert.Empty(t, paths(routes))
	assert.Empty(t, namespacedPaths(routes))
}

func TestBuild_MountsKindsDeclaredByManifestAndBuilderOnce(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}
	manifests := []*app.ManifestData{{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name:   gv.Version,
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind: "Widget", Plural: "widgets", Scope: supportedKindScope,
			}},
		}},
	}}

	routes := BuildFromManifests(manifests, true, nil, fakeStore{}, builders, nil)

	want := map[string][]string{gv.String(): {"widgets/list-keys"}}
	assert.Equal(t, want, paths(routes), "cluster-wide mount")
	assert.Equal(t, want, namespacedPaths(routes), "namespaced mount")
}

// A cluster-scoped kind has nothing to list across, so it must reach neither slot.
func TestBuild_SkipsClusterScopedKindsAtBothScopes(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	builders := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{gv}}}
	manifests := []*app.ManifestData{{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name:   gv.Version,
			Served: true,
			Kinds: []app.ManifestVersionKind{
				{Kind: "Cluster", Plural: "clusters", Scope: "Cluster"},
			},
		}},
	}}

	routes := BuildFromManifests(manifests, true, nil, fakeStore{}, builders, nil)
	assert.Empty(t, paths(routes))
	assert.Empty(t, namespacedPaths(routes))
}
