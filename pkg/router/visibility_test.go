package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	publicGroup    = "widgets.ext.grafana.app"
	internalGroup  = "mobile.ext.grafana.app"
	installedGroup = "gadgets.ext.grafana.app" // installed only in stacks-2
	stackOnlyGroup = "stackonly.ext.grafana.app"
)

// visibilityBackend serves a group with a manifest and its own discovery, and
// counts the requests that reach it.
type visibilityBackend struct {
	fakeBackend
	hits atomic.Int64
}

func newVisibilityBackend(group string) *visibilityBackend {
	b := &visibilityBackend{fakeBackend: fakeBackend{key: group + "-key", group: testAPIGroup(group, "v1")}}
	b.handler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		b.hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	})
	return b
}

func (b *visibilityBackend) Manifest() (*app.ManifestData, bool) {
	return &app.ManifestData{AppName: b.group.Name, Group: b.group.Name, PreferredVersion: "v1",
		Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}, true
}

func (b *visibilityBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	return apidiscoveryv2.APIGroupDiscovery{
		ObjectMeta: metav1.ObjectMeta{Name: b.group.Name},
		Versions:   []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}},
	}, true
}

// fakeNamespaceGroups installs groups by namespace. Every group is installed
// in a namespace it has no entry for, except "broken", which fails.
type fakeNamespaceGroups struct {
	mu        sync.Mutex
	installed map[string][]string
	calls     atomic.Int64
}

func (f *fakeNamespaceGroups) Allowed(_ context.Context, namespace, group string) (bool, error) {
	f.calls.Add(1)
	if namespace == "broken" {
		return false, errors.New("settings unavailable")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	groups, ok := f.installed[namespace]
	return !ok || slices.Contains(groups, group), nil
}

func (f *fakeNamespaceGroups) install(namespace string, groups ...string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.installed[namespace] = groups
}

type visibilityFixture struct {
	router     *GrafanaRouter
	backends   map[string]*visibilityBackend
	namespaces *fakeNamespaceGroups
	fallback   atomic.Int64 // requests the unregistered-group handler got
}

// newVisibilityFixture serves publicGroup, internalGroup and installedGroup,
// with internalGroup and stackOnlyGroup internal. With fallback, the
// unregistered-group handler serves stackOnlyGroup and lists it in /apis.
func newVisibilityFixture(t *testing.T, fallback bool) *visibilityFixture {
	t.Helper()
	f := &visibilityFixture{backends: map[string]*visibilityBackend{}, namespaces: &fakeNamespaceGroups{installed: map[string][]string{}}}
	f.namespaces.install("stacks-1", publicGroup, internalGroup, stackOnlyGroup)
	backends := make([]Backend, 0, 3)
	for _, group := range []string{publicGroup, internalGroup, installedGroup} {
		b := newVisibilityBackend(group)
		f.backends[group] = b
		backends = append(backends, b)
	}
	f.router = NewGrafanaRouter(staticLoader{backends: backends}, nil)
	require.NoError(t, f.router.SetGroupVisibility([]string{internalGroup, stackOnlyGroup}, f.namespaces))
	if fallback {
		f.router.unregisteredGroupHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			f.fallback.Add(1)
			if req.URL.Path != apisPrefix || req.Header.Get("Accept") != "application/json" {
				http.NotFound(w, req)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(metav1.APIGroupList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
				Groups:   []metav1.APIGroup{testAPIGroup(stackOnlyGroup, "v1")},
			})
		})
	}
	require.NoError(t, f.router.reconcile(t.Context()))
	return f
}

func (f *visibilityFixture) serve(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	f.router.HandleFunc(rec, req)
	return rec
}

var (
	userIn1         = &identity.StaticRequester{Type: types.TypeUser, UserUID: "user", OrgID: 1, Namespace: "stacks-1"}
	serviceAcctIn1  = &identity.StaticRequester{Type: types.TypeServiceAccount, UserUID: "sa", OrgID: 1, Namespace: "stacks-1"}
	userIn2         = &identity.StaticRequester{Type: types.TypeUser, UserUID: "user", OrgID: 1, Namespace: "stacks-2"}
	adminIn1        = &identity.StaticRequester{Type: types.TypeUser, UserUID: "admin", OrgID: 1, Namespace: "stacks-1", IsGrafanaAdmin: true}
	policyIn1       = &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "policy", Namespace: "stacks-1"}
	policyWildcard  = &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "policy", Namespace: "*"}
	policyNoNS      = &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "policy"}
	userWithoutNS   = &identity.StaticRequester{Type: types.TypeUser, UserUID: "user", OrgID: 1}
	userInBrokenNS  = &identity.StaticRequester{Type: types.TypeUser, UserUID: "user", OrgID: 1, Namespace: "broken"}
	visibilityCases = []struct {
		name      string
		requester identity.Requester
		want      []string // groups listed besides the discovery group
	}{
		{"user", userIn1, []string{publicGroup}},
		{"service account", serviceAcctIn1, []string{publicGroup}},
		{"admin", adminIn1, []string{publicGroup}},
		{"user where every group is installed", userIn2, []string{installedGroup, publicGroup}},
		{"user without a namespace", userWithoutNS, []string{installedGroup, publicGroup}},
		{"access policy", policyIn1, []string{internalGroup, publicGroup}},
		{"wildcard access policy", policyWildcard, []string{installedGroup, internalGroup, publicGroup}},
		{"access policy without a namespace", policyNoNS, []string{installedGroup, internalGroup, publicGroup}},
		{"namespace filter failing", userInBrokenNS, []string{}},
	}
)

