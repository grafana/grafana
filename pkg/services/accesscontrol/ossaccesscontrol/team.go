package ossaccesscontrol

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type TeamPermissionsService struct {
	*resourcepermissions.Service
}

var (
	TeamMemberActions = []string{
		accesscontrol.ActionTeamsRead,
	}

	TeamAdminActions = []string{
		accesscontrol.ActionTeamsRead,
		accesscontrol.ActionTeamsDelete,
		accesscontrol.ActionTeamsWrite,
		accesscontrol.ActionTeamsPermissionsRead,
		accesscontrol.ActionTeamsPermissionsWrite,
	}
)

func ProvideTeamPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB,
	ac accesscontrol.AccessControl, license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*TeamPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:           "teams",
		ResourceAttribute:  "id",
		OnlyManaged:        true,
		ResourceTranslator: team.UIDToIDHandler(teamService),
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.ProvideTeamerPermissions.ResourceValidator")
			defer span.End()

			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}

			existingTeam, err := teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
				OrgID: orgID,
				ID:    id,
			})
			if err != nil {
				return err
			}

			if existingTeam.IsProvisioned {
				return errors.New("team permissions cannot be updated for provisioned teams")
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
		ReaderRoleName: "Permission reader",
		WriterRoleName: "Permission writer",
		RoleGroup:      "Teams",
		OnSetUser: func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error {
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			switch permission {
			case "Member":
				return teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeMember)
			case "Admin":
				return teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeAdmin)
			case "":
				return teamimpl.RemoveTeamMemberHook(session, &team.RemoveTeamMemberCommand{
					OrgID:  orgID,
					UserID: user.ID,
					TeamID: teamId,
				})
			default:
				return fmt.Errorf("invalid team permission type %s", permission)
			}
		},
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &TeamPermissionsService{srv}, nil
}
