package root

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/connections"
)

func TestGetGroupVersion(t *testing.T) {
	b := NewRootAPIBuilder(nil, nil)
	assert.Equal(t, schema.GroupVersion{Group: "datasource.grafana.app", Version: "v0alpha1"}, b.GetGroupVersion())
}

func TestGetAPIRoutesServesConnections(t *testing.T) {
	b := NewRootAPIBuilder(&fakeConnections{items: []datasourceV0.DataSourceConnection{
		{Name: "prom-uid", Title: "Prometheus", Plugin: "prometheus"},
	}}, nil)

	routes := b.GetAPIRoutes(b.GetGroupVersion())
	require.NotNil(t, routes)
	require.Len(t, routes.Namespace, 1)
	require.Empty(t, routes.Root, "connections is namespaced -- a stack is a namespace")

	route := routes.Namespace[0]
	assert.Equal(t, connections.RoutePath, route.Path)
	require.NotNil(t, route.Spec.Get)
	assert.Equal(t, "listDataSourceConnections", route.Spec.Get.OperationId)

	req := httptest.NewRequest(http.MethodGet, "/connections", nil)
	req = mux.SetURLVars(req, map[string]string{"namespace": "default"})
	rec := httptest.NewRecorder()
	route.Handler(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var list datasourceV0.DataSourceConnectionList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	require.Len(t, list.Items, 1)
	assert.Equal(t, "prom-uid", list.Items[0].Name)
}

func TestPostProcessOpenAPIHidesNoop(t *testing.T) {
	b := NewRootAPIBuilder(nil, nil)
	oas := newOpenAPIWithPaths(
		"/apis/datasource.grafana.app/v0alpha1/noop/{name}",
		"/apis/datasource.grafana.app/v0alpha1/namespaces/{namespace}/connections",
	)

	out, err := b.PostProcessOpenAPI(oas)
	require.NoError(t, err)
	assert.NotContains(t, out.Paths.Paths, "/apis/datasource.grafana.app/v0alpha1/noop/{name}")
	assert.Contains(t, out.Paths.Paths, "/apis/datasource.grafana.app/v0alpha1/namespaces/{namespace}/connections")
}

func TestGetAuthorizer(t *testing.T) {
	attrs := authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "list",
		Resource:        "connections",
		Namespace:       "default",
	}

	t.Run("denies an unauthenticated caller", func(t *testing.T) {
		b := NewRootAPIBuilder(nil, authlib.FixedAccessClient(true))
		decision, _, err := b.GetAuthorizer().Authorize(context.Background(), attrs)
		require.Error(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("denies when the access client says no", func(t *testing.T) {
		b := NewRootAPIBuilder(nil, authlib.FixedAccessClient(false))
		decision, reason, err := b.GetAuthorizer().Authorize(requesterCtx(), attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Equal(t, "access denied", reason)
	})

	t.Run("allows an authorized caller", func(t *testing.T) {
		b := NewRootAPIBuilder(nil, authlib.FixedAccessClient(true))
		decision, _, err := b.GetAuthorizer().Authorize(requesterCtx(), attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("has no opinion on non-resource requests", func(t *testing.T) {
		b := NewRootAPIBuilder(nil, authlib.FixedAccessClient(false))
		decision, _, err := b.GetAuthorizer().Authorize(requesterCtx(), authorizer.AttributesRecord{})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionNoOpinion, decision)
	})
}

func requesterCtx() context.Context {
	return identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:   authlib.TypeUser,
		UserID: 1,
		OrgID:  1,
	})
}

func newOpenAPIWithPaths(paths ...string) *spec3.OpenAPI {
	oas := &spec3.OpenAPI{
		Info:  &spec.Info{},
		Paths: &spec3.Paths{Paths: map[string]*spec3.Path{}},
	}
	for _, p := range paths {
		oas.Paths.Paths[p] = &spec3.Path{}
	}
	return oas
}

type fakeConnections struct {
	items []datasourceV0.DataSourceConnection
}

func (f *fakeConnections) ListConnections(context.Context, datasourceV0.DataSourceConnectionQuery) (*datasourceV0.DataSourceConnectionList, error) {
	return &datasourceV0.DataSourceConnectionList{Items: f.items}, nil
}
