package resourceservices

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideResourceServices(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store accesscontrol.ResourcePermissionsStore) (*ResourceServices, error) {
	teamPermissions, err := ProvideTeamPermissions(router, sql, ac, store)
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

func (s *ResourceServices) GetTeamService() *resourcepermissions.Service {
	return s.services["teams"]
}

var (
	TeamMemberActions = []string{
		"teams:read",
	}

	TeamAdminActions = []string{
		"teams:read",
		"teams:delete",
		"teams:write",
		"teams.permissions:read",
		"teams.permissions:write",
	}
)

func ProvideTeamPermissions(router routing.RouteRegister, sql *sqlstore.SQLStore, ac accesscontrol.AccessControl, store accesscontrol.ResourcePermissionsStore) (*resourcepermissions.Service, error) {
	options := resourcepermissions.Options{
		Resource:    "teams",
		OnlyManaged: true,
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
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "Member":
				return sql.SaveTeamMember(userID, orgID, teamId, false, 0)
			case "Admin":
				return sql.SaveTeamMember(userID, orgID, teamId, false, models.PERMISSION_ADMIN)
			case "":
				return sql.RemoveTeamMember(orgID, teamId, userID)
			default:
				return fmt.Errorf("invalid team permission type %s", permission)
			}
			return nil
		},
	}

	return resourcepermissions.New(options, router, ac, store)
}
