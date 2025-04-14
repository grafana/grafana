package accesscontrol

import (
	"fmt"
	"slices"

	"golang.org/x/net/context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

const (
	ruleCreate = accesscontrol.ActionAlertingRuleCreate
	ruleRead   = accesscontrol.ActionAlertingRuleRead
	ruleUpdate = accesscontrol.ActionAlertingRuleUpdate
	ruleDelete = accesscontrol.ActionAlertingRuleDelete
)

type RuleService struct {
	genericService
	notificationSettingsAuth notificationSettingsAuth
}

type notificationSettingsAuth interface {
	AuthorizeRead(context.Context, identity.Requester, *models.NotificationSettings) error
}

func NewRuleService(ac accesscontrol.AccessControl) *RuleService {
	return &RuleService{
		genericService:           genericService{ac: ac},
		notificationSettingsAuth: NewReceiverAccess[*models.NotificationSettings](ac, true),
	}
}

// getReadFolderAccessEvaluator constructs accesscontrol.Evaluator that checks all permissions required to read rules in  specific folder
func getReadFolderAccessEvaluator(folderUID string) accesscontrol.Evaluator {
	return accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ruleRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)),
		accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)),
	)
}

// getRulesReadEvaluator constructs accesscontrol.Evaluator that checks all permissions required to access provided rules
func (r *RuleService) getRulesReadEvaluator(rules ...*models.AlertRule) accesscontrol.Evaluator {
	added := make(map[string]struct{}, 1)
	evals := make([]accesscontrol.Evaluator, 0, 1)
	for _, rule := range rules {
		if _, ok := added[rule.NamespaceUID]; ok {
			continue
		}
		added[rule.NamespaceUID] = struct{}{}
		evals = append(evals, getReadFolderAccessEvaluator(rule.NamespaceUID))
	}
	return accesscontrol.EvalAll(evals...)
}

// getRulesQueryEvaluator constructs accesscontrol.Evaluator that checks all permissions to query data sources used by the provided rules
func (r *RuleService) getRulesQueryEvaluator(rules ...*models.AlertRule) accesscontrol.Evaluator {
	added := make(map[string]struct{}, 2)
	evals := make([]accesscontrol.Evaluator, 0, 2)
	for _, rule := range rules {
		for _, query := range rule.Data {
			if query.QueryType == expr.DatasourceType || query.DatasourceUID == expr.DatasourceUID || query.
				DatasourceUID == expr.OldDatasourceUID {
				continue
			}
			if _, ok := added[query.DatasourceUID]; ok {
				continue
			}
			evals = append(evals, accesscontrol.EvalPermission(datasources.ActionQuery, datasources.ScopeProvider.GetResourceScopeUID(query.DatasourceUID)))
			added[query.DatasourceUID] = struct{}{}
		}
	}
	if len(evals) == 1 {
		return evals[0]
	}
	return accesscontrol.EvalAll(evals...)
}

// CanReadAllRules returns true when user has access to all folders and can read rules in them.
func (r *RuleService) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	return r.HasAccess(ctx, user, accesscontrol.EvalAll(
		accesscontrol.EvalPermission(ruleRead, dashboards.ScopeFoldersProvider.GetResourceAllScope()),
		accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceAllScope()),
	))
}

// AuthorizeDatasourceAccessForRule checks that user has access to all data sources declared by the rule
func (r *RuleService) AuthorizeDatasourceAccessForRule(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	ds := r.getRulesQueryEvaluator(rule)
	return r.HasAccessOrError(ctx, user, ds, func() string {
		suffix := ""
		if rule.UID != "" {
			suffix = fmt.Sprintf(" of the rule UID '%s'", rule.UID)
		}
		return fmt.Sprintf("access one or many data sources%s", suffix)
	})
}

// AuthorizeDatasourceAccessForRuleGroup checks that user has access to all data sources declared by the rules in the group
func (r *RuleService) AuthorizeDatasourceAccessForRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	ds := r.getRulesQueryEvaluator(rules...)
	return r.HasAccessOrError(ctx, user, ds, func() string {
		return fmt.Sprintf("access data sources for the rule group '%s'", rules[0].RuleGroup)
	})
}

// HasAccessToRuleGroup checks that the identity.Requester has permissions to all rules, which means that it has permissions to:
// - ("folders:read") read folders which contain the rules
// - ("alert.rules:read") read alert rules in the folders
// Returns false if the requester does not have enough permissions, and error if something went wrong during the permission evaluation.
func (r *RuleService) HasAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) (bool, error) {
	eval := r.getRulesReadEvaluator(rules...)
	return r.HasAccess(ctx, user, eval)
}

// AuthorizeAccessToRuleGroup checks that the identity.Requester has permissions to all rules, which means that it has permissions to:
// - ("folders:read") read folders which contain the rules
// - ("alert.rules:read") read alert rules in the folders
// Returns error if at least one permission is missing or if something went wrong during the permission evaluation
func (r *RuleService) AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	eval := r.getRulesReadEvaluator(rules...)
	return r.HasAccessOrError(ctx, user, eval, func() string {
		var groupName, folderUID string
		if len(rules) > 0 {
			groupName = rules[0].RuleGroup
			folderUID = rules[0].NamespaceUID
		}
		return fmt.Sprintf("access rule group '%s' in folder '%s'", groupName, folderUID)
	})
}

// HasAccessInFolder checks that the identity.Requester has permissions to read alert rules in the given folder,
// which requires the following permissions:
// - ("folders:read") read the folder
// - ("alert.rules:read") read alert rules in the folder
// Returns false if the requester does not have enough permissions, and error if something went wrong during the permission evaluation.
func (r *RuleService) HasAccessInFolder(ctx context.Context, user identity.Requester, rule models.Namespaced) (bool, error) {
	eval := accesscontrol.EvalAll(getReadFolderAccessEvaluator(rule.GetNamespaceUID()))
	return r.HasAccess(ctx, user, eval)
}

