package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/web"
)

var (
	ErrAuthorization = errors.New("user is not authorized")
)

//nolint:gocyclo
func (api *API) authorize(method, path string) web.Handler {
	authorize := ac.Middleware(api.AccessControl)
	var eval ac.Evaluator = nil

	// Most routes follow this general authorization approach as a fallback. Exceptions are overridden directly in the below block.
	var fallback web.Handler
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodDelete:
		fallback = middleware.ReqEditorRole
	case http.MethodGet:
		fallback = middleware.ReqSignedIn
	default:
		fallback = middleware.ReqSignedIn
	}

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

	// Grafana, Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/grafana/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)

	// Grafana Rules Testing Paths
	case http.MethodPost + "/api/v1/rule/test/grafana":
		fallback = middleware.ReqSignedIn
		// additional authorization is done in the request handler
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)
	case http.MethodPost + "/api/v1/eval":
		fallback = middleware.ReqSignedIn
		// additional authorization is done in the request handler
		eval = ac.EvalPermission(ac.ActionAlertingRuleRead)

	// Lotex Paths
	case http.MethodDelete + "/api/ruler/{DatasourceID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodDelete + "/api/ruler/{DatasourceID}/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/ruler/{DatasourceID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/ruler/{DatasourceID}/api/v1/rules/{Namespace}/{Groupname}":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/ruler/{DatasourceID}/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodPost + "/api/ruler/{DatasourceID}/api/v1/rules/{Namespace}":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Lotex Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/{DatasourceID}/api/v1/rules":
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Lotex Rules testing
	case http.MethodPost + "/api/v1/rule/test/{DatasourceID}":
		fallback = middleware.ReqSignedIn
		eval = ac.EvalPermission(ac.ActionAlertingRuleExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

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
	case http.MethodPost + "/api/alertmanager/grafana/api/v2/alerts":
		eval = ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceCreate), ac.EvalPermission(ac.ActionAlertingInstanceUpdate))

	// Grafana Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/grafana/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstanceRead)

	// Silences. External AM.
	case http.MethodDelete + "/api/alertmanager/{DatasourceID}/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceID}/api/v2/silences":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/api/v2/silence/{SilenceId}":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/api/v2/silences":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Alert instances. External AM.
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/api/v2/alerts/groups":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceID}/api/v2/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Prometheus-compatible Paths
	case http.MethodGet + "/api/prometheus/{DatasourceID}/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingInstancesExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Notification Policies, Contact Points and Templates

	// Grafana Paths
	case http.MethodDelete + "/api/alertmanager/grafana/config/api/v1/alerts": // reset alertmanager config to the default
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsDelete)
	case http.MethodGet + "/api/alertmanager/grafana/config/api/v1/alerts":
		fallback = middleware.ReqEditorRole
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodGet + "/api/alertmanager/grafana/api/v2/status":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/alerts":
		// additional authorization is done in the request handler
		eval = ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsUpdate), ac.EvalPermission(ac.ActionAlertingNotificationsCreate), ac.EvalPermission(ac.ActionAlertingNotificationsDelete))
	case http.MethodPost + "/api/alertmanager/grafana/config/api/v1/receivers/test":
		fallback = middleware.ReqEditorRole
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsRead)

	// External Alertmanager Paths
	case http.MethodDelete + "/api/alertmanager/{DatasourceID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsDelete, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/api/v2/status":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodGet + "/api/alertmanager/{DatasourceID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceID}/config/api/v1/alerts":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalWrite, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))
	case http.MethodPost + "/api/alertmanager/{DatasourceID}/config/api/v1/receivers/test":
		eval = ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead, datasources.ScopeProvider.GetResourceScope(ac.Parameter(":DatasourceID")))

	// Raw Alertmanager Config Paths
	case http.MethodDelete + "/api/v1/ngalert/admin_config",
		http.MethodGet + "/api/v1/ngalert/admin_config",
		http.MethodPost + "/api/v1/ngalert/admin_config",
		http.MethodGet + "/api/v1/ngalert/alertmanagers":
		return middleware.ReqOrgAdmin

	// Grafana-only Provisioning Read Paths
	case http.MethodGet + "/api/provisioning/policies",
		http.MethodGet + "/api/provisioning/contact-points",
		http.MethodGet + "/api/provisioning/templates",
		http.MethodGet + "/api/provisioning/templates/{ID}":
		return middleware.ReqSignedIn

	case http.MethodPost + "/api/provisioning/policies",
		http.MethodPost + "/api/provisioning/contact-points",
		http.MethodPut + "/api/provisioning/contact-points",
		http.MethodDelete + "/api/provisioning/contact-points/{ID}":
		return middleware.ReqEditorRole
	}

	if eval != nil {
		return authorize(fallback, eval)
	}

	panic(fmt.Sprintf("no authorization handler for method [%s] of endpoint [%s]", method, path))
}

