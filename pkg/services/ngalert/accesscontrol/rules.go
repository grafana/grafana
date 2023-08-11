package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

// AuthorizeDatasourceAccessForRule checks that user has access to all data sources declared by the rule
func AuthorizeDatasourceAccessForRule(rule *models.AlertRule, evaluator func(evaluator accesscontrol.Evaluator) bool) bool {
	for _, query := range rule.Data {
		if query.QueryType == expr.DatasourceType || query.DatasourceUID == expr.DatasourceUID || query.
			DatasourceUID == expr.OldDatasourceUID {
			continue
		}
		if !evaluator(accesscontrol.EvalPermission(datasources.ActionQuery, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID))) {
			return false
		}
	}
	return true
}

// AuthorizeAccessToRuleGroup checks all rules against AuthorizeDatasourceAccessForRule and exits on the first negative result
func AuthorizeAccessToRuleGroup(rules []*models.AlertRule, evaluator func(evaluator accesscontrol.Evaluator) bool) bool {
	for _, rule := range rules {
		if !AuthorizeDatasourceAccessForRule(rule, evaluator) {
			return false
		}
	}
	return true
}

// AuthorizeRuleChanges analyzes changes in the rule group, and checks whether the changes are authorized.
// NOTE: if there are rules for deletion, and the user does not have access to data sources that a rule uses, the rule is removed from the list.
// If the user is not authorized to perform the changes the function returns ErrAuthorization with a description of what action is not authorized.
// Return changes that the user is authorized to perform or ErrAuthorization
func AuthorizeRuleChanges(change *store.GroupDelta, evaluator func(evaluator accesscontrol.Evaluator) bool) error {
	namespaceScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(change.GroupKey.NamespaceUID)

	rules, ok := change.AffectedGroups[change.GroupKey]
	if ok { // not ok can be when user creates a new rule group or moves existing alerts to a new group
		if !AuthorizeAccessToRuleGroup(rules, evaluator) { // if user is not authorized to do operation in the group that is being changed
			return fmt.Errorf("%w to change group %s because it does not have access to one or many rules in this group", ErrAuthorization, change.GroupKey.RuleGroup)
		}
	} else if len(change.Delete) > 0 {
		// add a safeguard in the case of inconsistency. If user hit this then there is a bug in the calculating of changes struct
		return fmt.Errorf("failed to authorize changes in rule group %s. Detected %d deletes but group was not provided", change.GroupKey.RuleGroup, len(change.Delete))
	}

	if len(change.Delete) > 0 {
		allowed := evaluator(accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleDelete, namespaceScope))
		if !allowed {
			return fmt.Errorf("%w to delete alert rules that belong to folder %s", ErrAuthorization, change.GroupKey.NamespaceUID)
		}
		for _, rule := range change.Delete {
			if !AuthorizeDatasourceAccessForRule(rule, evaluator) {
				return fmt.Errorf("%w to delete an alert rule '%s' because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.UID)
			}
		}
	}

	var addAuthorized, updateAuthorized bool

	if len(change.New) > 0 {
		addAuthorized = evaluator(accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleCreate, namespaceScope))
		if !addAuthorized {
			return fmt.Errorf("%w to create alert rules in the folder %s", ErrAuthorization, change.GroupKey.NamespaceUID)
		}
		for _, rule := range change.New {
			dsAllowed := AuthorizeDatasourceAccessForRule(rule, evaluator)
			if !dsAllowed {
				return fmt.Errorf("%w to create a new alert rule '%s' because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Title)
			}
		}
	}

	for _, rule := range change.Update {
		dsAllowed := AuthorizeDatasourceAccessForRule(rule.New, evaluator)
		if !dsAllowed {
			return fmt.Errorf("%w to update alert rule '%s' (UID: %s) because the user does not have read permissions for one or many datasources the rule uses", ErrAuthorization, rule.Existing.Title, rule.Existing.UID)
		}

		// Check if the rule is moved from one folder to the current. If yes, then the user must have the authorization to delete rules from the source folder and add rules to the target folder.
		if rule.Existing.NamespaceUID != rule.New.NamespaceUID {
			allowed := evaluator(accesscontrol.EvalAll(accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.Existing.NamespaceUID))))
			if !allowed {
				return fmt.Errorf("%w to delete alert rules from folder UID %s", ErrAuthorization, rule.Existing.NamespaceUID)
			}

			if !addAuthorized {
				addAuthorized = evaluator(accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleCreate, namespaceScope))
				if !addAuthorized {
					return fmt.Errorf("%w to create alert rules in the folder '%s'", ErrAuthorization, change.GroupKey.NamespaceUID)
				}
			}
		} else if !updateAuthorized { // if it is false then the authorization was not checked. If it is true then the user is authorized to update rules
			updateAuthorized = evaluator(accesscontrol.EvalPermission(accesscontrol.ActionAlertingRuleUpdate, namespaceScope))
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
			if !AuthorizeAccessToRuleGroup(rules, evaluator) {
				return fmt.Errorf("%w to move rule %s between two different groups because user does not have access to the source group %s", ErrAuthorization, rule.Existing.UID, rule.Existing.RuleGroup)
			}
		}
	}
	return nil
}