// apiGroupNames returns the names of the groups in rec's APIGroupList.
func apiGroupNames(t *testing.T, rec *httptest.ResponseRecorder) []string {
	t.Helper()
	var list metav1.APIGroupList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	names := make([]string, 0, len(list.Groups))
	for _, g := range list.Groups {
		names = append(names, g.Name)
	}
	return names
}

// withDiscovery returns want with the discovery group, sorted.
func withDiscovery(want ...string) []string {
	return slices.Sorted(slices.Values(append(want, discoveryGroup)))
}

func TestVisibilityFiltersTheAPIGroupList(t *testing.T) {
	f := newVisibilityFixture(t, false)
	for _, tc := range visibilityCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := f.serve(newRequestAs(http.MethodGet, "/apis", tc.requester))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.Equal(t, "private", rec.Header().Get("Cache-Control"))
			names := apiGroupNames(t, rec)
			require.Equal(t, withDiscovery(tc.want...), names)
		})
	}
}

func TestVisibilityFiltersAggregatedDiscovery(t *testing.T) {
	f := newVisibilityFixture(t, false)
	for _, tc := range visibilityCases {
		t.Run(tc.name, func(t *testing.T) {
			req := newRequestAs(http.MethodGet, "/apis", tc.requester)
			req.Header.Set("Accept", aggregatedDiscoveryJSON)
			rec := f.serve(req)
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			require.Equal(t, "private", rec.Header().Get("Cache-Control"))
			var list apidiscoveryv2.APIGroupDiscoveryList
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
			names := make([]string, 0, len(list.Items))
			for _, g := range list.Items {
				names = append(names, g.Name)
			}
			require.Equal(t, withDiscovery(tc.want...), names)
		})
	}
}

func TestVisibilityFiltersTheOpenAPIIndex(t *testing.T) {
	f := newVisibilityFixture(t, false)
	for _, tc := range visibilityCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := f.serve(newRequestAs(http.MethodGet, "/openapi/v3", tc.requester))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			var index handler3.OpenAPIV3Discovery
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &index))
			groups := make([]string, 0, len(index.Paths))
			for path := range index.Paths {
				group, _, ok := parseOpenAPIGroupVersionPath(openapiV3Prefix + "/" + path)
				require.True(t, ok, path)
				groups = append(groups, group)
			}
			slices.Sort(groups)
			require.Equal(t, withDiscovery(tc.want...), groups)
		})
	}
}

func TestVisibilityFiltersTheManifests(t *testing.T) {
	f := newVisibilityFixture(t, false)
	for _, tc := range visibilityCases {
		t.Run(tc.name, func(t *testing.T) {
			rec := f.serve(newRequestAs(http.MethodGet, manifestDiscoveryList, tc.requester))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			var list appmanifestv1alpha2.AppManifestList
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
			names := make([]string, 0, len(list.Items))
			for _, m := range list.Items {
				names = append(names, m.Name)
			}
			require.Equal(t, tc.want, names)

			index := f.serve(newRequestAs(http.MethodGet, discoveryAgentsMD, tc.requester))
			require.Equal(t, http.StatusOK, index.Code)
			for _, group := range []string{publicGroup, internalGroup, installedGroup} {
				listed := strings.Contains(index.Body.String(), "`"+group+"`")
				require.Equal(t, slices.Contains(tc.want, group), listed, group)

				manifest := f.serve(newRequestAs(http.MethodGet, manifestDiscoveryGroups+group, tc.requester))
				if slices.Contains(tc.want, group) {
					require.Equal(t, http.StatusOK, manifest.Code, group)
				} else {
					require.Equal(t, http.StatusNotFound, manifest.Code, group)
				}
			}
		})
	}
}

