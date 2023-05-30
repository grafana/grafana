package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/web"
)

var (
	ErrAuthorization = errors.New("user is not authorized")
)

//nolint:gocyclo
func (api *API) authorize(method, path string) web.Handler {
	authorize := ac.Middleware(api.AccessControl)
	var eval ac.Evaluator = nil

	switch method + path {
	// Alert Rules

	// Grafana Paths
	case http.MethodDelete + "/api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeName(ac.Parameter(":Namespace")))
	case http.MethodDelete + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeName(ac.Parameter(":Namespace")))
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead, dashboards.ScopeFoldersProvider.GetResourceScopeName(ac.Parameter(":Namespace")))
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead, dashboards.ScopeFoldersProvider.GetResourceScopeName(ac.Parameter(":Namespace")))
	case http.MethodGet + "/api/ruler/grafana/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)
	case http.MethodPost + "/api/ruler/grafana/api/v1/rules/{Namespace}":
		scope := dashboards.ScopeFoldersProvider.GetResourceScopeName(ac.Parameter(":Namespace"))
		// more granular permissions are enforced by the handler via "authorizeRuleChanges"
		eval = ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingRuleUpdate, scope),
			ac.EvalPermission(ac.ActionAlertingRuleCreate, scope),
			ac.EvalPermission(ac.ActionAlertingRuleDelete, scope),
		)
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
	case http.MethodPost + "/api/v1/rule/backtest":
		// additional authorization is done in the request handler
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)
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
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Lotex Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/{DatasourceUID}/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Lotex Rules testing
	case http.MethodPost + "/api/v1/rule/test/{DatasourceUID}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScopeUID(ac.Parameter(":DatasourceUID")))

	// Alert Instances and Silences

	// Silences. Grafana Paths
	case http.MethodDelete + "/api/alertmanager/grafana/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceUpdate) // delete endpoint actually expires silence
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/silences":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)
	case http.MethodPost + "/api/alertmanager/grafana/api/v2/silences":
		// additional authorization is done in the request handler
		eval = ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceCreate), ac.EvalPermission(ac.ActionAlertingInstanceUpdate))

	// Alert Instances. Grafana Paths
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/alerts/groups":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)

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
	case http.MethodDelete + "/api/alertmanager/grafana/config/api/v1/alerts": // reset alertmanager config to the default
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsWrite)
	case http.MethodGet + "/api/alertmanager/grafana/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodGet + "/api/alertmanager/grafana/config/history":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/status":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/alerts":
		// additional authorization is done in the request handler
		eval = ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsWrite))
	case http.MethodPost + "/api/alertmanager/grafana/config/history/{id}/_activate":
		eval = ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsWrite))
	case http.MethodGet + "/api/alertmanager/grafana/config/api/v1/receivers":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/receivers/test":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsWrite)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/templates/test":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsWrite)

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

	// Grafana-only Provisioning Read Paths
	case http.MethodGet + "/api/v1/provisioning/policies",
		http.MethodGet + "/api/v1/provisioning/contact-points",
		http.MethodGet + "/api/v1/provisioning/templates",
		http.MethodGet + "/api/v1/provisioning/templates/{name}",
		http.MethodGet + "/api/v1/provisioning/mute-timings",
		http.MethodGet + "/api/v1/provisioning/mute-timings/{name}",
		http.MethodGet + "/api/v1/provisioning/alert-rules",
		http.MethodGet + "/api/v1/provisioning/alert-rules/{UID}",
		http.MethodGet + "/api/v1/provisioning/alert-rules/export",
		http.MethodGet + "/api/v1/provisioning/alert-rules/{UID}/export",
		http.MethodGet + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}",
		http.MethodGet + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}/export":
		eval = ac.EvalPermission(ac.ActionAlertingProvisioningRead) // organization scope

	case http.MethodPut + "/api/v1/provisioning/policies",
		http.MethodDelete + "/api/v1/provisioning/policies",
		http.MethodPost + "/api/v1/provisioning/contact-points",
		http.MethodPut + "/api/v1/provisioning/contact-points/{UID}",
		http.MethodDelete + "/api/v1/provisioning/contact-points/{UID}",
		http.MethodPut + "/api/v1/provisioning/templates/{name}",
		http.MethodDelete + "/api/v1/provisioning/templates/{name}",
		http.MethodPost + "/api/v1/provisioning/mute-timings",
		http.MethodPut + "/api/v1/provisioning/mute-timings/{name}",
		http.MethodDelete + "/api/v1/provisioning/mute-timings/{name}",
		http.MethodPost + "/api/v1/provisioning/alert-rules",
		http.MethodPut + "/api/v1/provisioning/alert-rules/{UID}",
		http.MethodDelete + "/api/v1/provisioning/alert-rules/{UID}",
		http.MethodPut + "/api/v1/provisioning/folder/{FolderUID}/rule-groups/{Group}":
		eval = ac.EvalPermission(ac.ActionAlertingProvisioningWrite) // organization scope
	}

	if eval != nil {
		return authorize(eval)
	}

	panic(fmt.Sprintf("no authorization handler for method [%s] of endpoint [%s]", method, path))
}

// authorizeDatasourceAccessForRule checks that user has access to all data sources declared by the rule
func authorizeDatasourceAccessForRule(rule *ngmodels.AlertRule, evaluator func(evaluator ac.Evaluator) bool) bool {
	for _, query := range rule.Data {
		if query.QueryType == expr.DatasourceType || query.DatasourceUID == expr.DatasourceUID || query.
			DatasourceUID == expr.
			OldDatasourceUID {
			continue
		}
		if !evaluator(ac.EvalPermission(datasources.ActionQuery, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))) {
			return false
		}
	}
	return true
}

