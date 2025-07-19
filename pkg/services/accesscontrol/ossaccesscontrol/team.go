package ossaccesscontrol

import (
	"context"
	"fmt"
	"strconv"

	claims "github.com/grafana/authlib/types"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
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
	zanzanaClient zanzana.Client,
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
		ReaderRoleName: "Permission reader",
		WriterRoleName: "Permission writer",
		RoleGroup:      "Teams",
		OnSetUser: func(ctx context.Context, session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error {
			teamId, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			var legacyError error = nil
			switch permission {
			case "Member":
				legacyError = teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeMember)
			case "Admin":
				legacyError = teamimpl.AddOrUpdateTeamMemberHook(session, user.ID, orgID, teamId, user.IsExternal, team.PermissionTypeAdmin)
			case "":
				legacyError = teamimpl.RemoveTeamMemberHook(session, &team.RemoveTeamMemberCommand{
					OrgID:  orgID,
					UserID: user.ID,
					TeamID: teamId,
				})
			default:
				legacyError = fmt.Errorf("invalid team permission type %s", permission)
			}

			if legacyError != nil {
				return legacyError
			}

			var namespace string
			var zanzanaError error

			// Determine the namespace based on the configuration
			if cfg.StackID != "" {
				stackId, err := strconv.ParseInt(cfg.StackID, 10, 64)
				if err != nil {
					zanzanaError = fmt.Errorf("cannot perform reconciliation, malformed stack id %s: %w", cfg.StackID, err)
				}
				namespace = claims.CloudNamespaceFormatter(stackId)
			} else {
				namespace = claims.CloudNamespaceFormatter(orgID)
			}

			switch permission {
			case "Member":
				zanzanaError = zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
					Namespace: namespace,
					Writes: &authzextv1.WriteRequestWrites{
						TupleKeys: zanzana.ToAuthzExtTupleKeys([]*openfgav1.TupleKey{
							{
								User:     zanzana.NewTupleEntry(zanzana.TypeUser, user.UID, ""),
								Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, resourceID, ""),
								Relation: zanzana.RelationTeamMember,
							},
						}),
					},
				})
			case "Admin":
				zanzanaError = zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
					Namespace: namespace,
					Writes: &authzextv1.WriteRequestWrites{
						TupleKeys: zanzana.ToAuthzExtTupleKeys([]*openfgav1.TupleKey{
							{
								User:     zanzana.NewTupleEntry(zanzana.TypeUser, user.UID, ""),
								Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, resourceID, ""),
								Relation: zanzana.RelationTeamAdmin,
							},
						}),
					},
				})
			case "":
				zanzanaError = zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
					Namespace: namespace,
					Deletes: &authzextv1.WriteRequestDeletes{
						TupleKeys: zanzana.ToAuthzExtTupleKeysWithoutCondition([]*openfgav1.TupleKeyWithoutCondition{
							{
								User:     zanzana.NewTupleEntry(zanzana.TypeUser, user.UID, ""),
								Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, resourceID, ""),
								Relation: zanzana.RelationTeamAdmin,
							},
							{
								User:     zanzana.NewTupleEntry(zanzana.TypeUser, user.UID, ""),
								Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, resourceID, ""),
								Relation: zanzana.RelationTeamMember,
							},
						}),
					},
				})
			}

			if zanzanaError != nil {
				return fmt.Errorf("failed to write zanzana tuple for team %s: %w", resourceID, zanzanaError)
			}

			return nil
		},
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &TeamPermissionsService{srv}, nil
}
