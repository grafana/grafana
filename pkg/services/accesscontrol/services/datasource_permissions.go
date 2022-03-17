package services

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func ProvideDatasourcePermissions() *DatasourcePermissions {
	return &DatasourcePermissions{}
}

var _ accesscontrol.DatasourcePermissions = new(DatasourcePermissions)

type DatasourcePermissions struct{}

func (e DatasourcePermissions) GetPermissions(ctx context.Context, user *models.SignedInUser, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissions) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissions) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissions) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissions) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissions) MapActions(permission accesscontrol.ResourcePermission) string {
	return ""
}
