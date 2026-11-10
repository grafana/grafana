package searchroutes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/infra/tracing"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Build only hands the client to the handler; nothing here calls it.
type fakeClient struct{ resourcepb.ResourceIndexClient }

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

type manifestBuilder struct {
	*resourceBuilder
	manifest *app.ManifestData
}

func (b *manifestBuilder) ManifestData() *app.ManifestData { return b.manifest }

func (b *fakeBuilder) InstallSchema(*runtime.Scheme) error { return nil }
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

	assert.Nil(t, Build(false, false, nil, fakeClient{}, b, nil, Options{}), "both off")
	// A server without a unified storage client has nothing to search.
	assert.Nil(t, Build(true, false, nil, nil, b, nil, Options{}), "no client")
	assert.Nil(t, Build(false, true, nil, nil, b, nil, Options{}), "no client, trash on")
}

func TestBuild_HybridManifestOptIn(t *testing.T) {
	yes, no := true, false
	for _, tc := range []struct {
		name    string
		search  *app.ManifestVersionKindSearch
		enabled bool
		lexical bool
		want    []string
	}{
		{"omitted search block", nil, true, true, []string{"widgets/search"}},
		{"omitted hybrid", &app.ManifestVersionKindSearch{}, true, true, []string{"widgets/search"}},
		{"explicit opt out", &app.ManifestVersionKindSearch{Hybrid: &no}, true, true, []string{"widgets/search"}},
		{"deployment disabled", &app.ManifestVersionKindSearch{Hybrid: &yes}, false, true, []string{"widgets/search"}},
		{"both enabled", &app.ManifestVersionKindSearch{Hybrid: &yes}, true, true, []string{"widgets/search", "widgets/search/hybrid"}},
		{"hybrid only", &app.ManifestVersionKindSearch{Hybrid: &yes, Endpoint: &no, Trash: &no}, true, false, []string{"widgets/search/hybrid"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
			manifest := hybridManifest(gv)
			manifest.Versions[0].Kinds[0].Search = tc.search
			routes, err := BuildForServedGroupVersions([]*app.ManifestData{manifest}, map[schema.GroupVersion]bool{gv: true},
				tc.lexical, false, nil, fakeClient{}, Options{HybridEnabled: tc.enabled})
			require.NoError(t, err)
			assert.ElementsMatch(t, tc.want, paths(routes)[gv.String()])
		})
	}
}

func TestBuild_HybridEligibility(t *testing.T) {
	for _, tc := range []struct {
		name                                   string
		served, registered, namespaced, client bool
	}{
		{"eligible", true, true, true, true},
		{"unserved version", false, true, true, true},
		{"version not registered", true, false, true, true},
		{"cluster scoped", true, true, false, true},
		{"no client", true, true, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
			manifest := hybridManifest(gv)
			manifest.Versions[0].Served = tc.served
			if !tc.namespaced {
				manifest.Versions[0].Kinds[0].Scope = "Cluster"
			}
			var client resourcepb.ResourceIndexClient
			if tc.client {
				client = fakeClient{}
			}
			routes, err := BuildForServedGroupVersions([]*app.ManifestData{manifest}, map[schema.GroupVersion]bool{gv: tc.registered},
				false, false, nil, client, Options{HybridEnabled: true})
			require.NoError(t, err)
			if tc.served && tc.registered && tc.namespaced && tc.client {
				assert.Equal(t, []string{"widgets/search/hybrid"}, paths(routes)[gv.String()])
			} else {
				assert.Empty(t, routes)
			}
		})
	}
}

type hybridInstaller struct {
	appsdkapiserver.AppInstaller
	gv       schema.GroupVersion
	manifest *app.ManifestData
}

func (i hybridInstaller) GroupVersions() []schema.GroupVersion { return []schema.GroupVersion{i.gv} }
func (i hybridInstaller) ManifestData() *app.ManifestData      { return i.manifest }

func hybridManifest(gv schema.GroupVersion) *app.ManifestData {
	enabled := true
	return &app.ManifestData{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name: gv.Version, Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind: "Widget", Plural: "widgets", Scope: namespacedScope,
				Search: &app.ManifestVersionKindSearch{Hybrid: &enabled},
			}},
		}},
	}
}