func TestVisibilityETagsDifferAcrossViews(t *testing.T) {
	f := newVisibilityFixture(t, false)
	etags := map[string]string{}
	for _, requester := range []identity.Requester{userIn1, userIn2, policyIn1, policyWildcard} {
		for _, path := range []string{"/apis", "/openapi/v3", manifestDiscoveryList, discoveryAgentsMD} {
			rec := f.serve(newRequestAs(http.MethodGet, path, requester))
			require.Equal(t, http.StatusOK, rec.Code)
			etag := rec.Header().Get("ETag")
			require.NotEmpty(t, etag)
			if previous, seen := etags[path+etag]; seen {
				t.Fatalf("%s: %s and %s share the ETag %s", path, previous, requester.GetUID(), etag)
			}
			etags[path+etag] = requester.GetUID() + "/" + requester.GetNamespace()

			// A conditional GET with the view's own ETag still gets a 304.
			again := newRequestAs(http.MethodGet, path, requester)
			again.Header.Set("If-None-Match", etag)
			require.Equal(t, http.StatusNotModified, f.serve(again).Code, path)
		}
	}
}

func TestVisibilityHidesGroupRequests(t *testing.T) {
	paths := map[string]string{
		"group discovery":   "/apis/%s",
		"version discovery": "/apis/%s/v1",
		"resource":          "/apis/%s/v1/namespaces/stacks-1/things",
		"watch":             "/apis/%s/v1/namespaces/stacks-1/things?watch=true",
		"cluster resource":  "/apis/%s/v1/things",
		"openapi":           "/openapi/v3/apis/%s/v1",
	}
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		group     string
		visible   bool
	}{
		{"user, public group", userIn1, publicGroup, true},
		{"user, internal group", userIn1, internalGroup, false},
		{"user, group not installed", userIn1, installedGroup, false},
		{"access policy, internal group", policyIn1, internalGroup, true},
		{"access policy, group not installed", policyIn1, installedGroup, false},
		{"wildcard access policy, internal group", policyWildcard, internalGroup, true},
	} {
		for kind, path := range paths {
			t.Run(tc.name+", "+kind, func(t *testing.T) {
				f := newVisibilityFixture(t, false)
				rec := f.serve(newRequestAs(http.MethodGet, strings.Replace(path, "%s", tc.group, 1), tc.requester))
				if tc.visible {
					require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
					require.Positive(t, f.backends[tc.group].hits.Load())
					return
				}
				require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
				require.Zero(t, f.backends[tc.group].hits.Load())
			})
		}
	}
}

func TestVisibilityFiltersByThePathNamespace(t *testing.T) {
	f := newVisibilityFixture(t, false)
	// An admin may name another namespace, whose installs then apply.
	rec := f.serve(newRequestAs(http.MethodGet, "/apis/"+installedGroup+"/v1/namespaces/stacks-2/things", adminIn1))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = f.serve(newRequestAs(http.MethodGet, "/apis/"+installedGroup+"/v1/namespaces/stacks-1/things", adminIn1))
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())

	// A wildcard access policy naming a namespace gets that namespace's view.
	rec = f.serve(newRequestAs(http.MethodGet, "/apis/"+installedGroup+"/v1/namespaces/stacks-1/things", policyWildcard))
	require.Equal(t, http.StatusNotFound, rec.Code, rec.Body.String())
}

func TestVisibilityHidesGroupsFromTheFallback(t *testing.T) {
	f := newVisibilityFixture(t, true)

	// The fallback never sees a request for a group the caller may not see.
	rec := f.serve(newRequestAs(http.MethodGet, "/apis/"+stackOnlyGroup+"/v1/things", userIn1))
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Zero(t, f.fallback.Load())
	f.serve(newRequestAs(http.MethodGet, "/apis/"+stackOnlyGroup+"/v1/things", policyIn1))
	require.Equal(t, int64(1), f.fallback.Load())

	// Its groups are filtered out of the merged list too.
	for _, tc := range []struct {
		requester identity.Requester
		want      []string
	}{
		{userIn1, []string{publicGroup}},
		{policyIn1, []string{internalGroup, publicGroup, stackOnlyGroup}},
	} {
		rec := f.serve(newRequestAs(http.MethodGet, "/apis", tc.requester))
		require.Equal(t, http.StatusOK, rec.Code)
		names := apiGroupNames(t, rec)
		require.Equal(t, withDiscovery(tc.want...), names, tc.requester.GetUID())
	}
}

