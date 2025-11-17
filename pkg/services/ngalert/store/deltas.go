package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

// AlertRuleFieldsToIgnoreInDiff contains fields that are ignored when calculating the RuleDelta.Diff.
var AlertRuleFieldsToIgnoreInDiff = [...]string{"ID", "Version", "Updated", "UpdatedBy"}

// AlertRuleFieldsWhichAffectQuery contains fields which affect the rule's query(s)
var AlertRuleFieldsWhichAffectQuery = [...]string{"Data", "IntervalSeconds"}

type RuleDelta struct {
	Existing *models.AlertRule
	New      *models.AlertRule
	Diff     cmputil.DiffReport
}

func (d *RuleDelta) AffectsQuery() bool {
	if len(d.Diff) == 0 {
		return false
	}
	for _, path := range d.Diff.Paths() {
		for _, field := range AlertRuleFieldsWhichAffectQuery {
			if strings.HasPrefix(path, field) {
				return true
			}
		}
	}
	return false
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

// NewOrUpdatedNotificationSettings returns a list of notification settings that are either new or updated in the group.
func (c *GroupDelta) NewOrUpdatedNotificationSettings() []models.NotificationSettings {
	var settings []models.NotificationSettings
	for _, rule := range c.New {
		if len(rule.NotificationSettings) > 0 {
			settings = append(settings, rule.NotificationSettings...)
		}
	}
	for _, delta := range c.Update {
		if len(delta.New.NotificationSettings) == 0 {
			continue
		}
		d := delta.Diff.GetDiffsForField("NotificationSettings")
		if len(d) == 0 {
			continue
		}
		settings = append(settings, delta.New.NotificationSettings...)
	}
	return settings
}

type RuleReader interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) (models.RulesGroup, error)
	GetAlertRulesGroupByRuleUID(ctx context.Context, query *models.GetAlertRulesGroupByRuleUIDQuery) ([]*models.AlertRule, error)
}

// CalculateChanges calculates the difference between rules in the group in the database and the submitted rules. If a submitted rule has UID it tries to find it in the database (in other groups).
// returns a list of rules that need to be added, updated and deleted. Deleted considered rules in the database that belong to the group but do not exist in the list of submitted rules.
func CalculateChanges(ctx context.Context, ruleReader RuleReader, groupKey models.AlertRuleGroupKey, submittedRules []*models.AlertRuleWithOptionals) (*GroupDelta, error) {
	q := &models.ListAlertRulesQuery{
		OrgID:         groupKey.OrgID,
		NamespaceUIDs: []string{groupKey.NamespaceUID},
		RuleGroups:    []string{groupKey.RuleGroup},
	}
	existingGroupRules, err := ruleReader.ListAlertRules(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("failed to query database for rules in the group %s: %w", groupKey, err)
	}

	return calculateChanges(ctx, ruleReader, groupKey, existingGroupRules, submittedRules)
}