func TestBuild_HybridRegistrationPaths(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	manifest := hybridManifest(gv)
	// A custom builder needs neither declarative embedding inputs nor search fields.
	b := &manifestBuilder{
		resourceBuilder: &resourceBuilder{fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}}},
		manifest:        manifest,
	}
	installer := hybridInstaller{gv: gv, manifest: manifest}
	noHybrid := hybridManifest(gv)
	noHybrid.Versions[0].Kinds[0].Search = nil
	noHybridInstaller := hybridInstaller{gv: gv, manifest: noHybrid}
	for _, tc := range []struct {
		name       string
		builders   []builder.APIGroupBuilder
		installers []appsdkapiserver.AppInstaller
		want       []string
	}{
		{"builder", []builder.APIGroupBuilder{b}, nil, []string{"widgets/search", "widgets/search/hybrid"}},
		{"SDK installer", nil, []appsdkapiserver.AppInstaller{installer}, []string{"widgets/search/hybrid"}},
		{"both register the same resource", []builder.APIGroupBuilder{b}, []appsdkapiserver.AppInstaller{installer}, []string{"widgets/search", "widgets/search/hybrid"}},
		{"SDK installer without hybrid", nil, []appsdkapiserver.AppInstaller{noHybridInstaller}, nil},
		{"installer hybrid opt-out preserves builder search", []builder.APIGroupBuilder{b}, []appsdkapiserver.AppInstaller{noHybridInstaller}, []string{"widgets/search"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			routes := Build(true, true, nil, fakeClient{}, tc.builders, tc.installers, Options{HybridEnabled: true})
			assert.ElementsMatch(t, tc.want, paths(routes)[gv.String()])
		})
	}
}

// The two endpoints are switched separately, so turning one on must not turn the
// other on.
func TestBuild_SearchAndTrashAreIndependent(t *testing.T) {
	newBuilders := func() []builder.APIGroupBuilder {
		return []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{
			{Group: "dashboard.grafana.app", Version: "v1"},
		}}}
	}
	const gv = "dashboard.grafana.app/v1"

	t.Run("search only", func(t *testing.T) {
		got := paths(Build(true, false, nil, fakeClient{}, newBuilders(), nil, Options{}))
		assert.Equal(t, []string{"dashboards/search"}, got[gv])
	})

	t.Run("trash only", func(t *testing.T) {
		got := paths(Build(false, true, nil, fakeClient{}, newBuilders(), nil, Options{}))
		assert.Equal(t, []string{"dashboards/trash"}, got[gv])
	})

	t.Run("both", func(t *testing.T) {
		got := paths(Build(true, true, nil, fakeClient{}, newBuilders(), nil, Options{}))
		assert.ElementsMatch(t, []string{"dashboards/search", "dashboards/trash"}, got[gv])
	})
}

// Search works on the fields every resource has, so declaring none is fine.
func TestBuild_MountsKindsWithoutSearchFields(t *testing.T) {
	gv := schema.GroupVersion{Group: "playlist.grafana.app", Version: "v0alpha1"}
	builders := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{gv}}}

	playlists := func(fields []app.ManifestVersionKindSearchField) []*app.ManifestData {
		return []*app.ManifestData{{
			Group: gv.Group,
			Versions: []app.ManifestVersion{{
				Name:   gv.Version,
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:         "Playlist",
					Plural:       "playlists",
					Scope:        namespacedScope,
					SearchFields: fields,
				}},
			}},
		}}
	}

	// No trash in either case: playlists are not allowed to use search-backed trash.
	t.Run("no fields, gets the search endpoint", func(t *testing.T) {
		got := paths(BuildFromManifests(playlists(nil), true, true, nil, fakeClient{}, builders, nil, Options{}))
		assert.Equal(t, []string{"playlists/search"}, got[gv.String()])
	})

	t.Run("one field, gets the search endpoint", func(t *testing.T) {
		fields := []app.ManifestVersionKindSearchField{{Name: "interval", Path: "spec.interval", Type: "string"}}
		got := paths(BuildFromManifests(playlists(fields), true, true, nil, fakeClient{}, builders, nil, Options{}))
		assert.Equal(t, []string{"playlists/search"}, got[gv.String()])
	})
}

func TestBuild_MountsNamespacedKinds(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil, Options{}))

	assert.Equal(t, []string{"dashboards/search"}, got["dashboard.grafana.app/v1"])
	assert.Equal(t, []string{"folders/search"}, got["folder.grafana.app/v1"])
}

func TestBuild_MountsBuilderAdvertisedKinds(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}

	got := paths(BuildFromManifests(nil, true, true, nil, fakeClient{}, builders, nil, Options{}))

	assert.Equal(t, []string{"widgets/search"}, got[gv.String()])
}

func TestBuild_UsesFullBuilderManifest(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	searchDisabled := false
	manifest := &app.ManifestData{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name:   gv.Version,
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind: "Widget", Plural: "widgets", Scope: namespacedScope,
				Search: &app.ManifestVersionKindSearch{Endpoint: &searchDisabled},
			}},
		}},
	}
	builders := []builder.APIGroupBuilder{&manifestBuilder{
		resourceBuilder: &resourceBuilder{
			fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
			infos:       []utils.ResourceInfo{info},
		},
		manifest: manifest,
	}}

	got := paths(Build(true, false, nil, fakeClient{}, builders, nil, Options{}))

	assert.Empty(t, got, "the full manifest opt-out must win over synthesized resource declarations")
}

