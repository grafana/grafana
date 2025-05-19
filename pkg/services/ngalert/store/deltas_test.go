package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/cmputil"
)

func TestCalculateChanges(t *testing.T) {
	orgId := int64(rand.Int32())
	gen := models.RuleGen

	t.Run("detects alerts that need to be added", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)

		groupKey := models.GenerateGroupKey(orgId)
		rules := gen.With(gen.WithOrgID(orgId), simulateSubmitted, withoutUID).GenerateMany(1, 5)
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: rule})
		}

		changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, submitted)
		require.NoError(t, err)

		require.Len(t, changes.New, len(submitted))
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.Update)

	outerloop:
		for _, expected := range submitted {
			for _, rule := range changes.New {
				if len(expected.Diff(rule)) == 0 {
					continue outerloop
				}
			}
			require.Fail(t, "changes did not contain rule that was submitted")
		}
	})

	t.Run("detects alerts that need to be deleted", func(t *testing.T) {
		groupKey := models.GenerateGroupKey(orgId)
		inDatabase := gen.With(gen.WithGroupKey(groupKey)).GenerateManyRef(1, 5)
		inDatabaseMap := groupByUID(t, inDatabase)
		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, make([]*models.AlertRuleWithOptionals, 0))
		require.NoError(t, err)

		require.Equal(t, groupKey, changes.GroupKey)
		require.Empty(t, changes.New)
		require.Empty(t, changes.Update)
		require.Len(t, changes.Delete, len(inDatabaseMap))
		for _, toDelete := range changes.Delete {
			require.Contains(t, inDatabaseMap, toDelete.UID)
			db := inDatabaseMap[toDelete.UID]
			require.Equal(t, db, toDelete)
		}
		require.Contains(t, changes.AffectedGroups, groupKey)
		require.Equal(t, models.RulesGroup(inDatabase), changes.AffectedGroups[groupKey])
	})

	t.Run("should detect alerts that needs to be updated", func(t *testing.T) {
		groupKey := models.GenerateGroupKey(orgId)
		inDatabase := gen.With(gen.WithGroupKey(groupKey)).GenerateManyRef(1, 5)
		inDatabaseMap := groupByUID(t, inDatabase)

		rules := gen.With(simulateSubmitted, gen.WithGroupKey(groupKey), withUIDs(inDatabaseMap)).GenerateManyRef(len(inDatabase), len(inDatabase))
		submittedMap := groupByUID(t, rules)
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *rule, HasEditorSettings: true})
		}

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, submitted)
		require.NoError(t, err)

		require.Equal(t, groupKey, changes.GroupKey)
		require.Len(t, changes.Update, len(inDatabase))
		for _, upsert := range changes.Update {
			require.NotNil(t, upsert.Existing)
			require.Equal(t, upsert.Existing.UID, upsert.New.UID)
			require.Equal(t, inDatabaseMap[upsert.Existing.UID], upsert.Existing)
			require.Equal(t, submittedMap[upsert.Existing.UID], upsert.New)
			require.NotEmpty(t, upsert.Diff)
		}
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)

		require.Contains(t, changes.AffectedGroups, groupKey)
		require.Equal(t, models.RulesGroup(inDatabase), changes.AffectedGroups[groupKey])
	})

	t.Run("should include only if there are changes ignoring specific fields", func(t *testing.T) {
		groupKey := models.GenerateGroupKey(orgId)
		inDatabase := gen.With(gen.WithGroupKey(groupKey)).GenerateManyRef(1, 5)

		submitted := make([]*models.AlertRuleWithOptionals, 0, len(inDatabase))
		for _, rule := range inDatabase {
			r := models.CopyRule(rule)

			// Ignore difference in the following fields as submitted models do not have them set
			r.ID = int64(rand.Int32())
			r.Version = int64(rand.Int32())
			r.Updated = r.Updated.Add(1 * time.Minute)

			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *r})
		}

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, submitted)
		require.NoError(t, err)

		require.Empty(t, changes.Update)
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)
	})

	t.Run("should patch rule with UID specified by existing rule", func(t *testing.T) {
		testCases := []struct {
			name    string
			mutator models.AlertRuleMutator
		}{
			{
				name: "title is empty",
				mutator: func(r *models.AlertRule) {
					r.Title = ""
				},
			},
			{
				name: "condition and data are empty",
				mutator: func(r *models.AlertRule) {
					r.Condition = ""
					r.Data = nil
				},
			},
			{
				name: "ExecErrState is empty",
				mutator: func(r *models.AlertRule) {
					r.ExecErrState = ""
				},
			},
			{
				name: "NoDataState is empty",
				mutator: func(r *models.AlertRule) {
					r.NoDataState = ""
				},
			},
			{
				name: "For is 0",
				mutator: func(r *models.AlertRule) {
					r.For = 0
				},
			},
			{
				name: "GUID is empty",
				mutator: func(r *models.AlertRule) {
					r.GUID = ""
				},
			},
		}

		dbRule := gen.With(gen.WithOrgID(orgId)).GenerateRef()

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), dbRule)

		groupKey := models.GenerateGroupKey(orgId)

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				expected := gen.With(simulateSubmitted, testCase.mutator).GenerateRef()
				expected.UID = dbRule.UID
				submitted := *expected
				changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: submitted}})
				require.NoError(t, err)
				require.Len(t, changes.Update, 1)
				ch := changes.Update[0]
				require.Equal(t, ch.Existing, dbRule)
				fixed := models.AlertRuleWithOptionals{AlertRule: *expected}
				models.PatchPartialAlertRule(dbRule, &fixed)
				require.Equal(t, fixed.AlertRule, *ch.New)
			})
		}
	})

	t.Run("should be able to find alerts by UID in other group/namespace", func(t *testing.T) {
		sourceGroupKey := models.GenerateGroupKey(orgId)
		inDatabase := gen.With(gen.WithGroupKey(sourceGroupKey)).GenerateManyRef(10, 20)
		inDatabaseMap := groupByUID(t, inDatabase)

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		namespace := randFolder()
		groupName := util.GenerateShortUID()

		groupKey := models.AlertRuleGroupKey{
			OrgID:        orgId,
			NamespaceUID: namespace.UID,
			RuleGroup:    groupName,
		}

		rules := gen.With(simulateSubmitted, gen.WithGroupKey(groupKey), withUIDs(inDatabaseMap)).GenerateManyRef(5, len(inDatabase))
		submittedMap := groupByUID(t, rules)
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *rule, HasEditorSettings: true})
		}

		changes, err := CalculateChanges(context.Background(), fakeStore, groupKey, submitted)
		require.NoError(t, err)

		require.Equal(t, groupKey, changes.GroupKey)
		require.Empty(t, changes.Delete)
		require.Empty(t, changes.New)
		require.Len(t, changes.Update, len(submitted))
		for _, update := range changes.Update {
			require.NotNil(t, update.Existing)
			require.Equal(t, update.Existing.UID, update.New.UID)
			require.Equal(t, inDatabaseMap[update.Existing.UID], update.Existing)
			require.Equal(t, submittedMap[update.Existing.UID], update.New)
			require.NotEmpty(t, update.Diff)
		}

		require.Contains(t, changes.AffectedGroups, sourceGroupKey)
		require.NotContains(t, changes.AffectedGroups, groupKey) // because there is no such group in database yet

		require.Len(t, changes.AffectedGroups[sourceGroupKey], len(inDatabase))
	})

	t.Run("should add rule when submitted rule has UID that does not exist in db", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		groupKey := models.GenerateGroupKey(orgId)
		submitted := gen.With(gen.WithOrgID(orgId), simulateSubmitted).Generate()
		require.NotEqual(t, "", submitted.UID)

		diff, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: submitted}})
		require.NoError(t, err)

		require.Len(t, diff.New, 1)
		require.Empty(t, diff.Delete)
		require.Empty(t, diff.Update)
		require.Equal(t, submitted, *diff.New[0])
	})

	t.Run("should fail if cannot fetch current rules in the group", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		expectedErr := errors.New("TEST ERROR")
		fakeStore.Hook = func(cmd any) error {
			switch cmd.(type) {
			case models.ListAlertRulesQuery:
				return expectedErr
			}
			return nil
		}

		groupKey := models.GenerateGroupKey(orgId)
		submitted := gen.With(gen.WithOrgID(orgId), simulateSubmitted, withoutUID).Generate()

		_, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: submitted}})
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("should fail if cannot fetch rule by UID", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		expectedErr := errors.New("TEST ERROR")
		fakeStore.Hook = func(cmd any) error {
			switch cmd.(type) {
			case models.GetAlertRulesGroupByRuleUIDQuery:
				return expectedErr
			}
			return nil
		}

		groupKey := models.GenerateGroupKey(orgId)
		submitted := gen.With(gen.WithOrgID(orgId), simulateSubmitted).Generate()

		_, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: submitted}})
		require.ErrorIs(t, err, expectedErr)
	})
}

