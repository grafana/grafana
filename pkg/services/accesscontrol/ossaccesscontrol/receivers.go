package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/ngalert"
	alertingac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var ReceiversViewActions = []string{accesscontrol.ActionAlertingReceiversRead}
var ReceiversEditActions = append(ReceiversViewActions, []string{accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversDelete}...)
var ReceiversAdminActions = append(ReceiversEditActions, []string{accesscontrol.ActionAlertingReceiversReadSecrets, accesscontrol.ActionAlertingReceiversPermissionsRead, accesscontrol.ActionAlertingReceiversPermissionsWrite}...)

func ProvideReceiverPermissionsService(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
) (*ReceiverPermissionsService, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAlertingApiServer) {
		return nil, nil
	}

	options := resourcepermissions.Options{
		Resource:          "receivers",
		ResourceAttribute: "uid",
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			string(alertingac.ReceiverPermissionView):  append([]string{}, ReceiversViewActions...),
			string(alertingac.ReceiverPermissionEdit):  append([]string{}, ReceiversEditActions...),
			string(alertingac.ReceiverPermissionAdmin): append([]string{}, ReceiversAdminActions...),
		},
		ReaderRoleName: "Alerting receiver permission reader",
		WriterRoleName: "Alerting receiver permission writer",
		RoleGroup:      ngalert.AlertRolesGroup,
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &ReceiverPermissionsService{Service: srv}, nil
}

var _ accesscontrol.ReceiverPermissionsService = new(ReceiverPermissionsService)

type ReceiverPermissionsService struct {
	*resourcepermissions.Service
}
