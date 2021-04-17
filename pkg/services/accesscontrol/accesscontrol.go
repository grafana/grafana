package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resource.
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)

	// GetUserPermissions returns user permissions.
	GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*Permission, error)

	// Middleware checks if service disabled or not to switch to fallback authorization.
	IsDisabled() bool
}

func BuildPermissionsMap(permissions []*Permission) map[string]map[string]string {
	permissionsMap := make(map[string]map[string]string)
	for _, p := range permissions {
		if item, ok := permissionsMap[p.Action]; ok {
			if _, ok := item[p.Scope]; !ok && p.Scope != "" {
				permissionsMap[p.Action][p.Scope] = p.Scope
			}
		} else {
			newItem := make(map[string]string)
			if p.Scope != "" {
				newItem[p.Scope] = p.Scope
			}
			permissionsMap[p.Action] = newItem
		}
	}

	return permissionsMap
}
