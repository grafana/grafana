package pluginroute

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	manifestroutes "github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// A route for a name with no stored object is sent to the plugin only when the
// kind declares it, and only for a not-found: any other failure to read the
// parent is the storage layer refusing the caller.
func TestRouteHandlerMissingParent(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}
	gr := schema.GroupResource{Group: gv.Group, Resource: "testkinds"}
	route := manifestroutes.Route{
		Path: "testkinds/{name}/reload", Namespaced: true, Subresource: "reload",
		Kind:       &app.ManifestVersionKind{Kind: "TestKind", Plural: "TestKinds"},
		Operations: spec3.PathProps{Post: &spec3.Operation{}},
	}

	serve := func(t *testing.T, allowMissingParent bool, getErr error) (*httptest.ResponseRecorder, *fakeRouteClient) {
		t.Helper()
		client := &fakeRouteClient{}
		b := &manifestBuilder{
			group:        gv.Group,
			clientV3:     client,
			getter:       (&recordingGetter{err: getErr}).get,
			kindPolicies: map[string]kindPolicy{"testkinds": {allowMissingParent: allowMissingParent}},
		}
		req := httptest.NewRequest(http.MethodPost, "/x", nil)
		ctx := identity.WithRequester(req.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserID: 1, OrgID: 2, Namespace: "org-2"})
		ctx = request.WithRequestInfo(ctx, &request.RequestInfo{Verb: "create"})
		req = withPathValues(req.WithContext(ctx), namespaceParameter, "org-2", nameParameter, "thing-1")
		rec := httptest.NewRecorder()
		b.routeHandler(gv, route).ServeHTTP(rec, req)
		return rec, client
	}

	t.Run("a declared kind is called with the name alone", func(t *testing.T) {
		rec, client := serve(t, true, apierrors.NewNotFound(gr, "thing-1"))
		require.NotEqual(t, http.StatusNotFound, rec.Code)
		require.NotNil(t, client.req, "the plugin is called")
		parent := client.req.GetParent()
		require.NotNil(t, parent)
		require.Equal(t, "testkinds", parent.GetResource())
		require.Equal(t, "thing-1", parent.GetName(), "the plugin is told which object it was asked about")
		require.Empty(t, parent.GetRaw(), "there is no object to send")
	})

	t.Run("a kind that does not declare it answers not found", func(t *testing.T) {
		rec, client := serve(t, false, apierrors.NewNotFound(gr, "thing-1"))
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Nil(t, client.req, "the plugin is never called")
	})

	t.Run("a refusal is not a missing object", func(t *testing.T) {
		rec, client := serve(t, true, apierrors.NewForbidden(gr, "thing-1", nil))
		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Nil(t, client.req, "the plugin is never called")
	})

	t.Run("a storage failure is not a missing object", func(t *testing.T) {
		rec, client := serve(t, true, apierrors.NewInternalError(errors.New("storage unavailable")))
		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})
}
