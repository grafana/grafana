package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/user"
)

type accessBatchClient struct {
	authlib.AccessClient
	batchCheck func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (c *accessBatchClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return c.batchCheck(ctx, info, req)
}

func TestSubAccessREST(t *testing.T) {
	for _, namespace := range []string{"default", "stacks-123"} {
		t.Run(namespace, func(t *testing.T) {
			requester := &user.SignedInUser{UserID: 1, UserUID: "user-1", OrgID: 1, Namespace: namespace}
			ctx := identity.WithRequester(request.WithNamespace(t.Context(), namespace), requester)
			calls := 0
			client := &accessBatchClient{batchCheck: func(callCtx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				calls++
				require.Same(t, requester, info)
				require.Equal(t, ctx, callCtx)
				require.Equal(t, namespace, req.Namespace)
				require.NoError(t, req.Validate())
				require.Len(t, req.Checks, 6)
				verbs := make([]string, 0, len(req.Checks))
				results := make(map[string]authlib.BatchCheckResult)
				for _, check := range req.Checks {
					require.Equal(t, "prometheus.datasource.grafana.app", check.Group)
					require.Equal(t, "datasources", check.Resource)
					require.Equal(t, "ds-1", check.Name)
					require.Empty(t, check.Subresource)
					require.Empty(t, check.Folder)
					verbs = append(verbs, check.Verb)
					results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: check.Verb != "delete"}
				}
				require.ElementsMatch(t, []string{"update", "delete", "get_permissions", "set_permissions", "get_caching", "set_caching"}, verbs)
				return authlib.BatchCheckResponse{Results: results}, nil
			}}
			r := newAccessREST(client)
			responder := &mockHealthResponder{}
			handler, err := r.Connect(ctx, "ds-1", nil, responder)
			require.NoError(t, err)
			// Kubernetes supplies namespace and identity through Connect's context.
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/access", nil))
			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, responder.statusCode)
			require.Equal(t, 1, calls)
			body, err := json.Marshal(responder.obj)
			require.NoError(t, err)
			require.JSONEq(t, `{"Permissions":{
				"datasources:write":true,
				"datasources.permissions:read":true,
				"datasources.permissions:write":true,
				"datasources.caching:read":true,
				"datasources.caching:write":true
			}}`, string(body))
		})
	}
}

func TestSubAccessREST_NoPermissions(t *testing.T) {
	r := newAccessREST(authlib.FixedAccessClient(false))
	ctx := identity.WithRequester(request.WithNamespace(t.Context(), "default"), &user.SignedInUser{UserID: 1, OrgID: 1})
	access, err := r.getAccessInfo(ctx, "ds-1")
	require.NoError(t, err)
	require.Nil(t, access.Permissions)
}

func TestSubAccessREST_Errors(t *testing.T) {
	backendErr := errors.New("authz unavailable")
	for _, tc := range []struct {
		name     string
		response authlib.BatchCheckResponse
		err      error
		wantErr  string
	}{
		{name: "batch error", err: backendErr, wantErr: "authz unavailable"},
		{name: "missing result", wantErr: "missing access check result"},
		{name: "item error", response: authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{
			"update": {Allowed: true, Error: backendErr},
		}}, wantErr: "checking datasources:write: authz unavailable"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newAccessREST(&accessBatchClient{batchCheck: func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				return tc.response, tc.err
			}})
			ctx := identity.WithRequester(request.WithNamespace(t.Context(), "default"), &user.SignedInUser{UserID: 1, OrgID: 1})
			access, err := r.getAccessInfo(ctx, "ds-1")
			require.ErrorContains(t, err, tc.wantErr)
			require.Nil(t, access)
		})
	}
	for _, tc := range []struct {
		name string
		ctx  context.Context
	}{
		{"missing namespace", identity.WithRequester(t.Context(), &user.SignedInUser{UserID: 1, OrgID: 1})},
		{"invalid namespace", request.WithNamespace(t.Context(), "invalid")},
		{"missing identity", request.WithNamespace(t.Context(), "default")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := newAccessREST(&accessBatchClient{batchCheck: func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				t.Fatal("must not check permissions without a valid namespace and identity")
				return authlib.BatchCheckResponse{}, nil
			}})
			access, err := r.getAccessInfo(tc.ctx, "ds-1")
			require.Error(t, err)
			require.Nil(t, access)
		})
	}
}

func newAccessREST(client authlib.AccessClient) *subAccessREST {
	return &subAccessREST{builder: &DataSourceAPIBuilder{
		datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus"),
		accessClient:           client,
	}}
}
