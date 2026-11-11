package legacyscopes

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type PermissionList struct {
	Resource string
	Action   string
	List     *authzv1.ListResponse
}

func ResolvePermissions(ctx context.Context, scope string, lists []PermissionList) ([]ac.Permission, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	formatter := Formatter{}
	var permissions []ac.Permission
	for _, result := range lists {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		permissions = append(permissions, formatter.Permissions(result.Resource, result.Action, scope, result.List)...)
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return permissions, nil
}
