package system

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Manager struct {
	resource          string
	actions           []string
	validActions      map[string]struct{}
	resourceValidator ResourceValidator
	store             accesscontrol.ResourceStore
}

func newManager(resource string, actions []string, validator ResourceValidator, store accesscontrol.ResourceStore) *Manager {
	validActions := make(map[string]struct{}, len(actions))
	for _, a := range actions {
		validActions[a] = struct{}{}
	}

	return &Manager{
		store:             store,
		actions:           actions,
		resource:          resource,
		resourceValidator: validator,
		validActions:      validActions,
	}
}

func (m *Manager) GetPermissions(ctx context.Context, orgID int64, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return m.store.GetResourcesPermissions(ctx, orgID, accesscontrol.GetResourcesPermissionsQuery{
		Actions:     m.actions,
		Resource:    m.resource,
		ResourceIDs: []string{resourceID},
	})
}

func (m *Manager) SetUserPermission(ctx context.Context, orgID, userID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !m.validateActions(actions) {
		return nil, fmt.Errorf("invalid actions: %s", actions)
	}

	if err := m.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	if err := m.validateUser(ctx, orgID, userID); err != nil {
		return nil, err
	}

	return m.store.SetUserResourcePermission(ctx, orgID, userID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   m.resource,
		ResourceID: resourceID,
	})
}

func (m *Manager) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !m.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	if err := m.validateTeam(ctx, orgID, teamID); err != nil {
		return nil, err
	}

	if err := m.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return m.store.SetTeamResourcePermission(ctx, orgID, teamID, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   m.resource,
		ResourceID: resourceID,
	})
}

func (m *Manager) SetBuiltinRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, actions []string) (*accesscontrol.ResourcePermission, error) {
	if !m.validateActions(actions) {
		return nil, fmt.Errorf("invalid action: %s", actions)
	}

	if err := m.validateBuiltinRole(ctx, builtInRole); err != nil {
		return nil, err
	}

	if err := m.validateResource(ctx, orgID, resourceID); err != nil {
		return nil, err
	}

	return m.store.SetBuiltinResourcePermission(ctx, orgID, builtInRole, accesscontrol.SetResourcePermissionCommand{
		Actions:    actions,
		Resource:   m.resource,
		ResourceID: resourceID,
	})
}

func (m *Manager) validateResource(ctx context.Context, orgID int64, resourceID string) error {
	if m.resourceValidator != nil {
		return m.resourceValidator(ctx, orgID, resourceID)
	}
	return nil
}

func (m *Manager) validateActions(actions []string) bool {
	for _, a := range actions {
		if _, ok := m.validActions[a]; !ok {
			return false
		}
	}
	return true
}

func (m *Manager) validateUser(ctx context.Context, orgID, userID int64) error {
	if err := sqlstore.GetSignedInUser(ctx, &models.GetSignedInUserQuery{OrgId: orgID, UserId: userID}); err != nil {
		return err
	}
	return nil
}

func (m *Manager) validateTeam(ctx context.Context, orgID, teamID int64) error {
	if err := sqlstore.GetTeamById(ctx, &models.GetTeamByIdQuery{OrgId: orgID, Id: teamID}); err != nil {
		return err
	}
	return nil
}

func (m *Manager) validateBuiltinRole(ctx context.Context, builtinRole string) error {
	if err := accesscontrol.ValidateBuiltInRoles([]string{builtinRole}); err != nil {
		return err
	}
	return nil
}