func TestBuild_SkipsBuilderAdvertisedClusterScopedKinds(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "clusters", "cluster", "Cluster", nil, nil, utils.TableColumns{})
	info = info.WithClusterScope()
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}

	got := paths(BuildFromManifests(nil, true, true, nil, fakeClient{}, builders, nil, Options{}))

	assert.Empty(t, got)
}

func TestBuild_BuilderAdvertisedKindsUseOnlyStandardSearchFields(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "widgets", "widget", "Widget", nil, nil, utils.TableColumns{})
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}
	provider, err := resource.ManifestBackedProvider(builder.ManifestsFromBuilders(builders)...)
	require.NoError(t, err)
	gvr := gv.WithResource("widgets")

	standard := &searchv0.SearchQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
		Fields:   []string{"title"},
	}
	_, errs := searchapi.TranslateSearchQuery(standard, gvr, "default", provider)
	assert.Empty(t, errs)

	kindSpecific := standard.DeepCopy()
	kindSpecific.Fields = []string{"widget_size"}
	_, errs = searchapi.TranslateSearchQuery(kindSpecific, gvr, "default", provider)
	assert.NotEmpty(t, errs)
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
				Kind: "Widget", Plural: "widgets", Scope: namespacedScope,
			}},
		}},
	}}

	got := paths(BuildFromManifests(manifests, true, true, nil, fakeClient{}, builders, nil, Options{}))

	assert.Equal(t, []string{"widgets/search"}, got[gv.String()])
}

// A manifest describes kinds this process may not serve, so the served group
// versions decide what gets mounted.
func TestBuild_SkipsGroupVersionsNotServed(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil, Options{}))

	assert.Contains(t, got, "dashboard.grafana.app/v1")
	assert.NotContains(t, got, "dashboard.grafana.app/v2", "v2 is a served version, but not served by this builder")
}

// Every namespaced kind in a served group gets the endpoint unless it opts out,
// whether or not it declares search fields. Cluster-scoped kinds get nothing.
func TestBuild_MountsEveryNamespacedKindInAServedGroup(t *testing.T) {
	gvs := []schema.GroupVersion{
		{Group: "iam.grafana.app", Version: "v0alpha1"},
		{Group: "playlist.grafana.app", Version: "v0alpha1"},
	}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{&fakeBuilder{gvs: gvs}}, nil, Options{}))

	assert.ElementsMatch(t, []string{
		// Declare search fields.
		"users/search",
		"teams/search",
		"teambindings/search",
		"externalgroupmappings/search",
		"authinfos/search",
		// Declare none.
		"globalrolebindings/search",
		"rolebindings/search",
		"roles/search",
		"serviceaccounts/search",
		"teamlbacrules/search",
	}, got["iam.grafana.app/v0alpha1"])
	assert.NotContains(t, got["iam.grafana.app/v0alpha1"], "globalroles/search", "GlobalRole is cluster scoped")

	assert.Equal(t, []string{"playlists/search"}, got["playlist.grafana.app/v0alpha1"])
}

// Every served version of an allowed kind gets the endpoint, so a client can use
// whichever version it already uses for the kind.
func TestBuild_MountsEveryServedVersion(t *testing.T) {
	var dashboardGVs []schema.GroupVersion
	for _, m := range resource.AppManifests() {
		if m == nil || m.Group != "dashboard.grafana.app" {
			continue
		}
		for _, v := range m.Versions {
			if v.Served {
				dashboardGVs = append(dashboardGVs, schema.GroupVersion{Group: m.Group, Version: v.Name})
			}
		}
	}
	require.NotEmpty(t, dashboardGVs)

	got := paths(Build(true, false, nil, fakeClient{},
		[]builder.APIGroupBuilder{&fakeBuilder{gvs: dashboardGVs}}, nil, Options{HybridEnabled: true}))

	assert.Len(t, got, len(dashboardGVs))
	for _, gv := range dashboardGVs {
		// Contains, not Equal: a version may declare more than one allowed kind
		// (v2beta1 serves Notebook alongside Dashboard).
		assert.Contains(t, got[gv.String()], "dashboards/search", "missing route for %s", gv)
		assert.Contains(t, got[gv.String()], "dashboards/search/hybrid", "missing hybrid route for %s", gv)
	}
}