func TestCalculateAutomaticChanges(t *testing.T) {
	orgID := rand.Int64()
	gen := models.RuleGen

	t.Run("should mark all rules in affected groups", func(t *testing.T) {
		group := models.GenerateGroupKey(orgID)
		rules := gen.With(gen.WithGroupKey(group)).GenerateManyRef(10)
		// copy rules to make sure that the function does not modify the original rules
		copies := make([]*models.AlertRule, 0, len(rules))
		for _, rule := range rules {
			copies = append(copies, models.CopyRule(rule))
		}

		var updates []RuleDelta
		for i := 0; i < 5; i++ {
			ruleCopy := models.CopyRule(copies[i])
			ruleCopy.Title += util.GenerateShortUID()
			updates = append(updates, RuleDelta{
				Existing: copies[i],
				New:      ruleCopy,
			})
		}

		// simulate adding new rules, updating a few existing and delete some from the same rule
		ch := &GroupDelta{
			GroupKey: group,
			AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
				group: copies,
			},
			New:    gen.With(gen.WithGroupKey(group)).GenerateManyRef(2),
			Update: updates,
			Delete: rules[5:7],
		}

		result := UpdateCalculatedRuleFields(ch)

		require.NotEqual(t, ch, result)
		require.Equal(t, ch.GroupKey, result.GroupKey)
		require.Equal(t, map[models.AlertRuleGroupKey]models.RulesGroup{
			group: rules,
		}, result.AffectedGroups)
		require.Equal(t, ch.New, result.New)
		require.Equal(t, rules[5:7], result.Delete)
		var expected []RuleDelta
		expected = append(expected, updates...)
		// all rules that were not updated directly by user should be added to the
		for _, rule := range rules[7:] {
			expected = append(expected, RuleDelta{
				Existing: rule,
				New:      rule,
			})
		}
		require.Equal(t, expected, result.Update)
	})

	t.Run("should re-index rules in affected groups other than updated", func(t *testing.T) {
		group := models.GenerateGroupKey(orgID)
		rules := gen.With(gen.WithGroupKey(group), gen.WithSequentialGroupIndex()).GenerateManyRef(3)
		group2 := models.GenerateGroupKey(orgID)
		rules2 := gen.With(gen.WithGroupKey(group2), gen.WithSequentialGroupIndex()).GenerateManyRef(4)

		movedIndex := rand.IntN(len(rules2))
		movedRule := rules2[movedIndex]
		copyRule := models.CopyRule(movedRule)
		copyRule.RuleGroup = group.RuleGroup
		copyRule.NamespaceUID = group.NamespaceUID
		copyRule.RuleGroupIndex = len(rules)
		update := RuleDelta{
			Existing: movedRule,
			New:      copyRule,
		}

		shuffled := make([]*models.AlertRule, 0, len(rules2))
		copy(shuffled, rules2)
		rand.Shuffle(len(shuffled), func(i, j int) {
			shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
		})

		// simulate moving a rule from one group to another.
		ch := &GroupDelta{
			GroupKey: group,
			AffectedGroups: map[models.AlertRuleGroupKey]models.RulesGroup{
				group:  rules,
				group2: shuffled,
			},
			Update: []RuleDelta{
				update,
			},
		}

		result := UpdateCalculatedRuleFields(ch)

		require.NotEqual(t, ch, result)
		require.Equal(t, ch.GroupKey, result.GroupKey)
		require.Equal(t, ch.AffectedGroups, result.AffectedGroups)
		require.Equal(t, ch.New, result.New)
		require.Equal(t, ch.Delete, result.Delete)

		require.Equal(t, ch.Update, result.Update[0:1])

		require.Contains(t, result.Update, update)
		for _, rule := range rules {
			assert.Containsf(t, result.Update, RuleDelta{
				Existing: rule,
				New:      rule,
			}, "automatic changes expected to contain all rules of the updated group")
		}

		// calculate expected index of the rules in the source group after the move
		expectedReindex := make(map[string]int, len(rules2)-1)
		idx := 1
		for _, rule := range rules2 {
			if rule.UID == movedRule.UID {
				continue
			}
			expectedReindex[rule.UID] = idx
			idx++
		}

		for _, upd := range result.Update {
			expectedIdx, ok := expectedReindex[upd.Existing.UID]
			if !ok {
				continue
			}
			diff := upd.Existing.Diff(upd.New)
			if upd.Existing.RuleGroupIndex != expectedIdx {
				require.Lenf(t, diff, 1, fmt.Sprintf("the rule in affected group should be re-indexed to %d but it still has index %d. Moved rule with index %d", expectedIdx, upd.Existing.RuleGroupIndex, movedIndex))
				require.Equal(t, "RuleGroupIndex", diff[0].Path)
				require.Equal(t, expectedIdx, upd.New.RuleGroupIndex)
			} else {
				require.Empty(t, diff)
			}
		}
	})
}

