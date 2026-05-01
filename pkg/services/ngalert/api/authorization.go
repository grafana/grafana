package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/web"
)

//nolint:gocyclo
func (api *API) authorize(method, path string) web.Handler {
	authorize := ac.Middleware(api.AccessControl)
	var eval ac.Evaluator = nil

	switch method + path {
	// Alert Rules

	// Grafana Paths
	case http.MethodDelete + "/api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname}",
		http.MethodDelete + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleDelete, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
			ac.EvalPermission(ac.ActionAlertingRuleRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
			ac.EvalPermission(folder.ActionFoldersRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
		)
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
			ac.EvalPermission(folder.ActionFoldersRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
		)
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
			ac.EvalPermission(folder.ActionFoldersRead, folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))),
		)
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules",
		http.MethodGet + "/api/ruler/grafana/api/v1/export/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)
	case http.MethodGet + "/api/ruler/grafana/api/v1/rule/{RuleUID}",
		http.MethodGet + "/api/ruler/grafana/api/v1/rule/{RuleUID}/versions":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalPermission(folder.ActionFoldersRead),
		)
	case http.MethodPost + "/api/ruler/grafana/api/v1/rules/{Namespace}/export":
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))
		// more granular permissions are enforced by the handler via "authorizeRuleChanges"
		eval = ac.EvalAll(ac.EvalPermission(ac.ActionAlertingRuleRead, scope),
			ac.EvalPermission(folder.ActionFoldersRead, scope),
		)
	case http.MethodPost + "/api/ruler/grafana/api/v1/rules/{Namespace}",
		http.MethodPatch + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":Namespace"))
		// more granular permissions are enforced by the handler via "authorizeRuleChanges"
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead, scope),
			ac.EvalPermission(folder.ActionFoldersRead, scope),
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingRuleUpdate, scope),
				ac.EvalPermission(ac.ActionAlertingRuleCreate, scope),
				ac.EvalPermission(ac.ActionAlertingRuleDelete, scope),
			),
		)
	case http.MethodDelete + "/api/ruler/grafana/api/v1/trash/rule/guid/{RuleGUID}":
		return middleware.ReqOrgAdmin

	// Grafana rule state history paths
	case http.MethodGet + "/api/v1/rules/history":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)

	// Grafana, Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/grafana/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)

	// Grafana Rules Testing Paths
	case http.MethodPost + "/api/v1/rule/test/grafana":
		// additional authorization is done in the request handler
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)
	// Grafana Rules Testing Paths
	case http.MethodPost + "/api/v1/rule/backtest": // TODO (yuri) this should be protected by dedicated permission
		// additional authorization is done in the request handler
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingRuleUpdate),
				ac.EvalPermission(ac.ActionAlertingRuleCreate),
			),
		)
	case http.MethodPost + "/api/v1/eval":
		// additional authorization is done in the request handler
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)

	// Lotex Paths
	case http.MethodDelete + "/api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodDelete + "/api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/ruler/{DatasourceUID}/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodPost + "/api/ruler/{DatasourceUID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Lotex Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/{DatasourceUID}/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Lotex Rules testing
	case http.MethodPost + "/api/v1/rule/test/{DatasourceUID}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// convert/prometheus API paths
	case http.MethodGet + "/api/convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group}",
		http.MethodGet + "/api/convert/api/prom/rules/{NamespaceTitle}/{Group}",
		http.MethodGet + "/api/convert/prometheus/config/v1/rules/{NamespaceTitle}",
		http.MethodGet + "/api/convert/api/prom/rules/{NamespaceTitle}":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalPermission(folder.ActionFoldersRead),
		)

	case http.MethodGet + "/api/convert/prometheus/config/v1/rules",
		http.MethodGet + "/api/convert/api/prom/rules":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalPermission(folder.ActionFoldersRead),
		)

	case http.MethodPost + "/api/convert/prometheus/config/v1/rules/{NamespaceTitle}",
		http.MethodPost + "/api/convert/api/prom/rules/{NamespaceTitle}",
		http.MethodPost + "/api/convert/prometheus/config/v1/rules",
		http.MethodPost + "/api/convert/api/prom/rules":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleCreate),
			ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
		)

	case http.MethodDelete + "/api/convert/prometheus/config/v1/rules/{NamespaceTitle}/{Group}",
		http.MethodDelete + "/api/convert/api/prom/rules/{NamespaceTitle}/{Group}",
		http.MethodDelete + "/api/convert/prometheus/config/v1/rules/{NamespaceTitle}",
		http.MethodDelete + "/api/convert/api/prom/rules/{NamespaceTitle}":
		eval = ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalPermission(folder.ActionFoldersRead),
			ac.EvalPermission(ac.ActionAlertingRuleDelete),
			ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
		)

	case http.MethodPost + "/api/convert/api/v1/alerts",
		http.MethodDelete + "/api/convert/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsWrite)
	case http.MethodGet + "/api/convert/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)

	// Alert Instances and Silences

	// Silences for Grafana paths.
	// These permissions are required but not sufficient, further authorization is done in the request handler.
	case http.MethodDelete + "/api/alertmanager/grafana/api/v2/silence/{SilenceId}": // Delete endpoint is used for silence expiration.
		eval = ac.EvalAll(
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceRead),
				ac.EvalPermission(ac.ActionAlertingSilencesRead),
			),
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceUpdate),
				ac.EvalPermission(ac.ActionAlertingSilencesWrite),
			),
		)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/silence/{SilenceId}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingInstanceRead),
			ac.EvalPermission(ac.ActionAlertingSilencesRead),
		)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/silences":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingInstanceRead),
			ac.EvalPermission(ac.ActionAlertingSilencesRead),
		)
	case http.MethodPost + "/api/alertmanager/grafana/api/v2/silences":
		eval = ac.EvalAll(
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceRead),
				ac.EvalPermission(ac.ActionAlertingSilencesRead),
			),
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceCreate),
				ac.EvalPermission(ac.ActionAlertingInstanceUpdate),
				ac.EvalPermission(ac.ActionAlertingSilencesCreate),
				ac.EvalPermission(ac.ActionAlertingSilencesWrite),
			),
		)

	// Alert Instances. Grafana Paths
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/alerts/groups":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)
	case http.MethodPost + "/api/alertmanager/grafana/api/v2/alerts":
		eval = ac.EvalAll(
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceRead),
				ac.EvalPermission(ac.ActionAlertingSilencesRead),
			),
			ac.EvalAny(
				ac.EvalPermission(ac.ActionAlertingInstanceCreate),
				ac.EvalPermission(ac.ActionAlertingInstanceUpdate),
			),
		)

	// Grafana Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/grafana/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)

	// Silences. External AM.
	case http.MethodDelete + "/api/alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceUID}/api/v2/silences":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/api/v2/silences":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Alert instances. External AM.
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/api/v2/alerts/groups":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceUID}/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/{DatasourceUID}/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Notification Policies, Contact Points and Templates

	// Grafana Paths
	case http.MethodGet + "/api/alertmanager/grafana/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsConfigHistoryRead)
	case http.MethodGet + "/api/alertmanager/grafana/config/history":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsConfigHistoryRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/status":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationSystemStatus)
	case http.MethodPost + "/api/alertmanager/grafana/config/history/{id}/_activate":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsConfigHistoryWrite)
	case http.MethodGet + "/api/alertmanager/grafana/config/api/v1/receivers":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingReceiversRead),
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets),
		)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/receivers/test":
		eval = ac.EvalAny(
			accesscontrol.TestReceiversPreconditionEval,
			accesscontrol.TestReceiverNew,
		)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/templates/test":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesTest),
		)

	// External Alertmanager Paths
	case http.MethodDelete + "/api/alertmanager/{DatasourceUID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/api/v2/status":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceUID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceUID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	case http.MethodGet + "/api/v1/ngalert":
		// let user with any alerting permission access this API
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingInstanceRead),
			ac.EvalPermission(ac.ActionAlertingInstancesExternalRead),
			ac.EvalPermission(ac.ActionAlertingRuleRead),
			ac.EvalPermission(ac.ActionAlertingRuleExternalRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead),
		)
	// Raw Alertmanager Config Paths
	case http.MethodDelete + "/api/v1/ngalert/admin_config",
		http.MethodGet + "/api/v1/ngalert/admin_config",
		http.MethodPost + "/api/v1/ngalert/admin_config",
		http.MethodGet + "/api/v1/ngalert/alertmanagers":
		return middleware.ReqOrgAdmin

	// Grafana-only Provisioning Export Paths for everything except contact points.
	case http.MethodGet + "/api/v1/provisioning/policies/export":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),             // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),              // organization scope
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),       // organization scope
			ac.EvalPermission(ac.ActionAlertingRoutesRead),                    // organization scope
		)
	case http.MethodGet + "/api/v1/provisioning/mute-timings/export",
		http.MethodGet + "/api/v1/provisioning/mute-timings/{name}/export":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),              // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),               // organization scope
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead),  // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),        // organization scope
			ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsRead), // organization scope
		)

	// Grafana-only Provisioning Export Paths for contact points.
	case http.MethodGet + "/api/v1/provisioning/contact-points/export":
		perms := []ac.Evaluator{
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),             // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),              // organization scope
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),       // organization scope

			ac.EvalPermission(ac.ActionAlertingReceiversRead),        // fine-grained permissions checked later
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets), // fine-grained permissions checked later
		}
		eval = ac.EvalAny(perms...)

	case http.MethodGet + "/api/v1/provisioning/alert-rules",
		http.MethodGet + "/api/v1/provisioning/alert-rules/export":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalAll( // scopes are enforced in the handler
				ac.EvalPermission(ac.ActionAlertingRuleRead),
				ac.EvalPermission(folder.ActionFoldersRead),
			),
		)
	case http.MethodGet + "/api/v1/provisioning/alert-rules/{UID}",
		http.MethodGet + "/api/v1/provisioning/alert-rules/{UID}/export":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleRead),
				ac.EvalPermission(folder.ActionFoldersRead),
			),
		)

	case http.MethodGet + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}",
		http.MethodGet + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export":
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":FolderUID"))
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleRead, scope),
				ac.EvalPermission(folder.ActionFoldersRead, scope),
			),
		)

	case http.MethodGet + "/api/v1/provisioning/policies":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingRoutesRead),
			ac.EvalPermission(ac.ActionAlertingManagedRoutesRead, models.ScopeRoutesProvider.GetResourceScopeUID(models.DefaultRoutingTreeName)),
		)
	case http.MethodGet + "/api/v1/provisioning/contact-points":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingReceiversRead),
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets),
		)

	case http.MethodGet + "/api/v1/provisioning/templates",
		http.MethodGet + "/api/v1/provisioning/templates/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesRead),
		)
	case http.MethodGet + "/api/v1/provisioning/mute-timings",
		http.MethodGet + "/api/v1/provisioning/mute-timings/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // organization scope
			ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets),
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsRead),
		)

	// Grafana-only Provisioning Write Paths
	case http.MethodPost + "/api/v1/provisioning/alert-rules":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleCreate), // more granular permissions are enforced by the handler via "authorizeRuleChanges"
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPut + "/api/v1/provisioning/alert-rules/{UID}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleUpdate), // more granular permissions are enforced by the handler via "authorizeRuleChanges"
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodDelete + "/api/v1/provisioning/alert-rules/{UID}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleDelete), // more granular permissions are enforced by the handler via "authorizeRuleChanges"
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodDelete + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}":
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":FolderUID"))
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleDelete, scope),
				ac.EvalPermission(ac.ActionAlertingRuleRead, scope),
				ac.EvalPermission(folder.ActionFoldersRead, scope),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPut + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}":
		scope := folder.ScopeFoldersProvider.GetResourceScopeUID(ac.Parameter(":FolderUID"))
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),
			ac.EvalPermission(ac.ActionAlertingRulesProvisioningWrite),
			ac.EvalAll(
				ac.EvalPermission(ac.ActionAlertingRuleRead, scope),
				ac.EvalPermission(folder.ActionFoldersRead, scope),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
				ac.EvalAny( // the exact permissions will be checked after the operations are determined
					ac.EvalPermission(ac.ActionAlertingRuleUpdate, scope),
					ac.EvalPermission(ac.ActionAlertingRuleCreate, scope),
					ac.EvalPermission(ac.ActionAlertingRuleDelete, scope),
				),
			),
		)

	case http.MethodPut + "/api/v1/provisioning/policies":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingRoutesWrite),
					ac.EvalPermission(ac.ActionAlertingManagedRoutesWrite, models.ScopeRoutesProvider.GetResourceScopeUID(models.DefaultRoutingTreeName)),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodDelete + "/api/v1/provisioning/policies":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingRoutesWrite),
					ac.EvalPermission(ac.ActionAlertingManagedRoutesDelete, models.ScopeRoutesProvider.GetResourceScopeUID(models.DefaultRoutingTreeName)),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPost + "/api/v1/provisioning/contact-points":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingReceiversCreate),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPut + "/api/v1/provisioning/contact-points/{UID}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingReceiversUpdate), // fine-grained permission is checked later
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodDelete + "/api/v1/provisioning/contact-points/{UID}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingReceiversDelete), // fine-grained permission is checked later
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPut + "/api/v1/provisioning/templates/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesWrite),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodDelete + "/api/v1/provisioning/templates/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesDelete),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	case http.MethodPost + "/api/v1/provisioning/mute-timings",
		http.MethodPut + "/api/v1/provisioning/mute-timings/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsWrite),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)

	case http.MethodDelete + "/api/v1/provisioning/mute-timings/{name}":
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // organization scope,
			ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // organization scope
			ac.EvalAll(
				ac.EvalAny(
					ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
					ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsDelete),
				),
				ac.EvalPermission(ac.ActionAlertingProvisioningSetStatus),
			),
		)
	}

	if eval != nil {
		return authorize(eval)
	}

	panic(fmt.Sprintf("no authorization handler for method [%s] of endpoint [%s]", method, path))
}
