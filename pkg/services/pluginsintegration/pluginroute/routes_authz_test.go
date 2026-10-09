package pluginroute

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
)

type recordingAccessClient struct {
	allowed bool
	err     error
	checks  []authlib.CheckRequest
	folders []string
}

func (c *recordingAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	c.checks = append(c.checks, req)
	c.folders = append(c.folders, folder)
	return authlib.CheckResponse{Allowed: c.allowed}, c.err
}

// A route's declared access check runs before the plugin is called, filled in
// from the request.
func TestRouteHandlerDeclaredAccess(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}
	parent := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gv.String(), "kind": "TestKind",
		"metadata": map[string]any{
			"name": "thing-1", "namespace": "org-2",
			"annotations": map[string]any{utils.AnnoKeyFolder: "folder-a"},
		},
	}}
	kindRoute := func(check authlib.CheckRequest) manifestroutes.Route {
		return manifestroutes.Route{
			Path: "testkinds/{name}/reload", Namespaced: true, Subresource: "reload",
			Kind:       &app.ManifestVersionKind{Kind: "TestKind", Plural: "TestKinds"},
			Operations: spec3.PathProps{Post: &spec3.Operation{}, Get: &spec3.Operation{}},
			Authz:      map[string]authlib.CheckRequest{http.MethodPost: check, http.MethodGet: check},
		}
	}
	versionRoute := manifestroutes.Route{
		Path: "report", Namespaced: true,
		Operations: spec3.PathProps{Get: &spec3.Operation{}},
		Authz:      map[string]authlib.CheckRequest{http.MethodGet: {Resource: "reports", Verb: "list"}},
	}

	serve := func(t *testing.T, access authlib.AccessChecker, route manifestroutes.Route, method string, verb string) (*httptest.ResponseRecorder, *fakeRouteClient) {
		t.Helper()
		client := &fakeRouteClient{}
		b := &manifestBuilder{group: gv.Group, clientV3: client, getter: (&recordingGetter{obj: parent}).get, accessClient: access}
		req := httptest.NewRequest(method, "/x", nil)
		ctx := identity.WithRequester(req.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, OrgID: 2, Namespace: "org-2"})
		if verb != "" {
			ctx = request.WithRequestInfo(ctx, &request.RequestInfo{Verb: verb})
		}
		req = withPathValues(req.WithContext(ctx), namespaceParameter, "org-2", nameParameter, "thing-1")
		rec := httptest.NewRecorder()
		b.routeHandler(gv, route).ServeHTTP(rec, req)
		return rec, client
	}

	t.Run("a check on the parent's resource names the parent and its folder", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true}
		_, client := serve(t, access, kindRoute(authlib.CheckRequest{Resource: "testkinds", Subresource: "reload"}), http.MethodPost, "create")
		require.NotNil(t, client.req, "the plugin is called")
		require.Equal(t, []authlib.CheckRequest{{
			Group: gv.Group, Resource: "testkinds", Subresource: "reload",
			Namespace: "org-2", Name: "thing-1", Verb: "create",
		}}, access.checks, "without a declared verb the request's is checked")
		require.Equal(t, []string{"folder-a"}, access.folders)
	})

	t.Run("a check on another resource does not name the parent", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true}
		serve(t, access, kindRoute(authlib.CheckRequest{Resource: "reports", Verb: "get"}), http.MethodPost, "create")
		require.Equal(t, []authlib.CheckRequest{{Group: gv.Group, Resource: "reports", Namespace: "org-2", Verb: "get"}}, access.checks)
		require.Equal(t, []string{""}, access.folders)
	})

	t.Run("a version route is checked too", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true}
		_, client := serve(t, access, versionRoute, http.MethodGet, "get")
		require.NotNil(t, client.req)
		require.Equal(t, []authlib.CheckRequest{{Group: gv.Group, Resource: "reports", Namespace: "org-2", Verb: "list"}}, access.checks)
	})

	t.Run("HEAD gets the GET operation's check", func(t *testing.T) {
		withHead := versionRoute
		withHead.Operations.Head = &spec3.Operation{}
		for name, route := range map[string]manifestroutes.Route{
			"served by the GET operation":         versionRoute,
			"declared without a check of its own": withHead,
		} {
			access := &recordingAccessClient{allowed: false}
			rec, client := serve(t, access, route, http.MethodHead, "get")
			require.Equal(t, http.StatusForbidden, rec.Code, name)
			require.Nil(t, client.req, name)
			require.Len(t, access.checks, 1, name)
		}
	})

	t.Run("a denied check stops the request", func(t *testing.T) {
		access := &recordingAccessClient{allowed: false}
		rec, client := serve(t, access, kindRoute(authlib.CheckRequest{Resource: "testkinds"}), http.MethodPost, "create")
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Contains(t, rec.Body.String(), "create testkinds is not allowed")
		require.Nil(t, client.req, "the plugin is never called")
	})

	t.Run("a failing check is an error, not an allow", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true, err: errors.New("authz unavailable")}
		rec, client := serve(t, access, versionRoute, http.MethodGet, "get")
		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	t.Run("a declared check without an access client is refused", func(t *testing.T) {
		rec, client := serve(t, nil, versionRoute, http.MethodGet, "get")
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Contains(t, rec.Body.String(), "no access client is configured")
		require.Nil(t, client.req)
	})

	t.Run("without a declared or request verb there is nothing to check", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true}
		rec, client := serve(t, access, kindRoute(authlib.CheckRequest{Resource: "testkinds"}), http.MethodPost, "")
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Nil(t, client.req)
		require.Empty(t, access.checks)
	})

	t.Run("a request without an identity is refused", func(t *testing.T) {
		access := &recordingAccessClient{allowed: true}
		client := &fakeRouteClient{}
		b := &manifestBuilder{group: gv.Group, clientV3: client, accessClient: access}
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req = withPathValues(req.WithContext(request.WithRequestInfo(req.Context(), &request.RequestInfo{Verb: "get"})),
			namespaceParameter, "org-2")
		rec := httptest.NewRecorder()
		b.routeHandler(gv, versionRoute).ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code)
		require.Nil(t, client.req)
		require.Empty(t, access.checks)
	})

	t.Run("a route without a declared check needs no access client", func(t *testing.T) {
		_, client := serve(t, nil, testVersionRoute, http.MethodGet, "get")
		require.NotNil(t, client.req)
	})
}
