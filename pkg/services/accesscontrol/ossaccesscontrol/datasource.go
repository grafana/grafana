package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/accesscontrol/ossaccesscontrol")

// DatasourceQueryActions contains permissions to read information
// about a data source and submit arbitrary queries to it.
var DatasourceQueryActions = []string{
	datasources.ActionRead,
	datasources.ActionQuery,
}

func ProvideDatasourcePermissionsService(settingsProvider setting.SettingsProvider, features featuremgmt.FeatureToggles, db db.DB) *DatasourcePermissionsService {
	return &DatasourcePermissionsService{
		store: resourcepermissions.NewStore(settingsProvider, db, features),
	}
}

var _ accesscontrol.DatasourcePermissionsService = new(DatasourcePermissionsService)

type DatasourcePermissionsService struct {
	store resourcepermissions.Store
}

func (e DatasourcePermissionsService) GetPermissions(ctx context.Context, user identity.Requester, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

func (e DatasourcePermissionsService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole string, resourceID string, permission string) (*accesscontrol.ResourcePermission, error) {
	return nil, nil
}

// SetPermissions sets managed permissions for a datasource in OSS. This ensures that Viewers and Editors maintain query access to a data source
// if an OSS/unlicensed instance is upgraded to Enterprise/licensed.
// https://github.com/grafana/identity-access-team/issues/672
func (e DatasourcePermissionsService) SetPermissions(ctx context.Context, orgID int64, resourceID string, commands ...accesscontrol.SetResourcePermissionCommand) ([]accesscontrol.ResourcePermission, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.SetPermissions")
	defer span.End()

	dbCommands := make([]resourcepermissions.SetResourcePermissionsCommand, 0, len(commands))
	for _, cmd := range commands {
		// Only set query permissions for built-in roles; do not set permissions for data sources with * as UID, as this would grant wildcard permissions
		if cmd.Permission != "Query" || cmd.BuiltinRole == "" || resourceID == "*" {
			continue
		}
		actions := DatasourceQueryActions

		dbCommands = append(dbCommands, resourcepermissions.SetResourcePermissionsCommand{
			BuiltinRole: cmd.BuiltinRole,
			SetResourcePermissionCommand: resourcepermissions.SetResourcePermissionCommand{
				Actions:           actions,
				Resource:          datasources.ScopeRoot,
				ResourceID:        resourceID,
				ResourceAttribute: "uid",
				Permission:        cmd.Permission,
			},
		})
	}

	return e.store.SetResourcePermissions(ctx, orgID, dbCommands, resourcepermissions.ResourceHooks{})
}

func (e DatasourcePermissionsService) DeleteResourcePermissions(ctx context.Context, orgID int64, resourceID string) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.DeleteResourcePermissions")
	defer span.End()

	return e.store.DeleteResourcePermissions(ctx, orgID, &resourcepermissions.DeleteResourcePermissionsCmd{
		Resource:          datasources.ScopeRoot,
		ResourceAttribute: "uid",
		ResourceID:        resourceID,
	})
}

func (e DatasourcePermissionsService) MapActions(permission accesscontrol.ResourcePermission) string {
	return ""
}
