package legacyscopes

import (
	"context"
	"slices"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type BulkIDResolver interface {
	Prepare(context.Context, types.NamespaceInfo, []string, []string) (IDResolver, error)
}

type PermissionList struct {
	Resource string
	Action   string
	List     *authzv1.ListResponse
}

func ResolvePermissions(ctx context.Context, namespace, scope string, resolver BulkIDResolver, lists []PermissionList) ([]ac.Permission, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var users, teams []string
	for _, result := range lists {
		switch {
		case isTeamRBACAction(result.Action):
			teams = append(teams, result.List.GetItems()...)
		case isUserRBACAction(result.Action):
			users = append(users, result.List.GetItems()...)
		}
	}
	unique := func(values []string) []string {
		slices.Sort(values)
		return slices.DeleteFunc(slices.Compact(values), func(value string) bool { return value == "" })
	}
	users, teams = unique(users), unique(teams)
	formatter := Formatter{}
	if resolver != nil && len(users)+len(teams) > 0 {
		ns, err := types.ParseNamespace(namespace)
		if err != nil {
			return nil, err
		}
		ids, err := resolver.Prepare(ctx, ns, users, teams)
		if err != nil {
			return nil, err
		}
		formatter.IDs = ids
	}
	var permissions []ac.Permission
	for _, result := range lists {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		permissions = append(permissions, formatter.Permissions(ctx, namespace, result.Resource, result.Action, scope, result.List)...)
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return permissions, nil
}
