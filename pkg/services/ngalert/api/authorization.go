package api

import (
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

var (
	alertingReader = ac.FixedRolePrefix + "alerting:reader"
	alertingWriter = ac.FixedRolePrefix + "alerting:writer"

	alertingReaderRole = ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        alertingReader,
			DisplayName: "Alerting Rules Reader",
			Description: "Read alerting rules",
			Group:       "Alerting",
			Version:     1,
			Permissions: []ac.Permission{
				{
					Action: ac.ActionAlertingRuleRead,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: ac.ActionAlertingRuleRead,
					Scope:  datasources.ScopeDatasourcesAll,
				},
				{
					Action: ac.ActionAlertingInstanceRead, // scope is the current organization
				},
				{
					Action: ac.ActionAlertingNotificationsRead, // scope is the current organization
				},
			},
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}

	alertingWriterRole = ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        alertingWriter,
			DisplayName: "Alerting Rules Writer",
			Description: "Read and update alerting rules",
			Group:       "Alerting",
			Version:     1,
			Permissions: ac.ConcatPermissions(alertingReaderRole.Role.Permissions, []ac.Permission{
				{
					Action: ac.ActionAlertingRuleCreate,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: ac.ActionAlertingRuleUpdate,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: ac.ActionAlertingRuleDelete,
					Scope:  dashboards.ScopeFoldersAll,
				},
				{
					Action: ac.ActionAlertingRuleCreate,
					Scope:  datasources.ScopeDatasourcesAll,
				},
				{
					Action: ac.ActionAlertingRuleUpdate,
					Scope:  datasources.ScopeDatasourcesAll,
				},
				{
					Action: ac.ActionAlertingRuleDelete,
					Scope:  datasources.ScopeDatasourcesAll,
				},
				{
					Action: ac.ActionAlertingInstanceCreate, // scope is the current organization
				},
				{
					Action: ac.ActionAlertingInstanceUpdate, // scope is the current organization
				},
				{
					Action: ac.ActionAlertingNotificationsCreate, // scope is the current organization
				},
				{
					Action: ac.ActionAlertingNotificationsUpdate, // scope is the current organization
				},
				{
					Action: ac.ActionAlertingNotificationsDelete, // scope is the current organization
				},
			}),
		},
		Grants: []string{string(models.ROLE_EDITOR)},
	}
)

// TODO temporary
func (api *API) isFgacDisabled() bool {
	return api.Cfg.IsFeatureToggleEnabled == nil || !api.Cfg.IsFeatureToggleEnabled("alerting_fgac")
}

// DeclareFixedRoles registers the fixed roles provided by the alerting module
func (api *API) DeclareFixedRoles() error {
	// TODO temporary
	if api.isFgacDisabled() {
		return nil
	}
	return api.AccessControl.DeclareFixedRoles(
		alertingReaderRole, alertingWriterRole,
	)
}

func (api *API) authorize(method, path string) web.Handler {
	// TODO Add fine-grained authorization for every route
	return middleware.ReqSignedIn
}
