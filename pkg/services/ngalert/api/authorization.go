package api

import (
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/web"
)

var (
	// Namespaces (aka folder) scopes
	ScopeNamespace     = "namespaces"
	ScopeNamespaceAll  = ac.GetResourceAllScope(ScopeNamespace)
	ScopeNamespaceName = ac.Scope(ScopeNamespace, "title", ac.Parameter(":Namespace"))

	ScopeDatasource     = "datasources"
	ScopeDatasourcesAll = ac.GetResourceAllScope(ScopeDatasource)
	ScopeDatasourceID   = ac.Scope(ScopeDatasource, "id", ac.Parameter(":Recipient"))

	// Alerting rules actions
	ActionAlertingRuleCreate = "alert.rules:create"
	ActionAlertingRuleRead   = "alert.rules:read"
	ActionAlertingRuleUpdate = "alert.rules:update"
	ActionAlertingRuleDelete = "alert.rules:delete"

	// Alerting instances (+silences) actions
	ActionAlertingInstanceCreate = "alert.instances:create"
	ActionAlertingInstanceUpdate = "alert.instances:update"
	ActionAlertingInstanceRead   = "alert.instances:read"

	// Alerting Notification policies actions
	ActionAlertingNotificationsCreate = "alert.notifications:create"
	ActionAlertingNotificationsRead   = "alert.notifications:read"
	ActionAlertingNotificationsUpdate = "alert.notifications:update"
	ActionAlertingNotificationsDelete = "alert.notifications:delete"
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
					Action: ActionAlertingRuleRead,
					Scope:  ScopeNamespaceAll,
				},
				{
					Action: ActionAlertingRuleRead,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionAlertingInstanceRead, // scope is the current organization
				},
				{
					Action: ActionAlertingNotificationsRead, // scope is the current organization
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
					Action: ActionAlertingRuleCreate,
					Scope:  ScopeNamespaceAll,
				},
				{
					Action: ActionAlertingRuleUpdate,
					Scope:  ScopeNamespaceAll,
				},
				{
					Action: ActionAlertingRuleDelete,
					Scope:  ScopeNamespaceAll,
				},
				{
					Action: ActionAlertingRuleCreate,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionAlertingRuleUpdate,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionAlertingRuleDelete,
					Scope:  ScopeDatasourcesAll,
				},
				{
					Action: ActionAlertingInstanceCreate, // scope is the current organization
				},
				{
					Action: ActionAlertingInstanceUpdate, // scope is the current organization
				},
				{
					Action: ActionAlertingNotificationsCreate, // scope is the current organization
				},
				{
					Action: ActionAlertingNotificationsUpdate, // scope is the current organization
				},
				{
					Action: ActionAlertingNotificationsDelete, // scope is the current organization
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
