package appplugin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/gorilla/mux"
	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

type routeAccessChecker struct {
	requests []authlib.CheckRequest
	allowed  bool
	err      error
}

func (c *routeAccessChecker) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	c.requests = append(c.requests, req)
	return authlib.CheckResponse{Allowed: c.allowed}, c.err
}

func routeProps(t *testing.T, raw string) spec3.PathProps {
	t.Helper()
	var props spec3.PathProps
	require.NoError(t, json.Unmarshal([]byte(raw), &props))
	return props
}

func routeAuthRequest(method string) *http.Request {
	r := httptest.NewRequest(method, "/apis/example.ext.grafana.app/v1/namespaces/org-2/widgets/one/reconcile", nil)
	ctx := authlib.WithAuthInfo(r.Context(), authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{}, &authn.Claims[authn.IDTokenClaims]{}))
	ctx = request.WithRequestInfo(ctx, &request.RequestInfo{Verb: "create", Name: "misparsed-name", Subresource: "misparsed-subresource"})
	ctx = request.WithNamespace(ctx, "org-2")
	return mux.SetURLVars(r.WithContext(ctx), map[string]string{namespaceParameter: "org-2", nameParameter: "one"})
}

func TestManifestRouteAuthorizationValidation(t *testing.T) {
	for _, tc := range []struct{ name, operation, want string }{
		{"undeclared", `{}`, ""},
		{"unrelated extension", `{"x-example-value":true}`, ""},
		{"declared", `{"x-grafana-declared-authz-resource":"widgets","x-grafana-declared-authz-subresource":"","x-grafana-declared-authz-verb":"get"}`, ""},
		{"unknown", `{"x-grafana-unknown":true}`, `unsupported extension "x-grafana-unknown"`},
		{"unsupported mode", `{"x-grafana-authz-mode":"webhook"}`, `unsupported extension "x-grafana-authz-mode"`},
		{"missing resource", `{"x-grafana-declared-authz-verb":"get"}`, "resource is required"},
		{"empty resource", `{"x-grafana-declared-authz-resource":" "}`, "must not be empty"},
		{"wrong type", `{"x-grafana-declared-authz-resource":true}`, "must be a string"},
		{"wrong subresource type", `{"x-grafana-declared-authz-resource":"widgets","x-grafana-declared-authz-subresource":null}`, "must be a string"},
		{"invalid verb", `{"x-grafana-declared-authz-resource":"widgets","x-grafana-declared-authz-verb":"execute"}`, "unsupported declared authorization verb"},
	} {
		for _, scope := range []string{"cluster", "namespaced", "kind"} {
			t.Run(tc.name+"/"+scope, func(t *testing.T) {
				props := routeProps(t, `{"post":`+tc.operation+`}`)
				version := app.ManifestVersion{Name: "v1", Served: true}
				routes := map[string]spec3.PathProps{"/reconcile": props}
				switch scope {
				case "cluster":
					version.Routes.Cluster = routes
				case "namespaced":
					version.Routes.Namespaced = routes
				case "kind":
					version.Kinds = []app.ManifestVersionKind{{Kind: "Widget", Routes: routes}}
				}
				plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app"}, Manifest: &app.ManifestData{Group: "example.ext.grafana.app", Versions: []app.ManifestVersion{version}}}
				_, err := NewAppPluginAPIBuilder(plugin, nil, nil, nil, nil, nil, nil, nil, AppPluginRunnerOptions{}, nil, nil)
				if tc.want == "" {
					require.NoError(t, err)
				} else {
					require.ErrorContains(t, err, tc.want)
					require.ErrorContains(t, err, `plugin "example-app"`)
					require.ErrorContains(t, err, `/reconcile`)
				}
			})
		}
	}
}

func TestBundledManifestPreservesRouteAuthorization(t *testing.T) {
	manifest, err := definition.ParseManifest([]byte(`{
		"apiVersion":"apps.grafana.app/v1alpha2",
		"kind":"AppManifest",
		"spec":{
			"appName":"example",
			"group":"example.ext.grafana.app",
			"versions":[{"name":"v1","routes":{"namespaced":{"/preview":{
				"get":{"x-grafana-declared-authz-resource":"widgets","x-grafana-declared-authz-verb":"get"},
				"post":{"x-grafana-declared-authz-resource":"previews","x-grafana-declared-authz-verb":"create"}
			}}}}]
		}
	}`))
	require.NoError(t, err)
	props := manifest.Versions[0].Routes.Namespaced["/preview"]
	checks, err := declaredRouteChecks(props)
	require.NoError(t, err)
	require.Equal(t, "widgets", checks[http.MethodGet].resource)
	require.Equal(t, "get", checks[http.MethodGet].verb)
	require.Equal(t, "previews", checks[http.MethodPost].resource)
	require.Equal(t, "create", checks[http.MethodPost].verb)
}

