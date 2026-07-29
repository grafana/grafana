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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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

func enabledCfg(t *testing.T, enabled bool) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection("grafana-apiserver")
	require.NoError(t, err)
	if enabled {
		_, err = section.NewKey("enable_search_api", "true")
		require.NoError(t, err)
	}
	return cfg
}

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

func TestBuild_DisabledByDefault(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}

	assert.Nil(t, Build(enabledCfg(t, false), nil, nil, []builder.APIGroupBuilder{b}, nil))
	assert.Nil(t, Build(nil, nil, nil, []builder.APIGroupBuilder{b}, nil))
}

func TestBuild_MountsAllowedKinds(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}}

	got := paths(Build(enabledCfg(t, true), nil, nil, []builder.APIGroupBuilder{b}, nil))

	assert.Equal(t, []string{"dashboards/search"}, got["dashboard.grafana.app/v1"])
	// Folders are served and namespaced but not allowed yet: their authorizer
	// would treat a search as a create.
	assert.NotContains(t, got, "folder.grafana.app/v1")
}

// A manifest describes kinds this process may not serve, so the served group
// versions decide what gets mounted.
func TestBuild_SkipsGroupVersionsNotServed(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}

	got := paths(Build(enabledCfg(t, true), nil, nil, []builder.APIGroupBuilder{b}, nil))

	assert.Contains(t, got, "dashboard.grafana.app/v1")
	assert.NotContains(t, got, "dashboard.grafana.app/v2", "v2 is a served version, but not served by this builder")
}

// The allowlist is what keeps the endpoint off kinds nobody has reviewed yet.
func TestBuild_SkipsKindsNotAllowed(t *testing.T) {
	notAllowed := []schema.GroupVersion{
		{Group: "secret.grafana.app", Version: "v1beta1"},
		{Group: "iam.grafana.app", Version: "v0alpha1"},
		{Group: "playlist.grafana.app", Version: "v0alpha1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}
	b := &fakeBuilder{gvs: notAllowed}

	assert.Empty(t, paths(Build(enabledCfg(t, true), nil, nil, []builder.APIGroupBuilder{b}, nil)))
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

	got := paths(Build(enabledCfg(t, true), nil, nil,
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
