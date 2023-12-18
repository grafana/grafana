package store

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/util"
)

func TestCalculateChanges(t *testing.T) {
	orgId := int64(rand.Int31())

	t.Run("detects alerts that need to be added", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)

		groupKey := models.GenerateGroupKey(orgId)
		rules := models.GenerateAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withOrgID(orgId), simulateSubmitted, withoutUID))
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *rule})
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
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withGroupKey(groupKey)))

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
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withGroupKey(groupKey)))
		submittedMap, rules := models.GenerateUniqueAlertRules(len(inDatabase), models.AlertRuleGen(simulateSubmitted, withGroupKey(groupKey), withUIDs(inDatabaseMap)))
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *rule})
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
		_, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(5)+1, models.AlertRuleGen(withGroupKey(groupKey)))

		submitted := make([]*models.AlertRuleWithOptionals, 0, len(inDatabase))
		for _, rule := range inDatabase {
			r := models.CopyRule(rule)

			// Ignore difference in the following fields as submitted models do not have them set
			r.ID = int64(rand.Int31())
			r.Version = int64(rand.Int31())
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
			mutator func(r *models.AlertRule)
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
		}

		dbRule := models.AlertRuleGen(withOrgID(orgId))()

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), dbRule)

		groupKey := models.GenerateGroupKey(orgId)

		for _, testCase := range testCases {
			t.Run(testCase.name, func(t *testing.T) {
				expected := models.AlertRuleGen(simulateSubmitted, testCase.mutator)()
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
		inDatabaseMap, inDatabase := models.GenerateUniqueAlertRules(rand.Intn(10)+10, models.AlertRuleGen(withGroupKey(sourceGroupKey)))

		fakeStore := fakes.NewRuleStore(t)
		fakeStore.PutRule(context.Background(), inDatabase...)

		namespace := randFolder()
		groupName := util.GenerateShortUID()

		groupKey := models.AlertRuleGroupKey{
			OrgID:        orgId,
			NamespaceUID: namespace.UID,
			RuleGroup:    groupName,
		}

		submittedMap, rules := models.GenerateUniqueAlertRules(rand.Intn(len(inDatabase)-5)+5, models.AlertRuleGen(simulateSubmitted, withGroupKey(groupKey), withUIDs(inDatabaseMap)))
		submitted := make([]*models.AlertRuleWithOptionals, 0, len(rules))
		for _, rule := range rules {
			submitted = append(submitted, &models.AlertRuleWithOptionals{AlertRule: *rule})
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

	t.Run("should fail when submitted rule has UID that does not exist in db", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		groupKey := models.GenerateGroupKey(orgId)
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted)()
		require.NotEqual(t, "", submitted.UID)

		_, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: *submitted}})
		require.Error(t, err)
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
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted, withoutUID)()

		_, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: *submitted}})
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
		submitted := models.AlertRuleGen(withOrgID(orgId), simulateSubmitted)()

		_, err := CalculateChanges(context.Background(), fakeStore, groupKey, []*models.AlertRuleWithOptionals{{AlertRule: *submitted}})
		require.ErrorIs(t, err, expectedErr)
	})
}

