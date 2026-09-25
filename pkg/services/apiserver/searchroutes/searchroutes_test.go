package searchroutes

import (
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
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

	// No trash in either case: playlists are not in trashAllowlist.
	t.Run("no fields, gets the search endpoint", func(t *testing.T) {
		got := paths(BuildFromManifests(playlists(nil), true, true, nil, fakeClient{}, builders, nil))
		assert.Equal(t, []string{"playlists/search"}, got[gv.String()])
	})

	t.Run("one field, gets the search endpoint", func(t *testing.T) {
		fields := []app.ManifestVersionKindSearchField{{Name: "interval", Path: "spec.interval", Type: "string"}}
		got := paths(BuildFromManifests(playlists(fields), true, true, nil, fakeClient{}, builders, nil))
		assert.Equal(t, []string{"playlists/search"}, got[gv.String()])
	})
}

func TestBuild_MountsNamespacedKinds(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{
		{Group: "dashboard.grafana.app", Version: "v1"},
		{Group: "folder.grafana.app", Version: "v1"},
	}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

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

	got := paths(BuildFromManifests(nil, true, true, nil, fakeClient{}, builders, nil))

	assert.Equal(t, []string{"widgets/search"}, got[gv.String()])
}

func TestBuild_SkipsBuilderAdvertisedClusterScopedKinds(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}
	info := utils.NewResourceInfo(gv.Group, gv.Version, "clusters", "cluster", "Cluster", nil, nil, utils.TableColumns{})
	info = info.WithClusterScope()
	builders := []builder.APIGroupBuilder{&resourceBuilder{
		fakeBuilder: &fakeBuilder{gvs: []schema.GroupVersion{gv}},
		infos:       []utils.ResourceInfo{info},
	}}

	got := paths(BuildFromManifests(nil, true, true, nil, fakeClient{}, builders, nil))

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

	got := paths(BuildFromManifests(manifests, true, true, nil, fakeClient{}, builders, nil))

	assert.Equal(t, []string{"widgets/search"}, got[gv.String()])
}

// A manifest describes kinds this process may not serve, so the served group
// versions decide what gets mounted.
func TestBuild_SkipsGroupVersionsNotServed(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "dashboard.grafana.app", Version: "v1"}}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

	assert.Contains(t, got, "dashboard.grafana.app/v1")
	assert.NotContains(t, got, "dashboard.grafana.app/v2", "v2 is a served version, but not served by this builder")
}

