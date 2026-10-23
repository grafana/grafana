package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
)

const (
	testSkipSTHeader = "X-Test-Skip-ST"
	testSkipMTHeader = "X-Test-Skip-MT"
	testMTSource     = "aggregate:mt-router"
)

// sourcedBackend is a fakeBackend reporting a chosen source, and optionally
// caller-scoped discovery.
type sourcedBackend struct {
	fakeBackend
	source string
}

func (b *sourcedBackend) Source() string { return b.source }

type scopedBackend struct{ sourcedBackend }

func (*scopedBackend) CallerScopedDiscovery() {}

func testGroup(name string) metav1.APIGroup {
	gv := metav1.GroupVersionForDiscovery{GroupVersion: name + "/v1", Version: "v1"}
	return metav1.APIGroup{Name: name, Versions: []metav1.GroupVersionForDiscovery{gv}, PreferredVersion: gv}
}

// viewRouter serves an MT group, a plugin group and a caller-scoped default,
// with the rules a stack and a multi-tenant router would each configure.
func viewRouter(t *testing.T) *GrafanaRouter {
	t.Helper()
	router := NewGrafanaRouter(stubLoader{}, nil)
	for _, b := range []Backend{
		&sourcedBackend{fakeBackend: fakeBackend{key: "mt", group: testGroup("mt.grafana.app")}, source: testMTSource},
		&sourcedBackend{fakeBackend: fakeBackend{key: "plugin", group: testGroup("plugin.grafana.app")}, source: "local-plugin"},
		&scopedBackend{sourcedBackend{fakeBackend: fakeBackend{key: "st", group: testGroup("st.grafana.app")}, source: "single-tenant"}},
	} {
		group := b.Group().Name
		router.served[group] = &handlerEntry{backend: b, handler: http.NotFoundHandler(), lastKey: b.Key(), breaker: newGroupBreaker(group)}
	}
	router.discoveryRules = []discoveryRule{
		{Header: testSkipSTHeader, SkipSource: true, Exclude: func(e servingEntry) bool { return e.callerScoped }},
		{Header: testSkipMTHeader, Exclude: func(e servingEntry) bool { return e.source == testMTSource }},
	}
	router.publish(context.Background())
	return router
}

// sourceHandler answers root discovery for the groups the router does not
// serve, in whichever format is asked for, and counts its requests.
func sourceHandler(calls *int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		*calls++
		switch req.URL.Path {
		case "/openapi/v3":
			_ = json.NewEncoder(w).Encode(handler3.OpenAPIV3Discovery{Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{
				"apis/core.grafana.app/v1": {ServerRelativeURL: "/openapi/v3/apis/core.grafana.app/v1?hash=core"},
			}})
		default:
			if req.Header.Get("Accept") == aggregatedDiscoveryJSON {
				_ = json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
					TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
					Items: []apidiscoveryv2.APIGroupDiscovery{{
						ObjectMeta: metav1.ObjectMeta{Name: "core.grafana.app"}, Versions: []apidiscoveryv2.APIVersionDiscovery{{Version: "v1"}},
					}},
				})
				return
			}
			_ = json.NewEncoder(w).Encode(metav1.APIGroupList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
				Groups:   []metav1.APIGroup{testGroup("core.grafana.app")},
			})
		}
	})
}

// setHeader sets a header from a "name" (value "true") or "name=value" spec.
func setHeader(req *http.Request, spec string) {
	if spec == "" {
		return
	}
	name, value, ok := strings.Cut(spec, "=")
	if !ok {
		value = "true"
	}
	req.Header.Set(name, value)
}

func legacyGroups(t *testing.T, router *GrafanaRouter, next http.Handler, header string) []string {
	t.Helper()
	return legacyGroupsWith(t, router.HandleFunc, next, header)
}

func legacyGroupsWith(t *testing.T, handle func(http.ResponseWriter, *http.Request, http.Handler), next http.Handler, header string) []string {
	t.Helper()
	req := newAuthenticatedRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", "application/json")
	setHeader(req, header)
	res := httptest.NewRecorder()
	handle(res, req, next)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var list metav1.APIGroupList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
	var names []string
	for _, g := range list.Groups {
		names = append(names, g.Name)
	}
	sort.Strings(names)
	return names
}

func aggregatedGroups(t *testing.T, router *GrafanaRouter, next http.Handler, header string) []string {
	t.Helper()
	req := newAuthenticatedRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", aggregatedDiscoveryJSON)
	setHeader(req, header)
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, next)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
	var names []string
	for _, g := range list.Items {
		names = append(names, g.Name)
	}
	sort.Strings(names)
	return names
}

func openAPIPaths(t *testing.T, router *GrafanaRouter, next http.Handler, header string) []string {
	t.Helper()
	req := newAuthenticatedRequest(http.MethodGet, "/openapi/v3", nil)
	setHeader(req, header)
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, next)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var index handler3.OpenAPIV3Discovery
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &index))
	var paths []string
	for p := range index.Paths {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	return paths
}