// Notebook is declared only in v2beta1, so its route is mounted there and nowhere
// else — the endpoint follows the kind's served versions, not the group's.
func TestBuild_MountsNotebooksOnDeclaringVersionOnly(t *testing.T) {
	var dashboardGVs []schema.GroupVersion
	for _, m := range resource.AppManifests() {
		if m == nil || m.Group != "dashboard.grafana.app" {
			continue
		}
		for _, v := range m.Versions {
			if v.Served {
				dashboardGVs = append(dashboardGVs, schema.GroupVersion{Group: m.Group, Version: v.Name})
			}
		}
	}
	require.NotEmpty(t, dashboardGVs)

	got := paths(Build(true, false, nil, fakeClient{},
		[]builder.APIGroupBuilder{&fakeBuilder{gvs: dashboardGVs}}, nil, Options{}))

	for _, gv := range dashboardGVs {
		if gv.Version == "v2beta1" {
			assert.Contains(t, got[gv.String()], "notebooks/search", "expected notebooks route on %s", gv)
			continue
		}
		assert.NotContains(t, got[gv.String()], "notebooks/search", "unexpected notebooks route on %s", gv)
	}
}

// allServedGroupVersions lets a test ask for everything at once and see what
// comes back.
func allServedGroupVersions(t *testing.T) []schema.GroupVersion {
	t.Helper()

	var gvs []schema.GroupVersion
	for _, m := range resource.AppManifests() {
		if m == nil {
			continue
		}
		for _, v := range m.Versions {
			if v.Served {
				gvs = append(gvs, schema.GroupVersion{Group: m.Group, Version: v.Name})
			}
		}
	}
	require.NotEmpty(t, gvs)
	return gvs
}

func allBuilders(t *testing.T) []builder.APIGroupBuilder {
	return []builder.APIGroupBuilder{
		&fakeBuilder{gvs: allServedGroupVersions(t)},
		&resourceBuilder{
			fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{
				{Group: provisioning.GROUP, Version: provisioning.VERSION},
				{Group: provisioning.GROUP, Version: "v1beta1"},
			}},
			infos: []utils.ResourceInfo{
				provisioning.RepositoryResourceInfo,
				provisioning.ConnectionResourceInfo,
				provisioning.JobResourceInfo,
				provisioning.HistoricJobResourceInfo,
			},
		},
	}
}

// A kind can gain two public endpoints without anyone editing this package.
// Listing the set makes that a failing test rather than a silent change.
//
// Kinds that opt out in their own manifest are absent: secure values, keepers,
// channels, plugins, plugin metas, checks, check types, preferences, stars,
// snapshots and resource permissions.
func TestBuild_MountedKindsAreListedHere(t *testing.T) {
	got := paths(Build(true, true, nil, fakeClient{}, allBuilders(t), nil, Options{}))

	resources := map[string]bool{}
	for _, ps := range got {
		for _, p := range ps {
			resources[strings.SplitN(p, "/", 2)[0]] = true
		}
	}
	names := make([]string, 0, len(resources))
	for r := range resources {
		names = append(names, r)
	}

	assert.ElementsMatch(t, []string{
		"alertrules",
		"annotations",
		"authinfos",
		"configs",
		"connections",
		"correlations",
		"dashboardcompatibilityscores",
		"dashboards",
		"dummys",
		"externalgroupmappings",
		"folders",
		"globalrolebindings",
		"historicjobs",
		"inhibitionrules",
		"jobs",
		"logsdrilldowndefaultcolumns",
		"logsdrilldowndefaultlabels",
		"logsdrilldowndefaults",
		"logsdrilldowns",
		"notebooks",
		"playlists",
		"receivers",
		"recordingrules",
		"repositories",
		"rolebindings",
		"roles",
		"routingtrees",
		"rulesequences",
		"serviceaccounts",
		"shorturls",
		"teambindings",
		"teamlbacrules",
		"teams",
		"templategroups",
		"timeintervals",
		"users",
		"variables",
	}, names)
}

