package schedule

import (
	"encoding/json"
	"math/rand"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestSchedulableAlertRulesRegistry(t *testing.T) {
	r := alertRulesRegistry{rules: make(map[models.AlertRuleKey]*models.AlertRule)}
	rules, folders := r.all()
	assert.Len(t, rules, 0)
	assert.Len(t, folders, 0)

	expectedFolders := map[models.FolderKey]string{{OrgID: 1, UID: "test-uid"}: "test-title"}
	// replace all rules in the registry with foo
	r.set([]*models.AlertRule{{OrgID: 1, UID: "foo", Version: 1}}, expectedFolders)
	rules, folders = r.all()
	assert.Len(t, rules, 1)
	assert.Equal(t, expectedFolders, folders)

	foo := r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 1}, *foo)

	// update foo to a newer version
	r.update(&models.AlertRule{OrgID: 1, UID: "foo", Version: 2})
	rules, _ = r.all()
	assert.Len(t, rules, 1)
	foo = r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 2}, *foo)

	// update bar which does not exist in the registry
	r.update(&models.AlertRule{OrgID: 1, UID: "bar", Version: 1})
	rules, _ = r.all()
	assert.Len(t, rules, 2)
	foo = r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "foo", Version: 2}, *foo)
	bar := r.get(models.AlertRuleKey{OrgID: 1, UID: "bar"})
	require.NotNil(t, foo)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "bar", Version: 1}, *bar)

	// replace all rules in the registry with baz
	r.set([]*models.AlertRule{{OrgID: 1, UID: "baz", Version: 1}}, nil)
	rules, folders = r.all()
	assert.Len(t, rules, 1)
	assert.Nil(t, folders)
	baz := r.get(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	require.NotNil(t, baz)
	assert.Equal(t, models.AlertRule{OrgID: 1, UID: "baz", Version: 1}, *baz)
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "foo"}))
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "bar"}))

	// delete baz
	deleted, ok := r.del(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	assert.True(t, ok)
	require.NotNil(t, deleted)
	assert.Equal(t, *deleted, *baz)
	rules, folders = r.all()
	assert.Len(t, rules, 0)
	assert.Len(t, folders, 0)
	assert.Nil(t, r.get(models.AlertRuleKey{OrgID: 1, UID: "baz"}))

	// baz cannot be deleted twice
	deleted, ok = r.del(models.AlertRuleKey{OrgID: 1, UID: "baz"})
	assert.False(t, ok)
	assert.Nil(t, deleted)
}

func TestSchedulableAlertRulesRegistry_set(t *testing.T) {
	gen := models.RuleGen
	initialRules := gen.GenerateManyRef(100)
	init := make(map[models.AlertRuleKey]*models.AlertRule, len(initialRules))
	for _, rule := range initialRules {
		init[rule.GetKey()] = rule
	}
	r := alertRulesRegistry{rules: init}
	t.Run("should return empty diff if exactly the same rules", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		for _, rule := range initialRules {
			newRules = append(newRules, models.CopyRule(rule))
		}
		diff := r.set(newRules, map[models.FolderKey]string{})
		require.Truef(t, diff.IsEmpty(), "Diff is not empty. Probably we check something else than key + version")
	})
	t.Run("should return empty diff if version does not change", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		// generate random and then override rule key + version
		randomNew := gen.GenerateManyRef(len(initialRules))
		for i := 0; i < len(initialRules); i++ {
			rule := randomNew[i]
			oldRule := initialRules[i]
			rule.UID = oldRule.UID
			rule.OrgID = oldRule.OrgID
			rule.Version = oldRule.Version
			newRules = append(newRules, rule)
		}

		diff := r.set(newRules, map[models.FolderKey]string{})
		require.Truef(t, diff.IsEmpty(), "Diff is not empty. Probably we check something else than key + version")
	})
	t.Run("should return key in diff if version changes", func(t *testing.T) {
		newRules := make([]*models.AlertRule, 0, len(initialRules))
		expectedUpdated := map[models.AlertRuleKey]struct{}{}
		for i, rule := range initialRules {
			cp := models.CopyRule(rule)
			if i%2 == 0 {
				cp.Version++
				expectedUpdated[cp.GetKey()] = struct{}{}
			}
			newRules = append(newRules, cp)
		}
		require.NotEmptyf(t, expectedUpdated, "Input parameters have changed. Nothing to assert")

		diff := r.set(newRules, map[models.FolderKey]string{})
		require.Falsef(t, diff.IsEmpty(), "Diff is empty but should not be")
		require.Equal(t, expectedUpdated, diff.updated)
	})
}

