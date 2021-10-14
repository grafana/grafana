package accesscontrol

import (
	"context"
	"fmt"
)

type ResourceManager struct {
	resource     string
	actions      []string
	validActions map[string]struct{}
	store        ResourceStore
	validator    ResourceValidator
}

type ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error

func NewResourceManager(resource string, actions []string, validator ResourceValidator, store ResourceStore) *ResourceManager {
	validActions := make(map[string]struct{}, len(actions))
	for _, a := range actions {
		validActions[a] = struct{}{}
	}

	return &ResourceManager{
		store:        store,
		actions:      actions,
		validActions: validActions,
		resource:     resource,
		validator:    validator,
	}
}

func (r *ResourceManager) GetPermissions(ctx context.Context, orgID int64, resourceID string) ([]ResourcePermission, error) {
	return r.store.GetResourcesPermissions(ctx, orgID, GetResourcesPermissionsQuery{
		Actions:     r.actions,
		Resource:    r.resource,
		ResourceIDs: []string{resourceID},
	})
}

func (r *ResourceManager) GetPermissionsByIds(ctx context.Context, orgID int64, resourceIDs []string) ([]ResourcePermission, error) {
	return r.store.GetResourcesPermissions(ctx, orgID, GetResourcesPermissionsQuery{
		Actions:     r.actions,
		Resource:    r.resource,
		ResourceIDs: resourceIDs,
	})
}

func (r *ResourceManager) SetUserPermissions(ctx context.Context, orgID int64, resourceID string, actions []string, userID int64) ([]ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid actions: %s", actions)
	}

	return r.store.SetUserResourcePermissions(ctx, orgID, userID, SetResourcePermissionsCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *ResourceManager) SetTeamPermission(ctx context.Context, orgID int64, resourceID string, actions []string, teamID int64) ([]ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	return r.store.SetTeamResourcePermissions(ctx, orgID, teamID, SetResourcePermissionsCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *ResourceManager) SetBuiltinRolePermissions(ctx context.Context, orgID int64, resourceID string, actions []string, builtinRole string) ([]ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	return r.store.SetBuiltinResourcePermissions(ctx, orgID, builtinRole, SetResourcePermissionsCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *ResourceManager) RemovePermission(ctx context.Context, orgID int64, resourceID string, permissionID int64) error {
	return r.store.RemoveResourcePermission(ctx, orgID, RemoveResourcePermissionCommand{
		Actions:      r.actions,
		Resource:     r.resource,
		ResourceID:   resourceID,
		PermissionID: permissionID,
	})
}

// Validate will run supplied ResourceValidator
func (r *ResourceManager) Validate(ctx context.Context, orgID int64, resourceID string) error {
	if r.validator != nil {
		return r.validator(ctx, orgID, resourceID)
	}
	return nil
}

func (r *ResourceManager) validateActions(actions []string) bool {
	for _, a := range actions {
		if _, ok := r.validActions[a]; !ok {
			return false
		}
	}
	return true
}