func calculateChanges(ctx context.Context, ruleReader RuleReader, groupKey models.AlertRuleGroupKey, existingGroupRules []*models.AlertRule, submittedRules []*models.AlertRuleWithOptionals) (*GroupDelta, error) {
	affectedGroups := make(map[models.AlertRuleGroupKey]models.RulesGroup)

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
				ruleList, err := ruleReader.GetAlertRulesGroupByRuleUID(ctx, q)
				if err != nil {
					return nil, fmt.Errorf("failed to query database for a group of alert rules: %w", err)
				}
				for _, rule := range ruleList {
					if rule.UID == r.UID {
						existing = rule
					}
					loadedRulesByUID[rule.UID] = rule
				}
				if existing != nil {
					affectedGroups[existing.GetGroupKey()] = ruleList
				}
			}
		}

		if existing == nil {
			toAdd = append(toAdd, &r.AlertRule)
			continue
		}

		models.PatchPartialAlertRule(existing, r)
		diff := existing.Diff(&r.AlertRule, AlertRuleFieldsToIgnoreInDiff[:]...)
		if len(diff) > 0 {
			toUpdate = append(toUpdate, RuleDelta{
				Existing: existing,
				New:      &r.AlertRule,
				Diff:     diff,
			})
		}
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
		if groupKey != ch.GroupKey && !models.IsNoGroupRuleGroup(groupKey.RuleGroup) {
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
			if groupKey != ch.GroupKey && !models.IsNoGroupRuleGroup(groupKey.RuleGroup) {
				if rule.RuleGroupIndex != idx {
					upd.New = rule.Copy()
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

// CalculateRuleUpdate calculates GroupDelta for rule update operation
func CalculateRuleUpdate(ctx context.Context, ruleReader RuleReader, rule *models.AlertRuleWithOptionals) (*GroupDelta, error) {
	q := &models.ListAlertRulesQuery{
		OrgID:         rule.OrgID,
		NamespaceUIDs: []string{rule.NamespaceUID},
		RuleGroups:    []string{rule.RuleGroup},
	}
	existingGroupRules, err := ruleReader.ListAlertRules(ctx, q)
	if err != nil {
		return nil, err
	}

	newGroup := make([]*models.AlertRuleWithOptionals, 0, len(existingGroupRules)+1)
	added := false
	for _, alertRule := range existingGroupRules {
		if alertRule.GetKey() == rule.GetKey() {
			newGroup = append(newGroup, rule)
			added = true
		}
		newGroup = append(newGroup, &models.AlertRuleWithOptionals{AlertRule: *alertRule})
	}
	if !added {
		newGroup = append(newGroup, rule)
	}

	return calculateChanges(ctx, ruleReader, rule.GetGroupKey(), existingGroupRules, newGroup)
}

// CalculateRuleGroupsDelete calculates []*GroupDelta that reflects an operation of removing multiple groups
func CalculateRuleGroupsDelete(ctx context.Context, ruleReader RuleReader, orgID int64, query *models.ListAlertRulesQuery) ([]*GroupDelta, error) {
	if query == nil {
		query = &models.ListAlertRulesQuery{}
	}
	query.OrgID = orgID
	ruleList, err := ruleReader.ListAlertRules(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(ruleList) == 0 {
		return nil, models.ErrAlertRuleGroupNotFound.Errorf("")
	}

	groups := models.GroupByAlertRuleGroupKey(ruleList)
	deltas := make([]*GroupDelta, 0, len(groups))
	for groupKey := range groups {
		delta := &GroupDelta{
			GroupKey: groupKey,
			Delete:   groups[groupKey],
			AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
				groupKey: groups[groupKey],
			},
		}
		if err != nil {
			return nil, err
		}
		deltas = append(deltas, delta)
	}

	return deltas, nil
}

// CalculateRuleGroupDelete calculates GroupDelta that reflects an operation of removing entire group
func CalculateRuleGroupDelete(ctx context.Context, ruleReader RuleReader, groupKey models.AlertRuleGroupKey) (*GroupDelta, error) {
	q := &models.ListAlertRulesQuery{
		NamespaceUIDs: []string{groupKey.NamespaceUID},
		RuleGroups:    []string{groupKey.RuleGroup},
	}
	deltas, err := CalculateRuleGroupsDelete(ctx, ruleReader, groupKey.OrgID, q)
	if err != nil {
		return nil, err
	}
	if len(deltas) != 1 {
		return nil, fmt.Errorf("expected to get a single group delta, got %d", len(deltas))
	}

	return deltas[0], nil
}

// CalculateRuleDelete calculates GroupDelta that reflects an operation of removing a rule from the group.
func CalculateRuleDelete(ctx context.Context, ruleReader RuleReader, ruleKey models.AlertRuleKey) (*GroupDelta, error) {
	q := &models.GetAlertRulesGroupByRuleUIDQuery{
		UID:   ruleKey.UID,
		OrgID: ruleKey.OrgID,
	}
	group, err := ruleReader.GetAlertRulesGroupByRuleUID(ctx, q)
	if err != nil {
		return nil, err
	}
	var toDelete *models.AlertRule
	for _, rule := range group {
		if rule.GetKey() == ruleKey {
			toDelete = rule
			break
		}
	}
	if toDelete == nil { // should not happen if rule exists.
		return nil, models.ErrAlertRuleNotFound
	}
	groupKey := group[0].GetGroupKey()
	delta := &GroupDelta{
		GroupKey: groupKey,
		Delete:   []*models.AlertRule{toDelete},
		AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
			groupKey: group,
		},
	}
	return delta, nil
}

// CalculateRuleCreate calculates GroupDelta that reflects an operation of adding a new rule to the group.
func CalculateRuleCreate(ctx context.Context, ruleReader RuleReader, rule *models.AlertRule) (*GroupDelta, error) {
	q := &models.ListAlertRulesQuery{
		OrgID:         rule.OrgID,
		NamespaceUIDs: []string{rule.NamespaceUID},
		RuleGroups:    []string{rule.RuleGroup},
	}
	group, err := ruleReader.ListAlertRules(ctx, q)
	if err != nil {
		return nil, err
	}

	delta := &GroupDelta{
		GroupKey:       rule.GetGroupKey(),
		AffectedGroups: make(map[models.AlertRuleGroupKey]models.RulesGroup),
		New:            []*models.AlertRule{rule},
		Update:         nil,
		Delete:         nil,
	}

	if len(group) > 0 {
		delta.AffectedGroups[rule.GetGroupKey()] = group
	}
	return delta, nil
}
