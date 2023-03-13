package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

// AlertRuleFieldsToIgnoreInDiff contains fields that are ignored when calculating the RuleDelta.Diff.
var AlertRuleFieldsToIgnoreInDiff = [...]string{"ID", "Version", "Updated"}

type RuleDelta struct {
	Existing *models.AlertRule
	New      *models.AlertRule
	Diff     cmputil.DiffReport
}

type GroupDelta struct {
	GroupKey models.AlertRuleGroupKey
	// AffectedGroups contains all rules of all groups that are affected by these changes.
	// For example, during moving a rule from one group to another this map will contain all rules from two groups
	AffectedGroups map[models.AlertRuleGroupKey]models.RulesGroup
	New            []*models.AlertRule
	Update         []RuleDelta
	Delete         []*models.AlertRule
}

func (c *GroupDelta) IsEmpty() bool {
	return len(c.Update)+len(c.New)+len(c.Delete) == 0
}

type RuleReader interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) error
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *models.GetAlertRulesGroupByRuleUIDQuery) error
}

// CalculateChanges calculates the difference between rules in the group in the database and the submitted rules. If a submitted rule has UID it tries to find it in the database (in other groups).
// returns a list of rules that need to be added, updated and deleted. Deleted considered rules in the database that belong to the group but do not exist in the list of submitted rules.
func CalculateChanges(ctx context.Context, ruleReader RuleReader, groupKey models.AlertRuleGroupKey, submittedRules []*models.AlertRuleWithOptionals) (*GroupDelta, error) {
	affectedGroups := make(map[models.AlertRuleGroupKey]models.RulesGroup)
	q := &models.ListAlertRulesQuery{
		OrgID:         groupKey.OrgID,
		NamespaceUIDs: []string{groupKey.NamespaceUID},
		RuleGroup:     groupKey.RuleGroup,
	}
	if err := ruleReader.ListAlertRules(ctx, q); err != nil {
		return nil, fmt.Errorf("failed to query database for rules in the group %s: %w", groupKey, err)
	}
	existingGroupRules := q.Result
	if len(existingGroupRules) > 0 {
		affectedGroups[groupKey] = existingGroupRules
	}

	existingGroupRulesUIDs := make(map[string]*models.AlertRule, len(existingGroupRules))
	for _, r := range existingGroupRules {
		existingGroupRulesUIDs[r.UID] = r
	}

	//nolint:prealloc // difficult logic
	var toAdd []*models.AlertRule
	//nolint:prealloc // difficult logic
	var toUpdate []RuleDelta
	loadedRulesByUID := map[string]*models.AlertRule{} // auxiliary cache to avoid unnecessary queries if there are multiple moves from the same group
	for _, r := range submittedRules {
		if r == nil {
			continue
		}
		var existing *models.AlertRule = nil
		if r.UID != "" {
			if existingGroupRule, ok := existingGroupRulesUIDs[r.UID]; ok {
				existing = existingGroupRule
				// remove the rule from existingGroupRulesUIDs
				delete(existingGroupRulesUIDs, r.UID)
			} else if existing, ok = loadedRulesByUID[r.UID]; !ok { // check the "cache" and if there is no hit, query the database
				// Rule can be from other group or namespace
				q := &models.GetAlertRulesGroupByRuleUIDQuery{OrgID: groupKey.OrgID, UID: r.UID}
				if err := ruleReader.GetAlertRulesGroupByRuleUID(ctx, q); err != nil {
					return nil, fmt.Errorf("failed to query database for a group of alert rules: %w", err)
				}
				for _, rule := range q.Result {
					if rule.UID == r.UID {
						existing = rule
					}
					loadedRulesByUID[rule.UID] = rule
				}
				if existing == nil {
					return nil, fmt.Errorf("failed to update rule with UID %s because %w", r.UID, models.ErrAlertRuleNotFound)
				}
				affectedGroups[existing.GetGroupKey()] = q.Result
			}
		}

		if existing == nil {
			toAdd = append(toAdd, &r.AlertRule)
			continue
		}

		models.PatchPartialAlertRule(existing, r)

		diff := existing.Diff(&r.AlertRule, AlertRuleFieldsToIgnoreInDiff[:]...)
		if len(diff) == 0 {
			continue
		}

		toUpdate = append(toUpdate, RuleDelta{
			Existing: existing,
			New:      &r.AlertRule,
			Diff:     diff,
		})
		continue
	}

	toDelete := make([]*models.AlertRule, 0, len(existingGroupRulesUIDs))
	for _, rule := range existingGroupRulesUIDs {
		toDelete = append(toDelete, rule)
	}

	return &GroupDelta{
		GroupKey:       groupKey,
		AffectedGroups: affectedGroups,
		New:            toAdd,
		Delete:         toDelete,
		Update:         toUpdate,
	}, nil
}

// UpdateCalculatedRuleFields refreshes the calculated fields in a set of alert rule changes.
// This may generate new changes to keep a group consistent, such as versions or rule indexes.
func UpdateCalculatedRuleFields(ch *GroupDelta) *GroupDelta {
	updatingRules := make(map[models.AlertRuleKey]struct{}, len(ch.Delete)+len(ch.Update))
	for _, update := range ch.Update {
		updatingRules[update.Existing.GetKey()] = struct{}{}
	}
	for _, del := range ch.Delete {
		updatingRules[del.GetKey()] = struct{}{}
	}
	var toUpdate []RuleDelta
	for groupKey, rules := range ch.AffectedGroups {
		if groupKey != ch.GroupKey {
			rules.SortByGroupIndex()
		}
		idx := 1
		for _, rule := range rules {
			if _, ok := updatingRules[rule.GetKey()]; ok { // exclude rules that are going to be either updated or deleted
				continue
			}
			upd := RuleDelta{
				Existing: rule,
				New:      rule,
			}
			if groupKey != ch.GroupKey {
				if rule.RuleGroupIndex != idx {
					upd.New = models.CopyRule(rule)
					upd.New.RuleGroupIndex = idx
					upd.Diff = rule.Diff(upd.New, AlertRuleFieldsToIgnoreInDiff[:]...)
				}
				idx++
			}
			toUpdate = append(toUpdate, upd)
		}
	}
	return &GroupDelta{
		GroupKey:       ch.GroupKey,
		AffectedGroups: ch.AffectedGroups,
		New:            ch.New,
		Update:         append(ch.Update, toUpdate...),
		Delete:         ch.Delete,
	}
}