// AuthorizeAccessInFolder checks that the identity.Requester has permissions to read alert rules in the given folder,
// which requires the following permissions:
// - ("folders:read") read the folder
// - ("alert.rules:read") read alert rules in the folder
// Returns error if at least one permission is missing or if something went wrong during the permission evaluation
func (r *RuleService) AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, rule models.Namespaced) error {
	eval := accesscontrol.EvalAll(getReadFolderAccessEvaluator(rule.GetNamespaceUID()))
	return r.HasAccessOrError(ctx, user, eval, func() string {
		return fmt.Sprintf("access rules in folder '%s'", rule.GetNamespaceUID())
	})
}

// AuthorizeRuleChanges analyzes changes in the rule group, and checks whether the changes are authorized.
// NOTE: if there are rules for deletion, and the user does not have access to data sources that a rule uses, the rule is removed from the list.
// If the user is not authorized to perform the changes the function returns ErrAuthorization with a description of what action is not authorized.
func (r *RuleService) AuthorizeRuleChanges(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	namespaceScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(change.GroupKey.NamespaceUID)

	rules, existingGroup := change.AffectedGroups[change.GroupKey]
	if existingGroup { // not existingGroup can be when user creates a new rule group or moves existing alerts to a new group
		if err := r.AuthorizeAccessToRuleGroup(ctx, user, rules); err != nil { // if user is not authorized to do operation in the group that is being changed
			return err
		}
	} else if len(change.Delete) > 0 {
		// add a safeguard in the case of inconsistency. If user hit this then there is a bug in the calculating of changes struct
		return fmt.Errorf("failed to authorize changes in rule group %s. Detected %d deletes but group was not provided", change.GroupKey.RuleGroup, len(change.Delete))
	}

	if len(change.Delete) > 0 {
		if err := r.HasAccessOrError(ctx, user, accesscontrol.EvalPermission(ruleDelete, namespaceScope), func() string {
			return fmt.Sprintf("delete alert rules that belong to folder %s", change.GroupKey.NamespaceUID)
		}); err != nil {
			return err
		}
	}

	var addAuthorized, updateAuthorized bool // these are needed to check authorization for the rule create\update only once
	if len(change.New) > 0 {
		if err := r.HasAccessOrError(ctx, user, accesscontrol.EvalPermission(ruleCreate, namespaceScope), func() string {
			return fmt.Sprintf("create alert rules in the folder %s", change.GroupKey.NamespaceUID)
		}); err != nil {
			return err
		}
		addAuthorized = true
		for _, rule := range change.New {
			if err := r.HasAccessOrError(ctx, user, r.getRulesQueryEvaluator(rule), func() string {
				return fmt.Sprintf("create a new alert rule '%s'", rule.Title)
			}); err != nil {
				return err
			}

			if err := r.authorizeNotificationSettings(ctx, user, rule); err != nil {
				return err
			}
		}
		if !existingGroup {
			// create a new group, check that user has "read" access to that new group. Otherwise, it will not be able to read it back.
			if err := r.AuthorizeAccessToRuleGroup(ctx, user, change.New); err != nil { // if user is not authorized to do operation in the group that is being changed
				return err
			}
		}
	}

	for _, rule := range change.Update {
		if rule.AffectsQuery() {
			if err := r.HasAccessOrError(ctx, user, r.getRulesQueryEvaluator(rule.New), func() string {
				return fmt.Sprintf("update alert rule query '%s' (UID: %s)", rule.Existing.Title, rule.Existing.UID)
			}); err != nil {
				return err
			}
		}

		// Check if the rule is moved from one folder to the current. If yes, then the user must have the authorization to delete rules from the source folder and add rules to the target folder.
		if rule.Existing.NamespaceUID != rule.New.NamespaceUID {
			ev := accesscontrol.EvalPermission(ruleDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(rule.Existing.NamespaceUID))
			if err := r.HasAccessOrError(ctx, user, ev, func() string {
				return fmt.Sprintf("move alert rules from folder %s", rule.Existing.NamespaceUID)
			}); err != nil {
				return err
			}

			if !addAuthorized {
				if err := r.HasAccessOrError(ctx, user, accesscontrol.EvalPermission(ruleCreate, namespaceScope), func() string {
					return fmt.Sprintf("move alert rules to folder '%s'", change.GroupKey.NamespaceUID)
				}); err != nil {
					return err
				}
				addAuthorized = true
			}
		} else if !updateAuthorized { // if it is false then the authorization was not checked. If it is true then the user is authorized to update rules
			if err := r.HasAccessOrError(ctx, user, accesscontrol.EvalPermission(ruleUpdate, namespaceScope), func() string {
				return fmt.Sprintf("update alert rules that belongs to folder '%s'", change.GroupKey.NamespaceUID)
			}); err != nil {
				return err
			}
			updateAuthorized = true
		}

		if !slices.EqualFunc(rule.Existing.NotificationSettings, rule.New.NotificationSettings, func(settings models.NotificationSettings, settings2 models.NotificationSettings) bool {
			return settings.Equals(&settings2)
		}) {
			if err := r.authorizeNotificationSettings(ctx, user, rule.New); err != nil {
				return err
			}
		}
	}
	return nil
}

// authorizeNotificationSettings checks if the user has access to all receivers that are used by the rule's notification settings.
func (r *RuleService) authorizeNotificationSettings(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	for _, ns := range rule.NotificationSettings {
		if err := r.notificationSettingsAuth.AuthorizeRead(ctx, user, &ns); err != nil {
			return err
		}
	}
	return nil
}
