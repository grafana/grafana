package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type SystemOptions struct {
	Resource          string
	ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error

	Actions       []string
	ActionsMapper func(permission accesscontrol.ResourcePermission) (string, bool)

	Assignments SystemAssignments

	Permissions      []string
	PermissionMapper func(permission string) []string
}

func (s SystemOptions) mapActions(permission accesscontrol.ResourcePermission) (string, bool) {
	if s.ActionsMapper != nil {
		return s.ActionsMapper(permission)
	}
	return "", false
}

func (s SystemOptions) mapPermission(permission string) []string {
	if s.PermissionMapper != nil {
		return s.PermissionMapper(permission)
	}
	return nil
}