func TestCalculateRuleGroupsDelete(t *testing.T) {
	orgId := int64(rand.Int32())
	gen := models.RuleGen

	t.Run("returns ErrAlertRuleGroupNotFound when namespace has no rules", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		otherRules := gen.With(gen.WithOrgID(orgId), gen.WithNamespaceUID("ns-1")).GenerateManyRef(3)
		fakeStore.Rules[orgId] = otherRules

		query := &models.ListAlertRulesQuery{
			NamespaceUIDs: []string{"ns-2"},
		}
		deltas, err := CalculateRuleGroupsDelete(context.Background(), fakeStore, orgId, query)
		require.ErrorIs(t, err, models.ErrAlertRuleGroupNotFound)
		require.Nil(t, deltas)
	})

	t.Run("returns deltas for all affected groups in namespace", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		folder := randFolder()

		// Create rules in two groups in target namespace
		group1Key := models.AlertRuleGroupKey{
			OrgID:        orgId,
			NamespaceUID: folder.UID,
			RuleGroup:    util.GenerateShortUID(),
		}
		group2Key := models.AlertRuleGroupKey{
			OrgID:        orgId,
			NamespaceUID: folder.UID,
			RuleGroup:    util.GenerateShortUID(),
		}

		group1Rules := gen.With(gen.WithGroupKey(group1Key)).GenerateManyRef(3)
		group2Rules := gen.With(gen.WithGroupKey(group2Key)).GenerateManyRef(2)
		allNamespaceRules := append(group1Rules, group2Rules...)

		// Create rules in different namespace
		otherRules := gen.With(gen.WithOrgID(orgId), gen.WithNamespaceUIDNotIn(folder.UID)).GenerateManyRef(3)

		fakeStore.Rules[orgId] = append(allNamespaceRules, otherRules...)

		query := &models.ListAlertRulesQuery{
			NamespaceUIDs: []string{folder.UID},
		}

		deltas, err := CalculateRuleGroupsDelete(context.Background(), fakeStore, orgId, query)
		require.NoError(t, err)

		require.Len(t, deltas, 2, "expected deltas for two groups")

		// Verify each group's delta
		for _, delta := range deltas {
			require.True(t, delta.GroupKey == group1Key || delta.GroupKey == group2Key)
			require.Empty(t, delta.Update)
			require.Empty(t, delta.New)

			require.Contains(t, delta.AffectedGroups, delta.GroupKey)
			if delta.GroupKey == group1Key {
				require.ElementsMatch(t, group1Rules, delta.Delete)
				require.ElementsMatch(t, group1Rules, delta.AffectedGroups[delta.GroupKey])
			} else {
				require.ElementsMatch(t, group2Rules, delta.Delete)
				require.ElementsMatch(t, group2Rules, delta.AffectedGroups[delta.GroupKey])
			}
		}
	})

	t.Run("fails if store returns error", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		expectedErr := errors.New("store error")
		fakeStore.Hook = func(cmd any) error {
			switch cmd.(type) {
			case models.ListAlertRulesQuery:
				return expectedErr
			}
			return nil
		}

		deltas, err := CalculateRuleGroupsDelete(context.Background(), fakeStore, orgId, nil)
		require.ErrorIs(t, err, expectedErr)
		require.Nil(t, deltas)
	})
}

