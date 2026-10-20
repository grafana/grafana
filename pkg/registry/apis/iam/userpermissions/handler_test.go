package userpermissions

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

type fakeUserPermissionsClient struct {
	info     authlib.AuthInfo
	request  authlib.GetUserPermissionsRequest
	response authlib.GetUserPermissionsResponse
	err      error
}

func (f *fakeUserPermissionsClient) GetUserPermissions(_ context.Context, info authlib.AuthInfo, req authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	f.info = info
	f.request = req
	return f.response, f.err
}

func (f *fakeUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

func TestHandlerReturnsCurrentUserPermissions(t *testing.T) {
	client := &fakeUserPermissionsClient{
		response: authlib.GetUserPermissionsResponse{
			Permissions: []authlib.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:example"}},
		},
	}
	handler := NewHandler(client, false)
	caller := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		UserUID:        "u1",
		Namespace:      "org-1",
		Groups:         []string{"team-uid"},
		ExternalGroups: []string{"idp-group"},
	}
	req := permissionsRequest(t, caller)
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got iam.UserPermissions
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	require.Equal(t, iam.UserPermissions{
		Permissions: []iam.UserPermission{{Action: "dashboards:read", Scope: "dashboards:uid:example"}},
	}, got)
	require.Equal(t, "org-1", client.request.Namespace)
	require.False(t, client.request.SkipCache)
	require.Equal(t, []string{userPermissionsDelegatedGrant}, client.info.GetTokenDelegatedPermissions())
	require.Equal(t, []string{"team-uid"}, client.info.GetGroups())
}

func TestHandlerUsesExternalGroupsWhenConfigured(t *testing.T) {
	client := &fakeUserPermissionsClient{}
	handler := NewHandler(client, true)
	caller := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		UserUID:        "u1",
		Namespace:      "org-1",
		Groups:         []string{"team-uid"},
		ExternalGroups: []string{"idp-group"},
	}
	rec := httptest.NewRecorder()

	handler.handle(rec, permissionsRequest(t, caller))

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, []string{"idp-group"}, client.info.GetGroups())
}

func TestHandlerUsesIdentityNamespace(t *testing.T) {
	client := &fakeUserPermissionsClient{}
	handler := NewHandler(client, false)
	caller := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserUID:   "u1",
		Namespace: "org-1",
	}
	req := permissionsRequest(t, caller)
	req = req.WithContext(genericapirequest.WithNamespace(req.Context(), "org-2"))
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "org-1", client.request.Namespace)
}

func TestHandlerReturnsEmptyPermissionsArray(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{}, false)
	req := permissionsRequest(t, &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "org-1"})
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.JSONEq(t, `{"permissions":[]}`, rec.Body.String())
}

func TestHandlerRejectsMissingIdentity(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{}, false)
	rec := httptest.NewRecorder()

	handler.handle(rec, permissionsRequest(t, nil))

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestHandlerReturnsInternalErrorWhenAuthZFails(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{err: errors.New("boom")}, false)
	req := permissionsRequest(t, &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "org-1"})
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func permissionsRequest(t *testing.T, info authlib.AuthInfo) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/whoami/permissions", nil)
	ctx := req.Context()
	if info != nil {
		ctx = authlib.WithAuthInfo(ctx, info)
	}
	return req.WithContext(ctx)
}

func TestHandlerPermissionsRoute(t *testing.T) {
	routes := NewHandler(&fakeUserPermissionsClient{}, false).GetAPIRoutes(nil)
	require.Len(t, routes.Namespace, 1)
	require.Equal(t, "users/~/permissions", routes.Namespace[0].Path)
	require.Equal(t, "getCurrentUserPermissions", routes.Namespace[0].Spec.Get.OperationId)
	require.Len(t, routes.Root, 1)
	route := routes.Root[0]
	require.Equal(t, "whoami/permissions", route.Path)
	require.Equal(t, "getWhoAmIPermissions", route.Spec.Get.OperationId)
	require.Empty(t, route.Spec.Get.Parameters)
	require.True(t, route.Spec.Get.Deprecated)
	require.Equal(t, "#/components/schemas/"+iam.UserPermissions{}.OpenAPIModelName(),
		route.Spec.Get.Responses.StatusCodeResponses[http.StatusOK].Content["application/json"].Schema.Ref.String())
}

func TestHandlerNamespacedPermissions(t *testing.T) {
	for _, tc := range []struct {
		name       string
		namespace  string
		noIdentity bool
		wantStatus int
	}{
		{name: "current namespace", namespace: "org-1", wantStatus: http.StatusOK},
		{name: "other namespace", namespace: "org-2", wantStatus: http.StatusForbidden},
		{name: "missing identity", namespace: "org-1", noIdentity: true, wantStatus: http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeUserPermissionsClient{}
			handler := NewHandler(client, false)
			req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/"+tc.namespace+"/users/~/permissions", nil)
			ctx := genericapirequest.WithNamespace(req.Context(), tc.namespace)
			if !tc.noIdentity {
				ctx = authlib.WithAuthInfo(ctx, &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "org-1"})
			}
			rec := httptest.NewRecorder()
			handler.GetAPIRoutes(nil).Namespace[0].Handler(rec, req.WithContext(ctx))
			require.Equal(t, tc.wantStatus, rec.Code)
			if tc.wantStatus == http.StatusOK {
				require.Equal(t, "org-1", client.request.Namespace)
				require.JSONEq(t, `{"permissions":[]}`, rec.Body.String())
			} else {
				require.Nil(t, client.info)
			}
		})
	}
}