func TestBuild_PrivateResourceManifestsDisableSearch(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "preferences.grafana.app", Version: "v1"},
		{Group: "preferences.grafana.app", Version: "v1alpha1"},
		{Group: "collections.grafana.app", Version: "v1alpha1"},
		{Group: "iam.grafana.app", Version: "v0alpha1"},
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "dashboard.grafana.app", Version: "v2beta1"},
	}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil, Options{}))

	assert.NotContains(t, got, "preferences.grafana.app/v1")
	assert.NotContains(t, got, "preferences.grafana.app/v1alpha1")
	assert.NotContains(t, got, "collections.grafana.app/v1alpha1")
	assert.NotContains(t, got["iam.grafana.app/v0alpha1"], "resourcepermissions/search")
	assert.Contains(t, got["dashboard.grafana.app/v1"], "dashboards/search")
	// A kind in the same version mounts search, so the absence below is the manifest's doing.
	assert.Contains(t, got["dashboard.grafana.app/v2beta1"], "variables/search")
	assert.NotContains(t, got["dashboard.grafana.app/v2beta1"], "dashboardpreferences/search")

	// Trash and hybrid are off above, so turn every endpoint on to make their absence mean something.
	all := paths(Build(true, true, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil, Options{HybridEnabled: true}))
	assert.Contains(t, all["dashboard.grafana.app/v1"], "dashboards/trash")
	assert.Contains(t, all["dashboard.grafana.app/v1"], "dashboards/search/hybrid")
	// Same version as the absence checks below, so they cannot pass because v2beta1 is not mounted.
	assert.Contains(t, all["dashboard.grafana.app/v2beta1"], "dashboards/search/hybrid")
	for _, endpoint := range []string{"dashboardpreferences/search", "dashboardpreferences/search/hybrid", "dashboardpreferences/trash"} {
		assert.NotContains(t, all["dashboard.grafana.app/v2beta1"], endpoint)
	}
}

// A kind gaining /trash should fail this test rather than ship unnoticed.
func TestBuild_KindsWithTrashAreListedHere(t *testing.T) {
	got := paths(Build(true, true, nil, fakeClient{}, allBuilders(t), nil, Options{}))

	resources := map[string]bool{}
	for _, ps := range got {
		for _, p := range ps {
			name, endpoint, _ := strings.Cut(p, "/")
			if endpoint == "trash" {
				resources[name] = true
			}
		}
	}
	names := make([]string, 0, len(resources))
	for r := range resources {
		names = append(names, r)
	}

	assert.ElementsMatch(t, []string{"dashboards"}, names)
}

// Folders get lexical and hybrid search but are not allowed to use search-backed trash.
func TestBuild_FoldersGetSearchWithoutTrash(t *testing.T) {
	versions := []schema.GroupVersion{
		{Group: "folder.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1beta1"},
	}
	b := &fakeBuilder{gvs: versions}

	got := paths(Build(true, true, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil, Options{HybridEnabled: true}))

	for _, gv := range versions {
		assert.ElementsMatch(t, []string{"folders/search", "folders/search/hybrid"}, got[gv.String()])
	}
}

// Declining one endpoint must leave the other alone.
func TestBuild_ManifestOptOutIsHonoured(t *testing.T) {
	gv := schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v1"}
	builders := []builder.APIGroupBuilder{&fakeBuilder{gvs: []schema.GroupVersion{gv}}}

	dashboards := func(search *app.ManifestVersionKindSearch) []*app.ManifestData {
		return []*app.ManifestData{{
			Group: gv.Group,
			Versions: []app.ManifestVersion{{
				Name:   gv.Version,
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "Dashboard",
					Plural: "dashboards",
					Scope:  namespacedScope,
					Search: search,
					// Enrols the kind, so what is under test is the opt-out alone.
					SearchFields: []app.ManifestVersionKindSearchField{
						{Name: "title", Path: "spec.title", Type: "string"},
					},
				}},
			}},
		}}
	}
	optOut := func(v bool) *bool { return &v }

	t.Run("says nothing, so gets both", func(t *testing.T) {
		got := paths(BuildFromManifests(dashboards(nil), true, true, nil, fakeClient{}, builders, nil, Options{}))
		assert.ElementsMatch(t, []string{"dashboards/search", "dashboards/trash"}, got[gv.String()])
	})

	t.Run("declines search, keeps trash", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Endpoint: optOut(false)}
		got := paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil, Options{}))
		assert.Equal(t, []string{"dashboards/trash"}, got[gv.String()])
	})

	t.Run("declines trash, keeps search", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Trash: optOut(false)}
		got := paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil, Options{}))
		assert.Equal(t, []string{"dashboards/search"}, got[gv.String()])
	})

	t.Run("declines both", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Endpoint: optOut(false), Trash: optOut(false)}
		assert.Empty(t, paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil, Options{})))
	})
}

func TestServedGroupVersions_CoversBothRegistrationPaths(t *testing.T) {
	fromBuilder := schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v1"}
	b := &fakeBuilder{gvs: []schema.GroupVersion{fromBuilder}}

	served := builder.ServedGroupVersions([]builder.APIGroupBuilder{b}, nil)
	assert.True(t, served[fromBuilder])
	assert.False(t, served[schema.GroupVersion{Group: "other.grafana.app", Version: "v1"}])
}