// Every namespaced kind in a served group gets the endpoint, whether or not it
// declares search fields. Cluster-scoped kinds still get nothing: IAM serves
// GlobalRole next to the namespaced kinds below.
func TestBuild_MountsEveryNamespacedKindInAServedGroup(t *testing.T) {
	gvs := []schema.GroupVersion{
		{Group: "iam.grafana.app", Version: "v0alpha1"},
		{Group: "playlist.grafana.app", Version: "v0alpha1"},
	}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{&fakeBuilder{gvs: gvs}}, nil))

	assert.ElementsMatch(t, []string{
		// Declare search fields.
		"users/search",
		"teams/search",
		"teambindings/search",
		"externalgroupmappings/search",
		"authinfos/search",
		// Declare none.
		"globalrolebindings/search",
		"resourcepermissions/search",
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
		[]builder.APIGroupBuilder{&fakeBuilder{gvs: dashboardGVs}}, nil))

	assert.Len(t, got, len(dashboardGVs))
	for _, gv := range dashboardGVs {
		// Contains, not Equal: a version may declare more than one allowed kind
		// (v2beta1 serves Notebook alongside Dashboard).
		assert.Contains(t, got[gv.String()], "dashboards/search", "missing route for %s", gv)
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
		[]builder.APIGroupBuilder{&fakeBuilder{gvs: dashboardGVs}}, nil))

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
// channels, plugins, plugin metas, checks, check types, preferences and stars.
func TestBuild_MountedKindsAreListedHere(t *testing.T) {
	got := paths(Build(true, true, nil, fakeClient{}, allBuilders(t), nil))

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
		"resourcepermissions",
		"rolebindings",
		"roles",
		"routingtrees",
		"rulesequences",
		"serviceaccounts",
		"shorturls",
		"snapshots",
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
		{Group: "dashboard.grafana.app", Version: "v1"},
	}}

	got := paths(Build(true, false, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

	assert.NotContains(t, got, "preferences.grafana.app/v1")
	assert.NotContains(t, got, "preferences.grafana.app/v1alpha1")
	assert.NotContains(t, got, "collections.grafana.app/v1alpha1")
	assert.Contains(t, got["dashboard.grafana.app/v1"], "dashboards/search")
}

// A kind gaining /trash should fail this test rather than ship unnoticed.
func TestBuild_KindsWithTrashAreListedHere(t *testing.T) {
	got := paths(Build(true, true, nil, fakeClient{}, allBuilders(t), nil))

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

// Folders get search but are not in trashAllowlist.
func TestBuild_FoldersGetSearchWithoutTrash(t *testing.T) {
	b := &fakeBuilder{gvs: []schema.GroupVersion{{Group: "folder.grafana.app", Version: "v1"}}}

	got := paths(Build(true, true, nil, fakeClient{}, []builder.APIGroupBuilder{b}, nil))

	assert.Equal(t, []string{"folders/search"}, got["folder.grafana.app/v1"])
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
		got := paths(BuildFromManifests(dashboards(nil), true, true, nil, fakeClient{}, builders, nil))
		assert.ElementsMatch(t, []string{"dashboards/search", "dashboards/trash"}, got[gv.String()])
	})

	t.Run("declines search, keeps trash", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Endpoint: optOut(false)}
		got := paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil))
		assert.Equal(t, []string{"dashboards/trash"}, got[gv.String()])
	})

	t.Run("declines trash, keeps search", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Trash: optOut(false)}
		got := paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil))
		assert.Equal(t, []string{"dashboards/search"}, got[gv.String()])
	})

	t.Run("declines both", func(t *testing.T) {
		search := &app.ManifestVersionKindSearch{Endpoint: optOut(false), Trash: optOut(false)}
		assert.Empty(t, paths(BuildFromManifests(dashboards(search), true, true, nil, fakeClient{}, builders, nil)))
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

		routes, err := BuildForServedGroupVersions(manifests, served, true, true, nil, fakeClient{})
		require.NoError(t, err)
		// No trash: ext app kinds are not in trashAllowlist.
		assert.Equal(t, []string{"todos/search"}, paths(routes)[gv.String()])
	})

	t.Run("nothing mounted for a group version the caller does not serve", func(t *testing.T) {
		routes, err := BuildForServedGroupVersions(manifests, nil, true, true, nil, fakeClient{})
		require.NoError(t, err)
		assert.Empty(t, paths(routes))
	})

	t.Run("nothing mounted when both endpoints are off", func(t *testing.T) {
		served := map[schema.GroupVersion]bool{gv: true}

		routes, err := BuildForServedGroupVersions(manifests, served, false, false, nil, fakeClient{})
		require.NoError(t, err)
		assert.Nil(t, routes)
	})
}

// Runtime declarations are refused rather than fatal.
func TestBuildForServedGroupVersions_RejectsAMalformedDeclaration(t *testing.T) {
	gv := schema.GroupVersion{Group: "exampletodoapp.ext.grafana.app", Version: "v1alpha1"}
	served := map[schema.GroupVersion]bool{gv: true}

	// Full-text search over a number is not something the index can serve.
	routes, err := BuildForServedGroupVersions(todoManifest(gv, "int64", "text"), served, true, true, nil, fakeClient{})
	require.Error(t, err)
	assert.Nil(t, routes)
}