func TestCalculateRuleGroupDelete(t *testing.T) {
	gen := models.RuleGen
	fakeStore := fakes.NewRuleStore(t)
	groupKey := models.GenerateGroupKey(1)
	otherRules := gen.With(gen.WithOrgID(groupKey.OrgID), gen.WithNamespaceUIDNotIn(groupKey.NamespaceUID)).GenerateManyRef(3)
	fakeStore.Rules[groupKey.OrgID] = otherRules

	t.Run("NotFound when group does not exist", func(t *testing.T) {
		delta, err := CalculateRuleGroupDelete(context.Background(), fakeStore, groupKey)
		require.ErrorIs(t, err, models.ErrAlertRuleGroupNotFound, "expected ErrAlertRuleGroupNotFound but got %s", err)
		require.Nil(t, delta)
	})

	t.Run("set AffectedGroups when a rule refers to an existing group", func(t *testing.T) {
		groupRules := gen.With(gen.WithGroupKey(groupKey)).GenerateManyRef(3)
		fakeStore.Rules[groupKey.OrgID] = append(fakeStore.Rules[groupKey.OrgID], groupRules...)

		delta, err := CalculateRuleGroupDelete(context.Background(), fakeStore, groupKey)
		require.NoError(t, err)

		assert.Equal(t, groupKey, delta.GroupKey)
		assert.ElementsMatch(t, groupRules, delta.Delete)

		assert.Empty(t, delta.Update)
		assert.Empty(t, delta.New)

		assert.Len(t, delta.AffectedGroups, 1)
		assert.ElementsMatch(t, groupRules, delta.AffectedGroups[delta.GroupKey])
	})
}

