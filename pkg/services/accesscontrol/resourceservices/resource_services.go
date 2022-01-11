package resourceservices

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideResourceServices(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store accesscontrol.ResourcePermissionsStore) (*ResourceServices, error) {
	teamPermissions, err := provideTeamPermissions(router, ac, store)
	if err != nil {
		return nil, err
	}

	return &ResourceServices{services: map[string]*resourcepermissions.Service{
		"teams": teamPermissions,
	}}, nil
}

type ResourceServices struct {
	services map[string]*resourcepermissions.Service
}

var (
	// probably should contain team reader action
	TeamMemberActions = []string{
		"teams:read",
	}

	TeamAdminActions = []string{
		"teams:create",
		"teams:delete",
		"teams:read",
		"teams:write",
		// "teams.members:remove",
		// "teams.members:add",
		// "teams.members:read",
		"teams.permissions:read",
		"teams.permissions:write",
	}
)

func provideTeamPermissions(router routing.RouteRegister, ac accesscontrol.AccessControl, store accesscontrol.ResourcePermissionsStore) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource:    "teams",
		OnlyManaged: false,
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}

			err = sqlstore.GetTeamById(context.Background(), &models.GetTeamByIdQuery{
				OrgId: orgID,
				Id:    id,
			})
			if err != nil {
				return err
			}

			return nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        false,
			BuiltInRoles: false,
		},
		PermissionsToActions: map[string][]string{
			"Member": TeamMemberActions,
			"Admin":  TeamAdminActions,
		},
		ReaderRoleName: "Team permission reader",
		WriterRoleName: "Team permission writer",
		RoleGroup:      "Teams",
		OnSetUser: func(ctx context.Context, orgID, userID int64, resourceID, permission string) error {
			switch permission {
			case "":
				// call handler remove user from team
			case "Member":
				// call handler to add member
			case "Admin":
				// call handler to add admin
			}
			return nil
		},
	}

	return resourcepermissions.New(options, router, ac, store)
}
