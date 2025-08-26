package ossaccesscontrol

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/retriever"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ServiceAccountEditActions = []string{
		serviceaccounts.ActionRead,
		serviceaccounts.ActionWrite,
	}
	ServiceAccountAdminActions = []string{
		serviceaccounts.ActionRead,
		serviceaccounts.ActionWrite,
		serviceaccounts.ActionDelete,
		serviceaccounts.ActionPermissionsRead,
		serviceaccounts.ActionPermissionsWrite,
	}
)

type ServiceAccountPermissionsService struct {
	*resourcepermissions.Service
}

func ProvideServiceAccountPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, serviceAccountRetrieverService *retriever.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*ServiceAccountPermissionsService, error) {
	options := resourcepermissions.Options{
		Resource:           "serviceaccounts",
		ResourceAttribute:  "id",
		ResourceTranslator: serviceaccounts.UIDToIDHandler(serviceAccountRetrieverService),
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.ProvideServiceAccountPermissions.ResourceValidator")
			defer span.End()

			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			_, err = serviceAccountRetrieverService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{
				OrgID: orgID,
				ID:    id,
			})
			return err
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        true,
			BuiltInRoles: false,
		},
		PermissionsToActions: map[string][]string{
			"Edit":  ServiceAccountEditActions,
			"Admin": ServiceAccountAdminActions,
		},
		ReaderRoleName: "Permission reader",
		WriterRoleName: "Permission writer",
		RoleGroup:      "Service accounts",
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &ServiceAccountPermissionsService{srv}, nil
}