func TestCalculateRuleDelete(t *testing.T) {
	gen := models.RuleGen
	fakeStore := fakes.NewRuleStore(t)
	rule := gen.GenerateRef()
	otherRules := gen.With(gen.WithOrgID(rule.OrgID), gen.WithNamespaceUIDNotIn(rule.NamespaceUID)).GenerateManyRef(3)
	fakeStore.Rules[rule.OrgID] = otherRules

	t.Run("nil when a rule does not exist", func(t *testing.T) {
		delta, err := CalculateRuleDelete(context.Background(), fakeStore, rule.GetKey())
		require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
		require.Nil(t, delta)
	})

	t.Run("set AffectedGroups when a rule refers to an existing group", func(t *testing.T) {
		groupRules := gen.With(gen.WithGroupKey(rule.GetGroupKey())).GenerateManyRef(3)
		groupRules = append(groupRules, rule)
		fakeStore.Rules[rule.OrgID] = append(fakeStore.Rules[rule.OrgID], groupRules...)

		delta, err := CalculateRuleDelete(context.Background(), fakeStore, rule.GetKey())
		require.NoError(t, err)

		assert.Equal(t, rule.GetGroupKey(), delta.GroupKey)
		assert.Len(t, delta.Delete, 1)
		assert.Equal(t, rule, delta.Delete[0])

		assert.Empty(t, delta.Update)
		assert.Empty(t, delta.New)

		assert.Len(t, delta.AffectedGroups, 1)
		assert.Equal(t, models.RulesGroup(groupRules), delta.AffectedGroups[delta.GroupKey])
	})
}