func TestVisibilityAsksTheNamespaceFilterOnEveryRequest(t *testing.T) {
	f := newVisibilityFixture(t, false)
	path := "/apis/" + installedGroup + "/v1/namespaces/stacks-1/things"
	require.Equal(t, http.StatusNotFound, f.serve(newRequestAs(http.MethodGet, path, userIn1)).Code)

	// An install shows on the next request, with no reconcile.
	f.namespaces.install("stacks-1", publicGroup, installedGroup)
	require.Equal(t, http.StatusOK, f.serve(newRequestAs(http.MethodGet, path, userIn1)).Code)

	// A failing filter hides the group, and is asked again next time.
	before := f.namespaces.calls.Load()
	broken := "/apis/" + publicGroup + "/v1/things"
	require.Equal(t, http.StatusNotFound, f.serve(newRequestAs(http.MethodGet, broken, userInBrokenNS)).Code)
	require.Equal(t, http.StatusNotFound, f.serve(newRequestAs(http.MethodGet, broken, userInBrokenNS)).Code)
	require.Equal(t, before+2, f.namespaces.calls.Load())
}

func TestVisibilityNeverHidesTheDiscoveryGroup(t *testing.T) {
	f := newVisibilityFixture(t, false)
	f.namespaces.install("stacks-1") // nothing installed
	for _, path := range []string{discoveryPrefix, manifestDiscoveryPrefix, "/openapi/v3/apis/" + discoveryGroupVersion.GroupVersion} {
		rec := f.serve(newRequestAs(http.MethodGet, path, userInBrokenNS))
		require.Equal(t, http.StatusOK, rec.Code, path)
		rec = f.serve(newRequestAs(http.MethodGet, path, userIn1))
		require.Equal(t, http.StatusOK, rec.Code, path)
	}

	r := NewGrafanaRouter(stubLoader{}, nil)
	require.Error(t, r.SetGroupVisibility([]string{publicGroup, discoveryGroup}, nil))
}

func TestVisibilityStatusPage(t *testing.T) {
	f := newVisibilityFixture(t, false)
	// Every caller sees every group, hidden ones too, and why each may be hidden.
	for _, requester := range []identity.Requester{userIn1, serviceAcctIn1, policyIn1, adminIn1} {
		rec := f.serve(newRequestAs(http.MethodGet, manifestDiscoveryStatus, requester))
		require.Equal(t, http.StatusOK, rec.Code, requester.GetUID())
		var doc routerStatusDoc
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &doc))
		visibility := map[string]string{}
		for _, g := range doc.Groups {
			visibility[g.Group] = g.Visibility
		}
		require.Equal(t, map[string]string{
			publicGroup:    "public",
			internalGroup:  "internal",
			installedGroup: "public",
		}, visibility, requester.GetUID())
	}
}

func TestVisibilityViewsAreRebuiltOnReconcile(t *testing.T) {
	f := newVisibilityFixture(t, false)
	added := newVisibilityBackend("added.ext.grafana.app")
	f.router.loader = staticLoader{backends: []Backend{f.backends[publicGroup], f.backends[internalGroup], added}}
	require.NoError(t, f.router.reconcile(t.Context()))

	for _, tc := range []struct {
		requester identity.Requester
		want      []string
	}{
		{userWithoutNS, []string{added.group.Name, publicGroup}},
		{policyNoNS, []string{added.group.Name, internalGroup, publicGroup}},
	} {
		rec := f.serve(newRequestAs(http.MethodGet, "/apis", tc.requester))
		names := apiGroupNames(t, rec)
		require.Equal(t, withDiscovery(tc.want...), names)
	}
}

func TestVisibilityUnconfiguredChangesNothing(t *testing.T) {
	backends := []Backend{newVisibilityBackend(publicGroup), newVisibilityBackend(internalGroup)}
	r := NewGrafanaRouter(staticLoader{backends: backends}, nil)
	require.NoError(t, r.SetGroupVisibility(nil, nil))
	require.False(t, r.visibilityScoped)
	require.NoError(t, r.reconcile(t.Context()))

	rec := httptest.NewRecorder()
	r.HandleFunc(rec, newRequestAs(http.MethodGet, "/apis", policyIn1))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Get("Cache-Control"))
	require.Same(t, r.apiGroupList.Load(), r.internalAPIGroupList.Load())
	var list metav1.APIGroupList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list.Groups, 3)
}

func TestProvideGrafanaRouterReadsInternalGroups(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section(routerSection).Key("internal_groups").SetValue(internalGroup + ", " + stackOnlyGroup + " other.ext.grafana.app")
	r, err := ProvideGrafanaRouter(cfg)
	require.NoError(t, err)
	require.Equal(t, map[string]struct{}{internalGroup: {}, stackOnlyGroup: {}, "other.ext.grafana.app": {}}, r.internalGroups)
	require.True(t, r.visibilityScoped)
	require.False(t, r.filterNamespaces)

	cfg.Raw.Section(routerSection).Key("internal_groups").SetValue(discoveryGroup)
	_, err = ProvideGrafanaRouter(cfg)
	require.Error(t, err)
}