// todoManifest is an ext app group, which no builder or installer knows about.
func todoManifest(gv schema.GroupVersion, fieldType, capability string) []*app.ManifestData {
	return []*app.ManifestData{{
		Group: gv.Group,
		Versions: []app.ManifestVersion{{
			Name:   gv.Version,
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind:   "Todo",
				Plural: "todos",
				Scope:  "Namespaced",
				SearchFields: []app.ManifestVersionKindSearchField{
					{Name: "title", Path: "spec.title", Type: fieldType, Capabilities: []string{capability}},
				},
			}},
		}},
	}}
}

func TestBuildForServedGroupVersions_MountsWithoutBuildersOrInstallers(t *testing.T) {
	gv := schema.GroupVersion{Group: "exampletodoapp.ext.grafana.app", Version: "v1alpha1"}
	manifests := todoManifest(gv, "string", "filter")

	t.Run("mounted when the caller serves the group version", func(t *testing.T) {
		served := map[schema.GroupVersion]bool{gv: true}

		routes, err := BuildForServedGroupVersions(manifests, served, true, true, nil, fakeClient{}, Options{})
		require.NoError(t, err)
		// No trash: ext app kinds are not allowed to use search-backed trash.
		assert.Equal(t, []string{"todos/search"}, paths(routes)[gv.String()])
	})

	t.Run("nothing mounted for a group version the caller does not serve", func(t *testing.T) {
		routes, err := BuildForServedGroupVersions(manifests, nil, true, true, nil, fakeClient{}, Options{})
		require.NoError(t, err)
		assert.Empty(t, paths(routes))
	})

	t.Run("nothing mounted when both endpoints are off", func(t *testing.T) {
		served := map[schema.GroupVersion]bool{gv: true}

		routes, err := BuildForServedGroupVersions(manifests, served, false, false, nil, fakeClient{}, Options{})
		require.NoError(t, err)
		assert.Nil(t, routes)
	})
}

// Runtime declarations are refused rather than fatal.
func TestBuildForServedGroupVersions_RejectsAMalformedDeclaration(t *testing.T) {
	gv := schema.GroupVersion{Group: "exampletodoapp.ext.grafana.app", Version: "v1alpha1"}
	served := map[schema.GroupVersion]bool{gv: true}

	// Full-text search over a number is not something the index can serve.
	routes, err := BuildForServedGroupVersions(todoManifest(gv, "int64", "text"), served, true, true, nil, fakeClient{}, Options{})
	require.Error(t, err)
	assert.Nil(t, routes)
}

func TestBuildGlobalSearch(t *testing.T) {
	const searchGV = searchv0.GROUP + "/" + searchv0.VERSION

	got := paths(BuildGlobalSearch(nil, fakeClient{}))
	assert.Equal(t, map[string][]string{searchGV: {resource.GlobalSearchResource + "/" + searchv0.SearchPathSegment}}, got,
		"only the one route, under the search group")

	assert.Nil(t, BuildGlobalSearch(nil, nil), "nothing to serve it with without a client")
}

func TestBuildGlobalHybridSearch(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	manifest := hybridManifest(gv)
	b := &manifestBuilder{
		resourceBuilder: &resourceBuilder{fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}}},
		manifest:        manifest,
	}
	manifest.Versions[0].Served = false
	manifest.Versions[0].Kinds[0].Search = nil
	installer := hybridInstaller{gv: gv, manifest: manifest}
	installers := []appsdkapiserver.AppInstaller{installer}

	for _, tc := range []struct {
		name       string
		builders   []builder.APIGroupBuilder
		installers []appsdkapiserver.AppInstaller
	}{
		{"builder", []builder.APIGroupBuilder{b}, nil},
		{"installer", nil, installers},
	} {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
				called = true
				assert.Equal(t, gv.Group, attr.GetAPIGroup())
				assert.Equal(t, gv.Version, attr.GetAPIVersion())
				assert.Equal(t, "widgets", attr.GetResource())
				return authorizer.DecisionDeny, "", nil
			})
			routes := BuildGlobalHybridSearch(tracing.NewNoopTracerService(), fakeClient{}, tc.builders, tc.installers, auth)
			assert.Equal(t, map[string][]string{searchv0.APIVERSION: {"global/search/hybrid"}}, paths(routes))
			require.Len(t, routes, 1)
			require.Len(t, routes[0].Routes.Namespace, 1)
			r := httptest.NewRequest(http.MethodPost, "/global/search/hybrid", strings.NewReader(`{"apiVersion":"search.grafana.app/v0alpha1","kind":"HybridSearchQuery","query":"cpu","resources":[{"group":"example.grafana.app","resource":"widgets"}]}`))
			w := httptest.NewRecorder()
			routes[0].Routes.Namespace[0].Handler(w, r.WithContext(request.WithNamespace(r.Context(), "default")))
			assert.True(t, called, "the manifest target must reach API authorization")
			assert.Equal(t, http.StatusForbidden, w.Code, w.Body.String())
		})
	}
	assert.Nil(t, BuildGlobalHybridSearch(nil, nil, nil, installers, nil))
}