func TestCalculateRuleUpdate(t *testing.T) {
	gen := models.RuleGen
	fakeStore := fakes.NewRuleStore(t)
	rule := gen.GenerateRef()
	otherRules := gen.With(gen.WithOrgID(rule.OrgID), gen.WithNamespaceUIDNotIn(rule.NamespaceUID)).GenerateManyRef(3)
	groupRules := gen.With(gen.WithGroupKey(rule.GetGroupKey())).GenerateManyRef(3)
	groupRules = append(groupRules, rule)
	fakeStore.Rules[rule.OrgID] = append(otherRules, groupRules...)

	t.Run("when a rule is not changed", func(t *testing.T) {
		cp := models.CopyRule(rule)
		delta, err := CalculateRuleUpdate(context.Background(), fakeStore, &models.AlertRuleWithOptionals{
			AlertRule: *cp,
			HasPause:  false,
		})
		require.NoError(t, err)
		require.True(t, delta.IsEmpty())
	})

	t.Run("when a rule is updated", func(t *testing.T) {
		cp := models.CopyRule(rule)
		cp.For = cp.For + 1*time.Minute // cause any diff

		delta, err := CalculateRuleUpdate(context.Background(), fakeStore, &models.AlertRuleWithOptionals{
			AlertRule: *cp,
			HasPause:  false,
		})
		require.NoError(t, err)

		assert.Equal(t, rule.GetGroupKey(), delta.GroupKey)
		assert.Empty(t, delta.New)
		assert.Empty(t, delta.Delete)
		assert.Len(t, delta.Update, 1)
		assert.Equal(t, cp, delta.Update[0].New)
		assert.Equal(t, rule, delta.Update[0].Existing)

		require.Contains(t, delta.AffectedGroups, delta.GroupKey)
		assert.Equal(t, models.RulesGroup(groupRules), delta.AffectedGroups[delta.GroupKey])
	})

	t.Run("when a rule is moved between groups", func(t *testing.T) {
		sourceGroupKey := rule.GetGroupKey()
		targetGroupKey := models.GenerateGroupKey(rule.OrgID)
		targetGroup := gen.With(gen.WithGroupKey(targetGroupKey)).GenerateManyRef(3)
		fakeStore.Rules[rule.OrgID] = append(fakeStore.Rules[rule.OrgID], targetGroup...)

		cp := models.CopyRule(rule)
		cp.NamespaceUID = targetGroupKey.NamespaceUID
		cp.RuleGroup = targetGroupKey.RuleGroup

		delta, err := CalculateRuleUpdate(context.Background(), fakeStore, &models.AlertRuleWithOptionals{
			AlertRule: *cp,
			HasPause:  false,
		})
		require.NoError(t, err)

		assert.Equal(t, targetGroupKey, delta.GroupKey)
		assert.Empty(t, delta.New)
		assert.Empty(t, delta.Delete)
		assert.Len(t, delta.Update, 1)
		assert.Equal(t, cp, delta.Update[0].New)
		assert.Equal(t, rule, delta.Update[0].Existing)

		require.Contains(t, delta.AffectedGroups, sourceGroupKey)
		assert.Equal(t, models.RulesGroup(groupRules), delta.AffectedGroups[sourceGroupKey])
		require.Contains(t, delta.AffectedGroups, targetGroupKey)
		assert.Equal(t, models.RulesGroup(targetGroup), delta.AffectedGroups[targetGroupKey])
	})

	t.Run("when an alert rule query is updated", func(t *testing.T) {
		cp := models.CopyRule(rule)
		cp.Record = nil
		cp.Data = []models.AlertQuery{{RefID: "something else"}}

		delta, err := CalculateRuleUpdate(context.Background(), fakeStore, &models.AlertRuleWithOptionals{
			AlertRule: *cp,
			HasPause:  false,
		})
		require.NoError(t, err)

		assert.Equal(t, rule.GetGroupKey(), delta.GroupKey)
		assert.Empty(t, delta.New)
		assert.Empty(t, delta.Delete)
		assert.Len(t, delta.Update, 1)
		assert.Equal(t, cp, delta.Update[0].New)
		assert.Equal(t, rule, delta.Update[0].Existing)
		require.Contains(t, delta.AffectedGroups, delta.GroupKey)
	})

	t.Run("when a recording rule query is updated", func(t *testing.T) {
		base := gen.With(models.RuleGen.WithAllRecordingRules()).GenerateRef()
		fakeStore.Rules[base.OrgID] = []*models.AlertRule{base}
		cp := models.CopyRule(base)
		cp.Data = []models.AlertQuery{{RefID: "something else"}}

		delta, err := CalculateRuleUpdate(context.Background(), fakeStore, &models.AlertRuleWithOptionals{
			AlertRule: *cp,
			HasPause:  false,
		})
		require.NoError(t, err)

		assert.Equal(t, base.GetGroupKey(), delta.GroupKey)
		assert.Empty(t, delta.New)
		assert.Empty(t, delta.Delete)
		assert.Len(t, delta.Update, 1)
		assert.Equal(t, cp, delta.Update[0].New)
		assert.Equal(t, base, delta.Update[0].Existing)
		require.Contains(t, delta.AffectedGroups, delta.GroupKey)
	})
}

