package authz

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const userPermissionsDelegatedGrant = "authz.grafana.app/userpermissions:get"

var _ accesscontrol.UserPermissionsClient = (*userPermissionsClient)(nil)

type userPermissionsClient struct {
	client            authlib.UserPermissionsClient
	useExternalGroups bool
}

func newUserPermissionsClient(client authlib.UserPermissionsClient, useExternalGroups bool) *userPermissionsClient {
	return &userPermissionsClient{client: client, useExternalGroups: useExternalGroups}
}

func (c *userPermissionsClient) GetUserPermissions(ctx context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	info, namespace := userPermissionsAuthInfo(user, c.useExternalGroups)
	response, err := c.client.GetUserPermissions(ctx, info, authlib.GetUserPermissionsRequest{
		Namespace: namespace,
		SkipCache: options.ReloadCache,
	})
	if err != nil {
		return nil, err
	}

	permissions := make([]accesscontrol.Permission, 0, len(response.Permissions))
	for _, permission := range response.Permissions {
		permissions = append(permissions, accesscontrol.Permission{
			Action: permission.Action,
			Scope:  permission.Scope,
		})
	}
	return permissions, nil
}

func userPermissionsAuthInfo(user identity.Requester, useExternalGroups bool) (delegatedUserPermissionsAuthInfo, string) {
	namespace := user.GetNamespace()
	if namespace == "" {
		namespace = authlib.OrgNamespaceFormatter(user.GetOrgID())
	}
	groups := user.GetGroups()
	if useExternalGroups {
		groups = user.GetExternalGroups()
	}
	return delegatedUserPermissionsAuthInfo{
		AuthInfo:  user,
		namespace: namespace,
		groups:    groups,
	}, namespace
}

func configureUserPermissionsClient(service accesscontrol.Service, client authlib.UserPermissionsClient, useExternalGroups bool) {
	setter, ok := service.(accesscontrol.UserPermissionsClientSetter)
	if !ok {
		return
	}
	setter.SetUserPermissionsClient(newUserPermissionsClient(client, useExternalGroups))
}

type delegatedUserPermissionsAuthInfo struct {
	authlib.AuthInfo
	namespace string
	groups    []string
}

func (i delegatedUserPermissionsAuthInfo) GetNamespace() string {
	return i.namespace
}

func (i delegatedUserPermissionsAuthInfo) GetGroups() []string {
	return i.groups
}

func (delegatedUserPermissionsAuthInfo) GetTokenDelegatedPermissions() []string {
	return []string{userPermissionsDelegatedGrant}
}