func TestBuildGlobalHybridSearchUsesConfiguredDefaults(t *testing.T) {
	t.Setenv("GF_UNIFIED_STORAGE_HYBRID_SEARCH_DEFAULT_RESOURCES", " example.grafana.app/widgets, dashboard.grafana.app/dashboards ")
	cfg := setting.NewCfg()
	require.NoError(t, cfg.Load(setting.CommandLineArgs{HomePath: "../../../../", Config: "../../../../conf/defaults.ini"}))
	require.Equal(t, []string{"example.grafana.app/widgets", "dashboard.grafana.app/dashboards"}, cfg.HybridSearchDefaultResources)

	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	b := &manifestBuilder{
		resourceBuilder: &resourceBuilder{fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}}},
		manifest:        hybridManifest(gv),
	}
	var authorized []string
	auth := authorizer.AuthorizerFunc(func(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		authorized = append(authorized, attr.GetAPIGroup()+"/"+attr.GetResource())
		return authorizer.DecisionDeny, "", nil
	})
	routes := BuildGlobalHybridSearch(tracing.NewNoopTracerService(), fakeClient{}, []builder.APIGroupBuilder{b}, nil, auth, cfg.HybridSearchDefaultResources...)
	require.Len(t, routes, 1)
	require.Len(t, routes[0].Routes.Namespace, 1)
	r := httptest.NewRequest(http.MethodPost, "/global/search/hybrid", strings.NewReader(`{"apiVersion":"search.grafana.app/v0alpha1","kind":"HybridSearchQuery","query":"cpu"}`))
	w := httptest.NewRecorder()
	routes[0].Routes.Namespace[0].Handler(w, r.WithContext(request.WithNamespace(r.Context(), "default")))
	assert.Equal(t, http.StatusForbidden, w.Code, w.Body.String())
	assert.Equal(t, []string{"example.grafana.app/widgets"}, authorized)
}

// hybridResultsClient answers every hybrid search with the same results.
type hybridResultsClient struct {
	resourcepb.ResourceIndexClient
	results []*resourcepb.HybridSearchResult
}

func (c hybridResultsClient) HybridSearch(context.Context, *resourcepb.HybridSearchRequest, ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return &resourcepb.HybridSearchResponse{Results: c.results}, nil
}

func TestBuildGlobalHybridSearch_NamesKindsItDoesNotServe(t *testing.T) {
	// Like the standalone search API server: no builders or installers, so no type
	// is served here, and every result is named from the compiled-in manifests.
	client := hybridResultsClient{results: []*resourcepb.HybridSearchResult{
		{Key: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "d1"}},
		{Key: &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Name: "f1"}},
		{Key: &resourcepb.ResourceKey{Group: "unknown.ext.grafana.app", Resource: "things", Name: "t1"}},
	}}
	auth := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		t.Fatal("types this server does not serve are authorized by the search backend")
		return authorizer.DecisionDeny, "", nil
	})
	routes := BuildGlobalHybridSearch(tracing.NewNoopTracerService(), client, nil, nil, auth)
	require.Len(t, routes, 1)
	require.Len(t, routes[0].Routes.Namespace, 1)

	r := httptest.NewRequest(http.MethodPost, "/global/search/hybrid", strings.NewReader(`{"apiVersion":"search.grafana.app/v0alpha1","kind":"HybridSearchQuery","query":"cpu","resources":[{"group":"dashboard.grafana.app","resource":"dashboards"},{"group":"folder.grafana.app","resource":"folders"}]}`))
	w := httptest.NewRecorder()
	routes[0].Routes.Namespace[0].Handler(w, r.WithContext(request.WithNamespace(r.Context(), "default")))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var response searchv0.HybridSearchResults
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	kinds := map[string]string{}
	for _, item := range response.Items {
		kinds[item.Resource.Name] = item.Resource.Kind
	}
	assert.Equal(t, map[string]string{"d1": "Dashboard", "f1": "Folder", "t1": ""}, kinds)
}