func TestCalculateRuleCreate(t *testing.T) {
	gen := models.RuleGen
	t.Run("when a rule refers to a new group", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		rule := gen.GenerateRef()

		delta, err := CalculateRuleCreate(context.Background(), fakeStore, rule)
		require.NoError(t, err)

		assert.Equal(t, rule.GetGroupKey(), delta.GroupKey)
		assert.Empty(t, delta.AffectedGroups)
		assert.Empty(t, delta.Delete)
		assert.Empty(t, delta.Update)
		assert.Len(t, delta.New, 1)
		assert.Equal(t, rule, delta.New[0])
	})

	t.Run("when a rule refers to an existing group", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		rule := gen.GenerateRef()

		groupRules := gen.With(gen.WithGroupKey(rule.GetGroupKey())).GenerateManyRef(3)
		otherRules := gen.With(gen.WithGroupKey(rule.GetGroupKey()), gen.WithNamespaceUIDNotIn(rule.NamespaceUID)).GenerateManyRef(3)
		fakeStore.Rules[rule.OrgID] = append(groupRules, otherRules...)

		delta, err := CalculateRuleCreate(context.Background(), fakeStore, rule)
		require.NoError(t, err)

		assert.Equal(t, rule.GetGroupKey(), delta.GroupKey)
		assert.Len(t, delta.AffectedGroups, 1)
		assert.Equal(t, models.RulesGroup(groupRules), delta.AffectedGroups[delta.GroupKey])
		assert.Empty(t, delta.Delete)
		assert.Empty(t, delta.Update)
		assert.Len(t, delta.New, 1)
		assert.Equal(t, rule, delta.New[0])
	})
}

func TestDeltaAffectsQuery(t *testing.T) {
	t.Run("returns false when there are no diffs", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{},
		}
		assert.False(t, delta.AffectsQuery())
	})
	t.Run("returns true when diff contains a field that affects query", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{
				{
					Path:  "Data",
					Left:  reflect.ValueOf("old value"),
					Right: reflect.ValueOf("new value"),
				},
			},
		}
		assert.True(t, delta.AffectsQuery())
	})
	t.Run("returns false when diff contains only fields that do not affect query", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{
				{
					Path:  "Title",
					Left:  reflect.ValueOf("old title"),
					Right: reflect.ValueOf("new title"),
				},
			},
		}
		assert.False(t, delta.AffectsQuery())
	})
	t.Run("returns true when diff contains multiple fields, including one that affects query", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{
				{
					Path:  "Title",
					Left:  reflect.ValueOf("old title"),
					Right: reflect.ValueOf("new title"),
				},
				{
					Path:  "IntervalSeconds",
					Left:  reflect.ValueOf(10),
					Right: reflect.ValueOf(20),
				},
			},
		}
		assert.True(t, delta.AffectsQuery())
	})
	t.Run("handles nested paths in diff", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{
				{
					Path:  "Data[0].Query",
					Left:  reflect.ValueOf("old query"),
					Right: reflect.ValueOf("new query"),
				},
			},
		}
		assert.True(t, delta.AffectsQuery())
	})
	t.Run("returns false for empty diff paths", func(t *testing.T) {
		delta := RuleDelta{
			Diff: cmputil.DiffReport{
				{
					Path:  "",
					Left:  reflect.ValueOf("old value"),
					Right: reflect.ValueOf("new value"),
				},
			},
		}
		assert.False(t, delta.AffectsQuery())
	})
}

// simulateSubmitted resets some fields of the structure that are not populated by API model to model conversion
func simulateSubmitted(rule *models.AlertRule) {
	rule.ID = 0
	rule.Version = 0
	rule.Updated = time.Time{}
}

func withoutUID(rule *models.AlertRule) {
	rule.UID = ""
}

func withUIDs(uids map[string]*models.AlertRule) models.AlertRuleMutator {
	unused := make([]string, 0, len(uids))
	for s := range uids {
		unused = append(unused, s)
	}
	return func(rule *models.AlertRule) {
		if len(unused) == 0 {
			return
		}
		rule.UID = unused[0]
		unused = unused[1:]
	}
}

func randFolder() *folder.Folder {
	return &folder.Folder{
		UID:       util.GenerateShortUID(),
		Title:     "TEST-FOLDER-" + util.GenerateShortUID(),
		URL:       "",
		Version:   0,
		Created:   time.Time{},
		Updated:   time.Time{},
		UpdatedBy: 0,
		CreatedBy: 0,
	}
}

func groupByUID(t *testing.T, list []*models.AlertRule) map[string]*models.AlertRule {
	result := make(map[string]*models.AlertRule, len(list))
	for _, rule := range list {
		if _, ok := result[rule.UID]; ok {
			t.Fatalf("expected unique UID for rule %s but duplicate", rule.UID)
		}
		result[rule.UID] = rule
	}
	return result
}
