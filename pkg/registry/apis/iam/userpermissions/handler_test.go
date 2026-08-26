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
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/org-1/users/~/permissions", nil)
	ctx := authlib.WithAuthInfo(req.Context(), caller)
	ctx = genericapirequest.WithNamespace(ctx, "org-1")
	req = req.WithContext(ctx)
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

	handler.handle(rec, permissionsRequest(t, caller, "org-1"))

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, []string{"idp-group"}, client.info.GetGroups())
}

func TestHandlerRejectsNamespaceMismatch(t *testing.T) {
	client := &fakeUserPermissionsClient{}
	handler := NewHandler(client, false)
	caller := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserUID:   "u1",
		Namespace: "org-1",
	}
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/org-2/users/~/permissions", nil)
	ctx := authlib.WithAuthInfo(req.Context(), caller)
	ctx = genericapirequest.WithNamespace(ctx, "org-2")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Nil(t, client.info)
}

func TestHandlerReturnsEmptyPermissionsArray(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{}, false)
	req := permissionsRequest(t, &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "org-1"}, "org-1")
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.JSONEq(t, `{"permissions":[]}`, rec.Body.String())
}

func TestHandlerRejectsMissingIdentity(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{}, false)
	rec := httptest.NewRecorder()

	handler.handle(rec, permissionsRequest(t, nil, "org-1"))

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestHandlerReturnsInternalErrorWhenAuthZFails(t *testing.T) {
	handler := NewHandler(&fakeUserPermissionsClient{err: errors.New("boom")}, false)
	req := permissionsRequest(t, &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "org-1"}, "org-1")
	rec := httptest.NewRecorder()

	handler.handle(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func permissionsRequest(t *testing.T, info authlib.AuthInfo, namespace string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/"+namespace+"/users/~/permissions", nil)
	ctx := genericapirequest.WithNamespace(req.Context(), namespace)
	if info != nil {
		ctx = authlib.WithAuthInfo(ctx, info)
	}
	return req.WithContext(ctx)
}