func TestCalculateAutomaticChanges(t *testing.T) {
	orgID := rand.Int63()

	t.Run("should mark all rules in affected groups", func(t *testing.T) {
		group := models.GenerateGroupKey(orgID)
		rules := models.GenerateAlertRules(10, models.AlertRuleGen(withGroupKey(group)))
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
			New:    models.GenerateAlertRules(2, models.AlertRuleGen(withGroupKey(group))),
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
		rules := models.GenerateAlertRules(3, models.AlertRuleGen(withGroupKey(group), models.WithSequentialGroupIndex()))
		group2 := models.GenerateGroupKey(orgID)
		rules2 := models.GenerateAlertRules(4, models.AlertRuleGen(withGroupKey(group2), models.WithSequentialGroupIndex()))

		movedIndex := rand.Intn(len(rules2))
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

func TestCalculateRuleGroupDelete(t *testing.T) {
	fakeStore := fakes.NewRuleStore(t)
	groupKey := models.GenerateGroupKey(1)
	otherRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithOrgID(groupKey.OrgID), models.WithNamespaceUIDNotIn(groupKey.NamespaceUID)))
	fakeStore.Rules[groupKey.OrgID] = otherRules

	t.Run("NotFound when group does not exist", func(t *testing.T) {
		delta, err := CalculateRuleGroupDelete(context.Background(), fakeStore, groupKey)
		require.ErrorIs(t, err, models.ErrAlertRuleGroupNotFound, "expected ErrAlertRuleGroupNotFound but got %s", err)
		require.Nil(t, delta)
	})

	t.Run("set AffectedGroups when a rule refers to an existing group", func(t *testing.T) {
		groupRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(groupKey)))
		fakeStore.Rules[groupKey.OrgID] = append(fakeStore.Rules[groupKey.OrgID], groupRules...)

		delta, err := CalculateRuleGroupDelete(context.Background(), fakeStore, groupKey)
		require.NoError(t, err)

		assert.Equal(t, groupKey, delta.GroupKey)
		assert.EqualValues(t, groupRules, delta.Delete)

		assert.Empty(t, delta.Update)
		assert.Empty(t, delta.New)

		assert.Len(t, delta.AffectedGroups, 1)
		assert.Equal(t, models.RulesGroup(groupRules), delta.AffectedGroups[delta.GroupKey])
	})
}

func TestCalculateRuleDelete(t *testing.T) {
	fakeStore := fakes.NewRuleStore(t)
	rule := models.AlertRuleGen()()
	otherRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithOrgID(rule.OrgID), models.WithNamespaceUIDNotIn(rule.NamespaceUID)))
	fakeStore.Rules[rule.OrgID] = otherRules

	t.Run("nil when a rule does not exist", func(t *testing.T) {
		delta, err := CalculateRuleDelete(context.Background(), fakeStore, rule.GetKey())
		require.NoError(t, err)
		require.Nil(t, delta)
	})

	t.Run("set AffectedGroups when a rule refers to an existing group", func(t *testing.T) {
		groupRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(rule.GetGroupKey())))
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
	fakeStore := fakes.NewRuleStore(t)
	rule := models.AlertRuleGen()()
	otherRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithOrgID(rule.OrgID), models.WithNamespaceUIDNotIn(rule.NamespaceUID)))
	groupRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(rule.GetGroupKey())))
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
		targetGroup := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(targetGroupKey)))
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
}

func TestCalculateRuleCreate(t *testing.T) {
	t.Run("when a rule refers to a new group", func(t *testing.T) {
		fakeStore := fakes.NewRuleStore(t)
		rule := models.AlertRuleGen()()

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
		rule := models.AlertRuleGen()()

		groupRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithGroupKey(rule.GetGroupKey())))
		otherRules := models.GenerateAlertRules(3, models.AlertRuleGen(models.WithOrgID(rule.OrgID), models.WithNamespaceUIDNotIn(rule.NamespaceUID)))
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

// simulateSubmitted resets some fields of the structure that are not populated by API model to model conversion
func simulateSubmitted(rule *models.AlertRule) {
	rule.ID = 0
	rule.Version = 0
	rule.Updated = time.Time{}
}

func withOrgID(orgId int64) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.OrgID = orgId
	}
}

func withoutUID(rule *models.AlertRule) {
	rule.UID = ""
}

func withGroupKey(groupKey models.AlertRuleGroupKey) func(rule *models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = groupKey.RuleGroup
		rule.OrgID = groupKey.OrgID
		rule.NamespaceUID = groupKey.NamespaceUID
	}
}

func withUIDs(uids map[string]*models.AlertRule) func(rule *models.AlertRule) {
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
