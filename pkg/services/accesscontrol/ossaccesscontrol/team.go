package ossaccesscontrol

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
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

// TeamPermissionsRoleRegistrations returns the templated reader/writer fixed
// roles for team resource permissions (fixed:teams.permissions:reader and
// :writer). These mirror the roles declared by ProvideTeamPermissions through
// resourcepermissions.New; the identity fields below must match the Options
// passed there.
func TeamPermissionsRoleRegistrations() []accesscontrol.RoleRegistration {
	return resourcepermissions.FixedRoleRegistrations(resourcepermissions.Options{
		Resource:       teamPermissionsResource,
		ReaderRoleName: permissionReaderRoleName,
		WriterRoleName: permissionWriterRoleName,
		RoleGroup:      teamPermissionsRoleGroup,
	})
}

func ProvideTeamPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB,
	iamFeatures iamapi.Features,
	ac accesscontrol.AccessControl, license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, serviceAccountRetriever serviceaccounts.ServiceAccountRetriever,
	actionSetService resourcepermissions.ActionSetService,
	directRestConfigProvider apiserver.DirectRestConfigProvider,
	legacyWatch *legacywatch.Publisher,
) (*TeamPermissionsService, error) {
	// The hooks below run inside transactions that resourcepermissions opens on sql,
	// so their table names must resolve for that same database. Deriving the helper
	// from sql keeps the two in step.
	dbHelper, err := legacysql.NewDatabaseProvider(sql)(context.Background())
	if err != nil {
		return nil, err
	}

	options := resourcepermissions.Options{
		Resource:           teamPermissionsResource,
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

			_, err = teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
				OrgID: orgID,
				ID:    id,
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
		ReaderRoleName: permissionReaderRoleName,
		WriterRoleName: permissionWriterRoleName,
		RoleGroup:      teamPermissionsRoleGroup,
		OnSetUser: func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error {
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			// Read the membership's names before the change: a removal deletes them.
			// Announcing is best effort, so a failed lookup skips it rather than
			// failing the permission write.
			announce := legacyWatch.Enabled()
			var before teamimpl.TeamMemberRef
			if announce {
				var lookupErr error
				if before, lookupErr = teamimpl.GetTeamMemberRef(dbHelper, session, orgID, teamId, user.ID); lookupErr != nil {
					announce = false
				}
			}
			switch permission {
			case "Member":
				err = teamimpl.AddOrUpdateTeamMemberHook(dbHelper, session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeMember)
			case "Admin":
				err = teamimpl.AddOrUpdateTeamMemberHook(dbHelper, session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeAdmin)
			case "":
				err = teamimpl.RemoveTeamMemberHook(dbHelper, session, &team.RemoveTeamMemberCommand{
					OrgID:  orgID,
					UserID: user.ID,
					TeamID: teamId,
				})
			default:
				return fmt.Errorf("invalid team permission type %s", permission)
			}
			if err != nil || !announce {
				return err
			}
			if after, lookupErr := teamimpl.GetTeamMemberRef(dbHelper, session, orgID, teamId, user.ID); lookupErr == nil {
				teamimpl.QueueTeamMemberNotifications(session, orgID, before, after)
			}
			return nil
		},
		RestConfigProvider: directRestConfigProvider,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, serviceAccountRetriever, actionSetService, iamFeatures)
	if err != nil {
		return nil, err
	}
	return &TeamPermissionsService{srv}, nil
}
