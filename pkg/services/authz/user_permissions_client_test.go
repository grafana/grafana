package authz

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestUserPermissionsClientAdaptsAccessControlRequest(t *testing.T) {
	backend := &fakeAuthlibUserPermissionsClient{response: authlib.GetUserPermissionsResponse{
		Permissions: []authlib.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}},
	}}
	client := newUserPermissionsClient(backend, false)
	user := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserID:  1,
		UserUID: "user-uid",
		OrgID:   2,
		Groups:  []string{"team-uid"},
	}

	permissions, err := client.GetUserPermissions(t.Context(), user, accesscontrol.Options{ReloadCache: true})

	require.NoError(t, err)
	require.Equal(t, []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}}, permissions)
	require.Equal(t, "user:user-uid", backend.info.GetUID())
	require.Equal(t, "org-2", backend.info.GetNamespace())
	require.Equal(t, []string{userPermissionsDelegatedGrant}, backend.info.GetTokenDelegatedPermissions())
	require.Equal(t, []string{"team-uid"}, backend.info.GetGroups())
	require.Equal(t, authlib.GetUserPermissionsRequest{Namespace: "org-2", SkipCache: true}, backend.request)
}

func TestUserPermissionsClientUsesExternalGroupsWhenConfigured(t *testing.T) {
	backend := &fakeAuthlibUserPermissionsClient{}
	client := newUserPermissionsClient(backend, true)
	user := &identity.StaticRequester{
		Type:           authlib.TypeUser,
		UserID:         1,
		UserUID:        "user-uid",
		OrgID:          2,
		Groups:         []string{"team-uid"},
		ExternalGroups: []string{"idp-group"},
	}

	_, err := client.GetUserPermissions(t.Context(), user, accesscontrol.Options{})

	require.NoError(t, err)
	require.Equal(t, []string{"idp-group"}, backend.info.GetGroups())
}

func TestConfigureUserPermissionsClient(t *testing.T) {
	service := &recordingAccessControlService{}
	backend := &fakeAuthlibUserPermissionsClient{}

	configureUserPermissionsClient(service, backend, false)

	require.IsType(t, &userPermissionsClient{}, service.client)
}

type fakeAuthlibUserPermissionsClient struct {
	response authlib.GetUserPermissionsResponse
	info     authlib.AuthInfo
	request  authlib.GetUserPermissionsRequest
}

func (c *fakeAuthlibUserPermissionsClient) GetUserPermissions(_ context.Context, info authlib.AuthInfo, request authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	c.info = info
	c.request = request
	return c.response, nil
}

func (c *fakeAuthlibUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

type recordingAccessControlService struct {
	accesscontrol.Service
	client accesscontrol.UserPermissionsClient
}

func (s *recordingAccessControlService) SetUserPermissionsClient(client accesscontrol.UserPermissionsClient) {
	s.client = client
}