func TestRuleWithFolderFingerprint(t *testing.T) {
	rule := models.RuleGen.GenerateRef()
	title := uuid.NewString()
	f := ruleWithFolder{rule: rule, folderTitle: title}.Fingerprint()
	t.Run("should calculate a fingerprint", func(t *testing.T) {
		require.NotEqual(t, 0, uint64(f))
	})
	t.Run("mirror copy should have the same fingerprint", func(t *testing.T) {
		f2 := ruleWithFolder{rule: models.CopyRule(rule), folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})
	t.Run("order of queries should not affect the fingerprint", func(t *testing.T) {
		cp := models.CopyRule(rule)
		rand.Shuffle(len(cp.Data), func(i, j int) {
			cp.Data[i], cp.Data[j] = cp.Data[j], cp.Data[i]
		})
		f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})
	t.Run("folder name should be used in fingerprint", func(t *testing.T) {
		f2 := ruleWithFolder{rule: rule, folderTitle: uuid.NewString()}.Fingerprint()
		require.NotEqual(t, f, f2)
	})
	t.Run("Version, Updated, IntervalSeconds, GUID and Annotations should be excluded from fingerprint", func(t *testing.T) {
		cp := models.CopyRule(rule)
		cp.Version++
		cp.Updated = cp.Updated.Add(1 * time.Second)
		cp.IntervalSeconds++
		cp.Annotations = make(map[string]string)
		cp.Annotations["test"] = "test"
		cp.GUID = uuid.NewString()

		f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
		require.Equal(t, f, f2)
	})

	t.Run("all other fields should be considered", func(t *testing.T) {
		r1 := &models.AlertRule{
			ID:        1,
			OrgID:     2,
			Title:     "test",
			Condition: "A",
			Data: []models.AlertQuery{
				{
					RefID:     "1",
					QueryType: "323",
					RelativeTimeRange: models.RelativeTimeRange{
						From: 1,
						To:   2,
					},
					DatasourceUID: "123",
					Model:         json.RawMessage(`{"test": "test-model"}`),
				},
			},
			Updated:         time.Now(),
			IntervalSeconds: 2,
			Version:         1,
			UID:             "test-uid",
			NamespaceUID:    "test-ns",
			DashboardUID:    func(s string) *string { return &s }("dashboard"),
			PanelID:         func(i int64) *int64 { return &i }(123),
			RuleGroup:       "test-group",
			RuleGroupIndex:  1,
			NoDataState:     "test-nodata",
			ExecErrState:    "test-err",
			Record:          &models.Record{Metric: "my_metric", From: "A"},
			For:             12,
			Annotations: map[string]string{
				"key-annotation": "value-annotation",
			},
			Labels: map[string]string{
				"key-label": "value-label",
			},
			IsPaused: false,
			NotificationSettings: []models.NotificationSettings{
				models.NotificationSettingsGen()(),
			},
			Metadata: models.AlertRuleMetadata{
				EditorSettings: models.EditorSettings{
					SimplifiedQueryAndExpressionsSection: false,
					SimplifiedNotificationsSection:       false,
				},
			},
		}
		r2 := &models.AlertRule{
			ID:        2,
			OrgID:     3,
			Title:     "test-2",
			Condition: "B",
			Data: []models.AlertQuery{
				{
					RefID:     "2",
					QueryType: "12313123",
					RelativeTimeRange: models.RelativeTimeRange{
						From: 2,
						To:   3,
					},
					DatasourceUID: "asdasdasd21",
					Model:         json.RawMessage(`{"test": "test-model-2"}`),
				},
			},
			IntervalSeconds: 23,
			UID:             "test-uid2",
			NamespaceUID:    "test-ns2",
			DashboardUID:    func(s string) *string { return &s }("dashboard-2"),
			PanelID:         func(i int64) *int64 { return &i }(1222),
			RuleGroup:       "test-group-2",
			RuleGroupIndex:  22,
			NoDataState:     "test-nodata2",
			ExecErrState:    "test-err2",
			Record:          &models.Record{Metric: "my_metric2", From: "B"},
			For:             1141,
			Annotations: map[string]string{
				"key-annotation2": "value-annotation",
			},
			Labels: map[string]string{
				"key-label": "value-label23",
			},
			IsPaused: true,
			NotificationSettings: []models.NotificationSettings{
				models.NotificationSettingsGen()(),
			},
			Metadata: models.AlertRuleMetadata{
				EditorSettings: models.EditorSettings{
					SimplifiedQueryAndExpressionsSection: true,
				},
			},
		}

		excludedFields := map[string]struct{}{
			"Version":         {},
			"Updated":         {},
			"UpdatedBy":       {},
			"IntervalSeconds": {},
			"Annotations":     {},
			"ID":              {},
			"OrgID":           {},
			"GUID":            {},
		}

		tp := reflect.TypeOf(rule).Elem()
		var nonDiffFields []string
		// making sure that we get completely different struct

		dif := r1.Diff(r2)
		nonDiffFields = make([]string, 0)
		for j := 0; j < tp.NumField(); j++ {
			name := tp.Field(j).Name
			if _, ok := excludedFields[name]; ok {
				continue
			}
			if len(dif.GetDiffsForField(tp.Field(j).Name)) == 0 {
				nonDiffFields = append(nonDiffFields, tp.Field(j).Name)
			}
		}
		require.Emptyf(t, nonDiffFields, "cannot generate completely unique alert rule. Some fields are not randomized")

		r2v := reflect.ValueOf(r2).Elem()
		for i := 0; i < tp.NumField(); i++ {
			if _, ok := excludedFields[tp.Field(i).Name]; ok {
				continue
			}
			cp := models.CopyRule(r1)
			v := reflect.ValueOf(cp).Elem()
			vf := v.Field(i)
			vf.Set(r2v.Field(i))
			f2 := ruleWithFolder{rule: cp, folderTitle: title}.Fingerprint()
			if f2 == f {
				t.Fatalf("Field %s does not seem to be used in fingerprint. Diff: %s", tp.Field(i).Name, r1.Diff(cp))
			}
		}
	})
}
