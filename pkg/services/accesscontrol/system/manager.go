package system

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Manager struct {
	resource     string
	actions      []string
	validActions map[string]struct{}
	validator    ResourceValidator
	store        accesscontrol.ResourceStore
}

type ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error

func newManager(resource string, actions []string, validator ResourceValidator, store accesscontrol.ResourceStore) *Manager {
	validActions := make(map[string]struct{}, len(actions))
	for _, a := range actions {
		validActions[a] = struct{}{}
	}

	return &Manager{
		store:        store,
		actions:      actions,
		resource:     resource,
		validator:    validator,
		validActions: validActions,
	}
}

func (r *Manager) GetPermissions(ctx context.Context, orgID int64, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return r.store.GetResourcesPermissions(ctx, orgID, accesscontrol.GetResourcesPermissionsQuery{
		Actions:     r.actions,
		Resource:    r.resource,
		ResourceIDs: []string{resourceID},
	})
}

func (r *Manager) SetUserPermission(ctx context.Context, orgID, userID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid actions: %s", actions)
	}

	if err := r.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	if err := validateUser(ctx, orgID, userID); err != nil {
		return nil, err
	}

	return r.store.SetUserResourcePermission(ctx, orgID, userID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *Manager) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	if err := validateTeam(ctx, orgID, teamID); err != nil {
		return nil, err
	}

	if err := r.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return r.store.SetTeamResourcePermission(ctx, orgID, teamID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *Manager) SetBuiltinRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !r.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	if err := validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := r.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return r.store.SetBuiltinResourcePermission(ctx, orgID, builtInRole, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   r.resource,
		ResourceID: resourceID,
	})
}

func (r *Manager) validateResource(ctx context.Context, orgID int64, resourceID string) error {
	if r.validator != nil {
		return r.validator(ctx, orgID, resourceID)
	}
	return nil
}

func (r *Manager) validateActions(actions []string) bool {
	for _, a := range actions {
		if _, ok := r.validActions[a]; !ok {
			return false
		}
	}
	return true
}

func validateUser(ctx context.Context, orgID, userID int64) error {
	if err := sqlstore.GetSignedInUser(ctx, &models.GetSignedInUserQuery{OrgId: orgID, UserId: userID}); err != nil {
		return err
	}
	return nil
}

func validateTeam(ctx context.Context, orgID, teamID int64) error {
	if err := sqlstore.GetTeamById(ctx, &models.GetTeamByIdQuery{OrgId: orgID, Id: teamID}); err != nil {
		return err
	}
	return nil
}

func validateBuiltinRole(ctx context.Context, builtinRole string) error {
	if err := accesscontrol.ValidateBuiltInRoles([]string{builtinRole}); err != nil {
		return err
	}
	return nil
}
