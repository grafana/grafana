package system

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// TODO: Add hooks for set Team / User / Builtin
type Options struct {
	Resource          string
	ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error

	Actions       []string
	ActionsMapper func(permission accesscontrol.ResourcePermission) (string, bool)

	Assignments Assignments

	Permissions      []string
	PermissionMapper func(permission string) []string
}

func (s Options) mapActions(permission accesscontrol.ResourcePermission) (string, bool) {
	if s.ActionsMapper != nil {
		return s.ActionsMapper(permission)
	}
	return "", false
}

func (s Options) mapPermission(permission string) []string {
	if s.PermissionMapper != nil {
		return s.PermissionMapper(permission)
	}
	return nil
}
