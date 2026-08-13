package searchroutes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Build only hands the client to the handler; nothing here calls it.
type fakeClient struct{ resourcepb.ResourceIndexClient }

type fakeBuilder struct {
	gvs []schema.GroupVersion
}

func (b *fakeBuilder) GetGroupVersions() []schema.GroupVersion { return b.gvs }
func (b *fakeBuilder) InstallSchema(*runtime.Scheme) error     { return nil }
func (b *fakeBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, builder.APIGroupOptions) error {
	return nil
}
func (b *fakeBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (b *fakeBuilder) AllowedV0Alpha1Resources() []string                  { return nil }

// paths flattens the result so assertions read as the served endpoints do.
func paths(routes []builder.GroupVersionRoutes) map[string][]string {
	out := map[string][]string{}
	for _, r := range routes {
		if r.Routes == nil {
			continue
		}
		for _, h := range r.Routes.Namespace {
			out[r.GroupVersion.String()] = append(out[r.GroupVersion.String()], h.Path)
		}
	}
	return out
}

func TestBuild_NothingMountedWhenOffOrUnusable(t *testing.T) {
	b := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}}

	assert.Nil(t, Build(false, false, nil, fakeClient{}, b, nil), "both off")
	// A server without a unified storage client has nothing to search.
	assert.Nil(t, Build(true, false, nil, nil, b, nil), "no client")
	assert.Nil(t, Build(false, true, nil, nil, b, nil), "no client, trash on")
}

// Trash authorizes on a rule that has not been reviewed yet, so turning search on
// must not expose it.
func TestBuild_SearchAndTrashAreIndependent(t *testing.T) {
	newBuilders := func() []builder.APIGroupBuilder {
		return []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{
			{Group: "dashboard.grafana.app", Version: "v1"},
		}}}
	}
	const gv = "dashboard.grafana.app/v1"

	t.Run("search only", func(t *testing.T) {
		got := paths(Build(true, false, nil, fakeClient{}, newBuilders(), nil))
		assert.Equal(t, []string{"dashboards/search"}, got[gv])
	})

	t.Run("trash only", func(t *testing.T) {
		got := paths(Build(false, true, nil, fakeClient{}, newBuilders(), nil))
		assert.Equal(t, []string{"dashboards/trash"}, got[gv])
	})

	t.Run("both", func(t *testing.T) {
		got := paths(Build(true, true, nil, fakeClient{}, newBuilders(), nil))
		assert.ElementsMatch(t, []string{"dashboards/search", "dashboards/trash"}, got[gv])
	})
}

// Trash must not reach a kind that search cannot.
func TestBuild_TrashRespectsTheAllowlist(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "playlist.grafana.app", Version: "v0alpha1"}}}

	assert.Empty(t, paths(Build(true, true, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil)))
}

func TestBuild_MountsAllowedKinds(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

	assert.Equal(t, []string{"dashboards/search"}, got["dashboard.grafana.app/v1"])
	assert.Equal(t, []string{"folders/search"}, got["folder.grafana.app/v1"])
}

// A manifest describes kinds this process may not serve, so the served group
// versions decide what gets mounted.
func TestBuild_SkipsGroupVersionsNotServed(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

	assert.Contains(t, got, "dashboard.grafana.app/v1")
	assert.NotContains(t, got, "dashboard.grafana.app/v2", "v2 is a served version, but not served by this builder")
}

// The allowlist is what keeps the endpoint off kinds nobody has reviewed yet.
func TestBuild_SkipsKindsNotAllowed(t *testing.T) {
	notAllowed := []schema.GroupVersion{
		{Group: "secret.grafana.app", Version: "v1beta1"},
		{Group: "iam.grafana.app", Version: "v0alpha1"},
		{Group: "playlist.grafana.app", Version: "v0alpha1"},
	}
	b := &fakeBuilder{gvs: notAllowed}

	assert.Empty(t, paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil)))
}

// Every served version of an allowed kind gets the endpoint, so a client can use
// whichever version it already uses for the kind.
func TestBuild_MountsEveryServedVersion(t *testing.T) {
	var dashboardGVs []schema.GroupVersion
	for _, m := range resource.AppManifests() {
		if m.ManifestData == nil || m.ManifestData.Group != "dashboard.grafana.app" {
			continue
		}
		for _, v := range m.ManifestData.Versions {
			if v.Served {
				dashboardGVs = append(dashboardGVs, schema.GroupVersion{Group: m.ManifestData.Group, Version: v.Name})
			}
		}
	}
	require.NotEmpty(t, dashboardGVs)

	got := paths(Build(true, false, nil, fakeClient{},
		[]builder.APIGroupBuilder{&fakeBuilder{gvs: dashboardGVs}}, nil))

	assert.Len(t, got, len(dashboardGVs))
	for _, gv := range dashboardGVs {
		assert.Equal(t, []string{"dashboards/search"}, got[gv.String()], "missing route for %s", gv)
	}
}

func TestServedGroupVersions_CoversBothRegistrationPaths(t *testing.T) {
	fromBuilder := schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v1"}
	b := &fakeBuilder{gvs: []schema.GroupVersion{fromBuilder}}

	served := servedGroupVersions([]builder.APIGroupBuilder{b}, nil)
	assert.True(t, served[fromBuilder])
	assert.False(t, served[schema.GroupVersion{Group: "other.grafana.app", Version: "v1"}])
}