func TestGlobalHybridSearchTargets_LocalAPIAuthorization(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	no := false
	for _, tc := range []struct {
		name       string
		configure  func(*app.ManifestData)
		registered bool
		want       bool
	}{
		{name: "eligible", registered: true, want: true},
		{name: "hybrid only", registered: true, want: true, configure: func(m *app.ManifestData) {
			m.Versions[0].Kinds[0].Search.Endpoint = &no
			m.Versions[0].Kinds[0].Search.Trash = &no
		}},
		{name: "omitted opt in", registered: true, want: true, configure: func(m *app.ManifestData) {
			m.Versions[0].Kinds[0].Search = nil
		}},
		{name: "explicit opt out", registered: true, want: true, configure: func(m *app.ManifestData) {
			m.Versions[0].Kinds[0].Search.Hybrid = &no
		}},
		{name: "cluster scoped", registered: true, configure: func(m *app.ManifestData) {
			m.Versions[0].Kinds[0].Scope = "Cluster"
		}},
		{name: "unserved version", registered: true, want: true, configure: func(m *app.ManifestData) {
			m.Versions[0].Served = false
		}},
		{name: "unregistered group version"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			manifest := hybridManifest(gv)
			if tc.configure != nil {
				tc.configure(manifest)
			}
			got := globalHybridSearchTargets([]*app.ManifestData{nil, manifest}, map[schema.GroupVersion]bool{gv: tc.registered})
			if tc.want {
				assert.Equal(t, map[schema.GroupResource]schema.GroupVersionKind{
					gv.WithResource("widgets").GroupResource(): gv.WithKind("Widget"),
				}, got)
			} else {
				assert.Empty(t, got)
			}
		})
	}
}

func TestGlobalHybridSearchTargets_SelectsRegisteredVersion(t *testing.T) {
	v1 := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	v2 := schema.GroupVersion{Group: v1.Group, Version: "v2"}
	for _, tc := range []struct {
		name         string
		preferred    string
		v2Hybrid     bool
		v2Registered bool
		want         string
	}{
		{"preferred", "v1", true, true, "v1"},
		{"last when no preferred version", "", true, true, "v2"},
		{"unknown preferred version", "v3", true, true, "v2"},
		{"preferred opted out", "v2", false, true, "v2"},
		{"preferred not registered here", "v2", true, false, "v1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			manifest := hybridManifest(v1)
			manifest.PreferredVersion = tc.preferred
			second := hybridManifest(v2).Versions[0]
			second.Kinds[0].Search.Hybrid = &tc.v2Hybrid
			manifest.Versions = append(manifest.Versions, second)
			got := globalHybridSearchTargets([]*app.ManifestData{manifest}, map[schema.GroupVersion]bool{v1: true, v2: tc.v2Registered})
			assert.Equal(t, map[schema.GroupResource]schema.GroupVersionKind{
				v1.WithResource("widgets").GroupResource(): {Group: v1.Group, Version: tc.want, Kind: "Widget"},
			}, got)
		})
	}
}

// Without registered versions there is nothing to authorize against, so a
// missing map must not count every version.
func TestGlobalHybridSearchTargets_NilRegisteredAllowsNoVersion(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	assert.Empty(t, globalHybridSearchTargets([]*app.ManifestData{hybridManifest(gv)}, nil))
}

// Results are named the same in every process, whatever versions it serves.
func TestGlobalHybridSearchKinds(t *testing.T) {
	v1 := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	v2 := schema.GroupVersion{Group: v1.Group, Version: "v2"}
	widgets := v1.WithResource("widgets").GroupResource()

	renamed := hybridManifest(v1)
	renamed.PreferredVersion = "v2"
	gadget := hybridManifest(v2).Versions[0]
	gadget.Kinds[0].Kind = "Gadget"
	renamed.Versions = append(renamed.Versions, gadget)
	assert.Equal(t, map[schema.GroupResource]string{widgets: "Gadget"}, globalHybridSearchKinds([]*app.ManifestData{renamed}),
		"the preferred version names the kind, even where it is not served")

	clusterScoped := hybridManifest(v1)
	clusterScoped.Versions[0].Kinds[0].Scope = "Cluster"
	assert.Empty(t, globalHybridSearchKinds([]*app.ManifestData{clusterScoped}))

	// A later manifest preferring a version that renames the kind does not win
	// over the first manifest declaring the resource.
	assert.Equal(t, map[schema.GroupResource]string{widgets: "Widget"}, globalHybridSearchKinds([]*app.ManifestData{nil, hybridManifest(v1), renamed}))
}

func TestGlobalHybridSearchTargets_FirstDeclarationSuppliesKind(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	first := hybridManifest(gv)
	first.Versions[0].Kinds[0].Kind = "FirstWidget"
	assert.Equal(t, map[schema.GroupResource]schema.GroupVersionKind{
		gv.WithResource("widgets").GroupResource(): gv.WithKind("FirstWidget"),
	}, globalHybridSearchTargets([]*app.ManifestData{first, hybridManifest(gv)}, map[schema.GroupVersion]bool{gv: true}))
}