func TestDeclaredRouteAuthorization(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1"}
	for _, tc := range []struct {
		name, resource, extra, method         string
		allowed, noIdentity, noClient, noInfo bool
		err                                   error
		status                                int
		wantChecks                            int
		wantName, wantSubresource, wantVerb   string
	}{
		{name: "kind defaults", resource: "widgets", method: "POST", allowed: true, status: 200, wantChecks: 1, wantName: "one", wantSubresource: "reconcile", wantVerb: "create"},
		{name: "overrides", resource: "widgets", extra: `,"x-grafana-declared-authz-subresource":"","x-grafana-declared-authz-verb":"get"`, method: "POST", allowed: true, status: 200, wantChecks: 1, wantName: "one", wantVerb: "get"},
		{name: "version does not inherit parsed object", method: "POST", allowed: true, status: 200, wantChecks: 1, wantVerb: "create"},
		{name: "denied", resource: "widgets", method: "POST", status: 403, wantChecks: 1, wantName: "one", wantSubresource: "reconcile", wantVerb: "create"},
		{name: "checker error", method: "POST", err: errors.New("unavailable"), status: 500, wantChecks: 1, wantVerb: "create"},
		{name: "missing identity", method: "POST", noIdentity: true, status: 500},
		{name: "missing checker", method: "POST", noClient: true, status: 500},
		{name: "missing request info", method: "POST", noInfo: true, status: 500},
		{name: "undeclared method", method: "GET", status: 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			checker := &routeAccessChecker{allowed: tc.allowed, err: tc.err}
			b := &AppPluginAPIBuilder{opts: AppPluginRunnerOptions{RouteAccessChecker: checker}}
			if tc.noClient {
				b.opts.RouteAccessChecker = nil
			}
			props := routeProps(t, `{"get":{},"post":{"x-grafana-declared-authz-resource":"widgets"`+tc.extra+`}}`)
			called := false
			h := b.withDeclaredRouteAuthorization(gv, tc.resource, "reconcile", props, func(http.ResponseWriter, *http.Request) { called = true })
			r := routeAuthRequest(tc.method)
			if tc.noIdentity {
				r = r.WithContext(request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: "create"}))
			}
			if tc.noInfo {
				r = r.WithContext(context.Background())
			}
			rec := httptest.NewRecorder()
			h(rec, r)
			require.Equal(t, tc.status, rec.Code)
			require.Equal(t, tc.status == 200, called)
			require.Len(t, checker.requests, tc.wantChecks)
			if tc.wantChecks > 0 {
				got := checker.requests[0]
				require.Equal(t, gv.Group, got.Group)
				require.Equal(t, "widgets", got.Resource)
				require.Equal(t, "org-2", got.Namespace)
				require.Equal(t, tc.wantName, got.Name)
				require.Equal(t, tc.wantSubresource, got.Subresource)
				require.Equal(t, tc.wantVerb, got.Verb)
				require.Equal(t, r.URL.Path, got.Path)
			}
		})
	}
}

func TestManifestRoutesEnforceDeclaredAuthorization(t *testing.T) {
	for _, scope := range []string{"cluster", "namespaced", "kind"} {
		t.Run(scope, func(t *testing.T) {
			checker := &routeAccessChecker{}
			client := &fakeRouteClient{}
			props := routeProps(t, `{"post":{"x-grafana-declared-authz-resource":"widgets","responses":{"200":{"description":"OK"}}}}`)
			version := app.ManifestVersion{Name: "v1", Served: true}
			paths := map[string]spec3.PathProps{"/reconcile": props}
			path := "/apis/example.ext.grafana.app/v1"
			switch scope {
			case "cluster":
				version.Routes.Cluster = paths
				path += "/reconcile"
			case "namespaced":
				version.Routes.Namespaced = paths
				path += "/namespaces/org-2/reconcile"
			case "kind":
				version.Kinds = []app.ManifestVersionKind{{Kind: "Widget", Plural: "widgets", Scope: "Namespaced", Routes: paths}}
				path += "/namespaces/org-2/widgets/one/reconcile"
			}
			b := &AppPluginAPIBuilder{group: "example.ext.grafana.app", manifest: &app.ManifestData{Group: "example.ext.grafana.app", Versions: []app.ManifestVersion{version}}, clientV3: client, opts: AppPluginRunnerOptions{RouteAccessChecker: checker}}
			container := restful.NewContainer()
			require.NoError(t, builder.AugmentWebServicesWithCustomRoutes(container, []builder.APIGroupBuilder{b}, prometheus.NewRegistry(), nil))
			r := mux.SetURLVars(httptest.NewRequest("POST", path, nil).WithContext(routeAuthRequest("POST").Context()), nil)
			rec := httptest.NewRecorder()
			container.ServeHTTP(rec, r)
			require.Equal(t, http.StatusForbidden, rec.Code, rec.Body.String())
			require.Nil(t, client.req)
			require.Len(t, checker.requests, 1)
			if scope == "cluster" {
				require.Empty(t, checker.requests[0].Namespace)
			} else {
				require.Equal(t, "org-2", checker.requests[0].Namespace)
			}
		})
	}
}

func TestDeclaredRouteStillRequiresParentRead(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1"}
	client := &fakeRouteClient{}
	get := &recordingGetter{err: apierrors.NewForbidden(gv.WithResource("widgets").GroupResource(), "one", errors.New("parent read denied"))}
	checker := &routeAccessChecker{allowed: true}
	b := &AppPluginAPIBuilder{clientV3: client, getter: get.get, opts: AppPluginRunnerOptions{RouteAccessChecker: checker}}
	props := routeProps(t, `{"post":{"x-grafana-declared-authz-resource":"widgets"}}`)
	h := b.withDeclaredRouteAuthorization(gv, "widgets", "reconcile", props, b.routeHandler(gv, "widgets", "reconcile"))
	rec := httptest.NewRecorder()
	h(rec, routeAuthRequest("POST"))
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Len(t, checker.requests, 1)
	require.Equal(t, "one", get.gotName)
	require.Nil(t, client.req)
}
