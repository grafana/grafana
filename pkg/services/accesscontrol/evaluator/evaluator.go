package evaluator

import (
	"context"

	"github.com/gobwas/glob"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Evaluate evaluates access to the given resource, using provided AccessControl instance
func Evaluate(ctx context.Context, ac accesscontrol.AccessControl, user *models.SignedInUser, permission string, scope ...string) (bool, error) {
	userPermissions, err := ac.GetUserPermissions(ctx, user)
	if err != nil {
		return false, err
	}

	ok, dbScopes := extractPermission(userPermissions, permission)
	if !ok {
		return false, nil
	}

	return evaluatePermission(dbScopes, scope...)
}

func evaluatePermission(dbScopes map[string]struct{}, targetScopes ...string) (bool, error) {
	for _, s := range targetScopes {
		var match bool
		for dbScope := range dbScopes {
			rule, err := glob.Compile(dbScope, ':', '/')
			if err != nil {
				return false, err
			}

			match = rule.Match(s)
			if match {
				return true, nil
			}
		}
	}

	return false, nil
}

func extractPermission(permissions []*accesscontrol.Permission, targetPermission string) (bool, map[string]struct{}) {
	scopes := map[string]struct{}{}
	ok := false

	for _, p := range permissions {
		if p == nil {
			continue
		}
		if p.Action == targetPermission {
			ok = true
			scopes[p.Scope] = struct{}{}
		}
	}

	return ok, scopes
}
