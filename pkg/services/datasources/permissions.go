package datasources

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// DefaultDatasourceResourcePermissions returns the shared default grants, including an eligible creator.
func DefaultDatasourceResourcePermissions(ctx context.Context) []iamv0.ResourcePermissionspecPermission {
	permissions := []iamv0.ResourcePermissionspecPermission{
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Viewer", Verb: "query"},
		{Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "query"},
	}
	if actor, ok := authlib.AuthInfoFrom(ctx); ok && actor.GetIdentifier() != "" {
		var kind iamv0.ResourcePermissionSpecPermissionKind
		if actor.GetIdentityType() == authlib.TypeUser {
			kind = iamv0.ResourcePermissionSpecPermissionKindUser
		} else if actor.GetIdentityType() == authlib.TypeServiceAccount {
			kind = iamv0.ResourcePermissionSpecPermissionKindServiceAccount
		}
		if kind != "" {
			permissions = append(permissions, iamv0.ResourcePermissionspecPermission{Kind: kind, Name: actor.GetIdentifier(), Verb: "admin"})
		}
	}
	return permissions
}
