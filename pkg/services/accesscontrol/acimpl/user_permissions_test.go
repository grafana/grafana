package acimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestServiceGetUserPermissionsDelegatesToAuthZ(t *testing.T) {
	service := setupTestEnv(t, false)
	service.cfg.RBAC.SingleOrganization = true
	service.iamFeatures = iam.Features{UserPermissionsAPI: true}
	expected := []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:*"}}
	client := &fakeUserPermissionsClient{permissions: expected}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: 2}
	options := accesscontrol.Options{ReloadCache: true}

	permissions, err := service.GetUserPermissions(t.Context(), user, options)

	require.NoError(t, err)
	require.Equal(t, expected, permissions)
	require.Same(t, user, client.user)
	require.Equal(t, options, client.options)
	require.Equal(t, 1, client.calls)
}

func TestServiceGetUserPermissionsUsesLocalRBACWhenStartupAPIIsDisabled(t *testing.T) {
	service := setupTestEnv(t, false)
	service.cfg.RBAC.SingleOrganization = true
	client := &fakeUserPermissionsClient{}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: 2}

	_, err := service.GetUserPermissions(t.Context(), user, accesscontrol.Options{ReloadCache: true})

	require.NoError(t, err)
	require.Zero(t, client.calls)
}

func TestServiceGetUserPermissionsUsesLocalRBACForMultiOrg(t *testing.T) {
	service := setupTestEnv(t, false)
	service.cfg.RBAC.SingleOrganization = false
	service.iamFeatures = iam.Features{UserPermissionsAPI: true}
	client := &fakeUserPermissionsClient{}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: 2}

	_, err := service.GetUserPermissions(t.Context(), user, accesscontrol.Options{ReloadCache: true})

	require.NoError(t, err)
	require.Zero(t, client.calls)
}

func TestServiceGetUserPermissionsUsesLocalRBACForGlobalOrg(t *testing.T) {
	service := setupTestEnv(t, false)
	service.iamFeatures = iam.Features{UserPermissionsAPI: true}
	client := &fakeUserPermissionsClient{}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: accesscontrol.GlobalOrgID}

	_, err := service.GetUserPermissions(t.Context(), user, accesscontrol.Options{ReloadCache: true})

	require.NoError(t, err)
	require.Zero(t, client.calls)
}

func TestServiceGetRBACUserPermissionsDoesNotDelegateToAuthZ(t *testing.T) {
	service := setupTestEnv(t, false)
	client := &fakeUserPermissionsClient{}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: 2}

	_, err := service.GetRBACUserPermissions(t.Context(), user, accesscontrol.Options{ReloadCache: true})

	require.NoError(t, err)
	require.Zero(t, client.calls)
}

type fakeUserPermissionsClient struct {
	permissions []accesscontrol.Permission
	user        identity.Requester
	options     accesscontrol.Options
	calls       int
}

func (c *fakeUserPermissionsClient) GetUserPermissions(_ context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	c.calls++
	c.user = user
	c.options = options
	return c.permissions, nil
}

func (c *fakeUserPermissionsClient) ClearUserPermissionCache(identity.Requester) {}