// A request that asks to skip the single-tenant side gets only the groups the
// router itself serves: no source, and no caller-scoped defaults.
func TestDiscoveryViewSkipSourceLegacy(t *testing.T) {
	var calls int
	router := viewRouter(t)
	require.Equal(t, []string{discoveryGroup, "mt.grafana.app", "plugin.grafana.app"}, legacyGroups(t, router, sourceHandler(&calls), testSkipSTHeader))
	require.Zero(t, calls, "the skipped source must not be read")
}

func TestDiscoveryViewSkipSourceAggregated(t *testing.T) {
	var calls int
	router := viewRouter(t)
	require.Equal(t, []string{discoveryGroup, "mt.grafana.app", "plugin.grafana.app"}, aggregatedGroups(t, router, sourceHandler(&calls), testSkipSTHeader))
	require.Zero(t, calls)
}

func TestDiscoveryViewSkipSourceOpenAPIIndex(t *testing.T) {
	var calls int
	router := viewRouter(t)
	require.Equal(t, []string{discoveryOpenAPIPath, "apis/mt.grafana.app/v1", "apis/plugin.grafana.app/v1"}, openAPIPaths(t, router, sourceHandler(&calls), testSkipSTHeader))
	require.Zero(t, calls)
}

// A request that asks to skip the multi-tenant side keeps the source, and
// leaves out only the entries the rule excludes.
func TestDiscoveryViewExcludeEntries(t *testing.T) {
	var calls int
	router := viewRouter(t)
	want := []string{"core.grafana.app", discoveryGroup, "plugin.grafana.app", "st.grafana.app"}
	require.Equal(t, want, legacyGroups(t, router, sourceHandler(&calls), testSkipMTHeader))
	require.Equal(t, want, aggregatedGroups(t, router, sourceHandler(&calls), testSkipMTHeader))
	require.Equal(t, []string{"apis/core.grafana.app/v1", discoveryOpenAPIPath, "apis/plugin.grafana.app/v1", "apis/st.grafana.app/v1"}, openAPIPaths(t, router, sourceHandler(&calls), testSkipMTHeader))
}

// Without a rule's header nothing changes.
func TestDiscoveryViewDefault(t *testing.T) {
	var calls int
	router := viewRouter(t)
	want := []string{"core.grafana.app", discoveryGroup, "mt.grafana.app", "plugin.grafana.app", "st.grafana.app"}
	require.Equal(t, want, legacyGroups(t, router, sourceHandler(&calls), ""))
	require.Equal(t, want, aggregatedGroups(t, router, sourceHandler(&calls), ""))
}

// The default views are cached, so a filtered view must never fall back to
// them when its source fails.
func TestDiscoveryViewNeverFallsBackToDefaultDocument(t *testing.T) {
	failing := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) })
	router := viewRouter(t)
	want := []string{discoveryGroup, "plugin.grafana.app", "st.grafana.app"}
	require.Equal(t, want, legacyGroups(t, router, failing, testSkipMTHeader))
	require.Equal(t, want, aggregatedGroups(t, router, failing, testSkipMTHeader))
	require.Equal(t, []string{discoveryOpenAPIPath, "apis/plugin.grafana.app/v1", "apis/st.grafana.app/v1"}, openAPIPaths(t, router, failing, testSkipMTHeader))
}

// The same URL now has more than one view, so responses vary on the headers.
func TestDiscoveryViewVariesOnRuleHeaders(t *testing.T) {
	var calls int
	router := viewRouter(t)
	for _, target := range []string{"/apis", "/openapi/v3"} {
		req := newAuthenticatedRequest(http.MethodGet, target, nil)
		req.Header.Set("Accept", "application/json")
		res := httptest.NewRecorder()
		router.HandleFunc(res, req, sourceHandler(&calls))
		vary := res.Header().Values("Vary")
		joined := ""
		for _, v := range vary {
			joined += v + ","
		}
		require.Contains(t, joined, testSkipSTHeader, target)
		require.Contains(t, joined, testSkipMTHeader, target)
	}
}

// Rules may share one header and tell requests apart by its value, as the
// origin header does.
func TestDiscoveryRulesMatchOnValue(t *testing.T) {
	var calls int
	router := viewRouter(t)
	router.discoveryRules = []discoveryRule{
		{Header: "X-Test-Origin", Value: "st", SkipSource: true, Exclude: func(e servingEntry) bool { return e.callerScoped }},
		{Header: "X-Test-Origin", Value: "mt", Exclude: func(e servingEntry) bool { return e.source == testMTSource }},
	}
	require.Equal(t, []string{discoveryGroup, "mt.grafana.app", "plugin.grafana.app"}, legacyGroups(t, router, sourceHandler(&calls), "X-Test-Origin=st"))
	require.Equal(t, []string{"core.grafana.app", discoveryGroup, "plugin.grafana.app", "st.grafana.app"}, legacyGroups(t, router, sourceHandler(&calls), "X-Test-Origin=mt"))
	require.Equal(t, []string{"core.grafana.app", discoveryGroup, "mt.grafana.app", "plugin.grafana.app", "st.grafana.app"}, legacyGroups(t, router, sourceHandler(&calls), "X-Test-Origin=other"),
		"a value no rule names changes nothing")

	req := newAuthenticatedRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", "application/json")
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, sourceHandler(&calls))
	require.Equal(t, []string{"Accept", "X-Test-Origin"}, res.Header().Values("Vary"), "a shared header is listed once")
}