// authorizeDatasourceAccessForRule checks that user has access to all data sources declared by the rule
func authorizeDatasourceAccessForRule(rule *ngmodels.AlertRule, evaluator func(evaluator ac.Evaluator) bool) bool {
	for _, query := range rule.Data {
		if query.QueryType == expr.DatasourceType || query.DatasourceUID == expr.OldDatasourceUID {
			continue
		}
		if !evaluator(ac.EvalPermission(datasources.ActionQuery, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))) {
			return false
		}
	}
	return true
}

// authorizeRuleChanges analyzes changes in the rule group, and checks whether the changes are authorized.
// NOTE: if there are rules for deletion, and the user does not have access to data sources that a rule uses, the rule is removed from the list.
// If the user is not authorized to perform the changes the function returns ErrAuthorization with a description of what action is not authorized.
// Return changes that the user is authorized to perform or ErrAuthorization
func authorizeRuleChanges(namespace *models.Folder, change *changes, evaluator func(evaluator ac.Evaluator) bool) (*changes, error) {
	var result = &changes{
		New:    change.New,
		Update: change.Update,
		Delete: change.Delete,
	}

	namespaceScope := dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(namespace.Id, 10))
	if len(change.Delete) > 0 {
		var allowedToDelete []*ngmodels.AlertRule
		for _, rule := range change.Delete {
			dsAllowed := authorizeDatasourceAccessForRule(rule, evaluator)
			if dsAllowed {
				allowedToDelete = append(allowedToDelete, rule)
			}
		}
		if len(allowedToDelete) > 0 {
			allowed := evaluator(ac.EvalPermission(ac.ActionAlertingRuleDelete, namespaceScope))
			if !allowed {
				return nil, fmt.Errorf("%w to delete alert rules that belong to folder %s", ErrAuthorization, namespace.Title)
			}
		}
		result.Delete = allowedToDelete
	}

	var addAuthorized, updateAuthorized bool

	if len(change.New) > 0 {
		addAuthorized = evaluator(ac.EvalPermission(ac.ActionAlertingRuleCreate, namespaceScope))
		if !addAuthorized {
			return nil, fmt.Errorf("%w to create alert rules in the folder %s", ErrAuthorization, namespace.Title)
		}
		for _, rule := range change.New {
			dsAllowed := authorizeDatasourceAccessForRule(rule, evaluator)
			if !dsAllowed {
				return nil, fmt.Errorf("%w to create a new alert rule '%s' because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Title)
			}
		}
	}

	for _, rule := range change.Update {
		dsAllowed := authorizeDatasourceAccessForRule(rule.New, evaluator)
		if !dsAllowed {
			return nil, fmt.Errorf("%w to update alert rule '%s' (UID: %s) because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Existing.Title, rule.Existing.UID)
		}

		// Check if the rule is moved from one folder to the current. If yes, then the user must have the authorization to delete rules from the source folder and add rules to the target folder.
		if rule.Existing.NamespaceUID != rule.New.NamespaceUID {
			allowed := evaluator(ac.EvalAll(ac.EvalPermission(ac.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.Existing.NamespaceUID))))
			if !allowed {
				return nil, fmt.Errorf("%w to delete alert rules from folder UID %s", ErrAuthorization, rule.Existing.NamespaceUID)
			}

			if !addAuthorized {
				addAuthorized = evaluator(ac.EvalPermission(ac.ActionAlertingRuleCreate, namespaceScope))
				if !addAuthorized {
					return nil, fmt.Errorf("%w to create alert rules in the folder '%s'", ErrAuthorization, namespace.Title)
				}
			}
			continue
		}

		if !updateAuthorized { // if it is false then the authorization was not checked. If it is true then the user is authorized to update rules
			updateAuthorized = evaluator(ac.EvalAll(ac.EvalPermission(ac.ActionAlertingRuleUpdate, namespaceScope)))
			if !updateAuthorized {
				return nil, fmt.Errorf("%w to update alert rules that belong to folder %s", ErrAuthorization, namespace.Title)
			}
		}
	}
	return result, nil
}