// authorizeAccessToRuleGroup checks all rules against authorizeDatasourceAccessForRule and exits on the first negative result
func authorizeAccessToRuleGroup(rules []*ngmodels.AlertRule, evaluator func(evaluator ac.Evaluator) bool) bool {
	for _, rule := range rules {
		if !authorizeDatasourceAccessForRule(rule, evaluator) {
			return false
		}
	}
	return true
}

// authorizeRuleChanges analyzes changes in the rule group, and checks whether the changes are authorized.
// NOTE: if there are rules for deletion, and the user does not have access to data sources that a rule uses, the rule is removed from the list.
// If the user is not authorized to perform the changes the function returns ErrAuthorization with a description of what action is not authorized.
// Return changes that the user is authorized to perform or ErrAuthorization
func authorizeRuleChanges(change *store.GroupDelta, evaluator func(evaluator ac.Evaluator) bool) error {
	namespaceScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(change.GroupKey.NamespaceUID)

	rules, ok := change.AffectedGroups[change.GroupKey]
	if ok { // not ok can be when user creates a new rule group or moves existing alerts to a new group
		if !authorizeAccessToRuleGroup(rules, evaluator) { // if user is not authorized to do operation in the group that is being changed
			return fmt.Errorf("%w to change group %s because it does not have access to one or many rules in this group", ErrAuthorization, change.GroupKey.RuleGroup)
		}
	} else if len(change.Delete) > 0 {
		// add a safeguard in the case of inconsistency. If user hit this then there is a bug in the calculating of changes struct
		return fmt.Errorf("failed to authorize changes in rule group %s. Detected %d deletes but group was not provided", change.GroupKey.RuleGroup, len(change.Delete))
	}

	if len(change.Delete) > 0 {
		allowed := evaluator(ac.EvalPermission(ac.ActionAlertingRuleDelete, namespaceScope))
		if !allowed {
			return fmt.Errorf("%w to delete alert rules that belong to folder %s", ErrAuthorization, change.GroupKey.NamespaceUID)
		}
		for _, rule := range change.Delete {
			if !authorizeDatasourceAccessForRule(rule, evaluator) {
				return fmt.Errorf("%w to delete an alert rule '%s' because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.UID)
			}
		}
	}

	var addAuthorized, updateAuthorized bool

	if len(change.New) > 0 {
		addAuthorized = evaluator(ac.EvalPermission(ac.ActionAlertingRuleCreate, namespaceScope))
		if !addAuthorized {
			return fmt.Errorf("%w to create alert rules in the folder %s", ErrAuthorization, change.GroupKey.NamespaceUID)
		}
		for _, rule := range change.New {
			dsAllowed := authorizeDatasourceAccessForRule(rule, evaluator)
			if !dsAllowed {
				return fmt.Errorf("%w to create a new alert rule '%s' because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Title)
			}
		}
	}

	for _, rule := range change.Update {
		dsAllowed := authorizeDatasourceAccessForRule(rule.New, evaluator)
		if !dsAllowed {
			return fmt.Errorf("%w to update alert rule '%s' (UID: %s) because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Existing.Title, rule.Existing.UID)
		}

		// Check if the rule is moved from one folder to the current. If yes, then the user must have the authorization to delete rules from the source folder and add rules to the target folder.
		if rule.Existing.NamespaceUID != rule.New.NamespaceUID {
			allowed := evaluator(ac.EvalAll(ac.EvalPermission(ac.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.Existing.NamespaceUID))))
			if !allowed {
				return fmt.Errorf("%w to delete alert rules from folder UID %s", ErrAuthorization, rule.Existing.NamespaceUID)
			}

			if !addAuthorized {
				addAuthorized = evaluator(ac.EvalPermission(ac.ActionAlertingRuleCreate, namespaceScope))
				if !addAuthorized {
					return fmt.Errorf("%w to create alert rules in the folder '%s'", ErrAuthorization, change.GroupKey.NamespaceUID)
				}
			}
		} else if !updateAuthorized { // if it is false then the authorization was not checked. If it is true then the user is authorized to update rules
			updateAuthorized = evaluator(ac.EvalPermission(ac.ActionAlertingRuleUpdate, namespaceScope))
			if !updateAuthorized {
				return fmt.Errorf("%w to update alert rules that belong to folder %s", ErrAuthorization, change.GroupKey.NamespaceUID)
			}
		}

		if rule.Existing.NamespaceUID != rule.New.NamespaceUID || rule.Existing.RuleGroup != rule.New.RuleGroup {
			key := rule.Existing.GetGroupKey()
			rules, ok = change.AffectedGroups[key]
			if !ok {
				// add a safeguard in the case of inconsistency. If user hit this then there is a bug in the calculating of changes struct
				return fmt.Errorf("failed to authorize moving an alert rule %s between groups because unable to check access to group %s from which the rule is moved", rule.Existing.UID, rule.Existing.RuleGroup)
			}
			if !authorizeAccessToRuleGroup(rules, evaluator) {
				return fmt.Errorf("%w to move rule %s between two different groups because user does not have access to the source group %s", ErrAuthorization, rule.Existing.UID, rule.Existing.RuleGroup)
			}
		}
	}
	return nil
}
