package recordingrule

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"

	prom_model "github.com/prometheus/common/model"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationResourceIdentifier(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	newResource := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:  rule.Title,
			Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     util.Pointer(rule.Data[0].QueryType),
					DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{
				Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
		},
	}

	// Test 1: Create with explicit name
	namedResource := newResource.Copy().(*v0alpha1.RecordingRule)
	namedResource.Name = "explicit-name-recording-rule"
	namedRule, err := client.Create(ctx, namedResource, v1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "explicit-name-recording-rule", namedRule.Name)
	require.NotEmpty(t, namedRule.UID)

	// Test 2: Create without explicit name (auto-generated)
	autoGenRule, err := client.Create(ctx, newResource, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, autoGenRule.Name)
	require.NotEmpty(t, autoGenRule.UID)

	// Test 3: Get by identifier
	retrievedRule, err := client.Get(ctx, autoGenRule.Name, v1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, autoGenRule.Name, retrievedRule.Name)
	require.Equal(t, newResource.Spec.Title, retrievedRule.Spec.Title)

	// Test 4: Update (should preserve name)
	updatedRule := retrievedRule.Copy().(*v0alpha1.RecordingRule)
	updatedRule.Spec.Title = "updated-recording-rule-title"

	finalRule, err := client.Update(ctx, updatedRule, v1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, "updated-recording-rule-title", finalRule.Spec.Title)
	require.Equal(t, retrievedRule.Name, finalRule.Name, "Update should preserve the resource name")
	// Note: Recording rule backend doesn't implement ResourceVersion, unlike alert rules

	// Test 5: Verify the update persisted
	finalRetrieved, err := client.Get(ctx, finalRule.Name, v1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, finalRule.Spec.Title, finalRetrieved.Spec.Title)
	require.Equal(t, finalRule.Name, finalRetrieved.Name)
	require.Equal(t, finalRule.ResourceVersion, finalRetrieved.ResourceVersion)

	// Cleanup
	require.NoError(t, client.Delete(ctx, namedRule.Name, v1.DeleteOptions{}))
	require.NoError(t, client.Delete(ctx, finalRule.Name, v1.DeleteOptions{}))
}

// TestIntegrationResourcePermissions is skipped for now as access control is handled in the service layer
func TestIntegrationResourcePermissions(t *testing.T) {
	t.Skip("Access control tests skipped - handled in service layer")
}

// TestIntegrationAccessControl tests basic access control functionality
// Access control is primarily handled in the service layer, so this test focuses on basic CRUD operations
func TestIntegrationAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	// Test with admin user for basic functionality
	adminClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	recordingRule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:  rule.Title,
			Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     util.Pointer(rule.Data[0].QueryType),
					DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{
				Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
		},
	}

	t.Run("admin should be able to create recording rule", func(t *testing.T) {
		created, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, recordingRule.Spec.Title, created.Spec.Title)

		// Cleanup
		defer func() {
			_ = adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		}()

		t.Run("admin should be able to read recording rule", func(t *testing.T) {
			read, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, created.Spec.Title, read.Spec.Title)
		})

		t.Run("admin should be able to update recording rule", func(t *testing.T) {
			updated := created.Copy().(*v0alpha1.RecordingRule)
			updated.Spec.Title = "updated-title"

			result, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
			require.NoError(t, err)
			require.Equal(t, "updated-title", result.Spec.Title)
		})

		t.Run("admin should be able to delete recording rule", func(t *testing.T) {
			err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})
}

func TestIntegrationCRUD(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	adminClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	baseGen := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	)

	t.Run("should be able to create and read recording rule", func(t *testing.T) {
		rule := baseGen.Generate()

		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder":     "test-folder",
					"grafana.com/provenance": "",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}

		created, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		t.Run("should be able to read what it is created", func(t *testing.T) {
			get, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, created.Spec.Title, get.Spec.Title)
			createdDuration, err := prom_model.ParseDuration(string(recordingRule.Spec.Trigger.Interval))
			require.NoError(t, err)
			require.Equal(t, createdDuration.String(), string(get.Spec.Trigger.Interval))

			provenance := get.GetProvenanceStatus()
			require.Equal(t, v0alpha1.ProvenanceStatusNone, provenance)
		})

		// Cleanup
		require.NoError(t, adminClient.Delete(ctx, created.Name, v1.DeleteOptions{}))
	})

	t.Run("should fail to create recording rule with invalid provenance status", func(t *testing.T) {
		rule := baseGen.Generate()

		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder":     "test-folder",
					"grafana.com/provenance": "invalid",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}

		_, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.Error(t, err, "Creating invalid rule should fail")
	})

	t.Run("should fail to create recording rule with invalid config", func(t *testing.T) {
		invalidRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:       "invalid-recording-rule",
				Expressions: v0alpha1.RecordingRuleExpressionMap{}, // Empty data should fail
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: "30s",
				},
			},
		}

		_, err := adminClient.Create(ctx, invalidRule, v1.CreateOptions{})
		require.Errorf(t, err, "Expected error but got successful result")
		// The validation happens at the service level, so we just need to verify it fails
		require.Error(t, err, "Creating invalid rule should fail")
	})

	t.Run("should not be able to add rule to group", func(t *testing.T) {
		rule := baseGen.Generate()

		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}

		created, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		get, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, created.Spec.Title, get.Spec.Title)

		// Attempt to update the group name via a patch (should fail)
		update := get
		if update.Labels == nil {
			update.Labels = map[string]string{}
		}
		update.Labels[v0alpha1.GroupLabelKey] = "new-group-name"
		_, err = adminClient.Update(ctx, update, v1.UpdateOptions{})
		require.Error(t, err, "Updating the group name should fail")

		// Cleanup
		require.NoError(t, adminClient.Delete(ctx, created.Name, v1.DeleteOptions{}))
	})

	t.Run("should not be able to create rule without any source query", func(t *testing.T) {
		rule := baseGen.Generate()

		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}

		created, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.ErrorContains(t, err, "one expression must be marked as source")
		require.Nil(t, created)
	})
	t.Run("should not be able to create rule with interval less than base", func(t *testing.T) {
		rule := baseGen.With(
			ngmodels.RuleMuts.WithInterval(time.Duration(1) * time.Second),
		).Generate()

		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}

		created, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
		require.ErrorContains(t, err, "trigger interval must be a multiple of base evaluation interval")
		require.Nil(t, created)
	})
}

func TestIntegrationPatch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	adminClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	recordingRule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:  rule.Title,
			Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     util.Pointer(rule.Data[0].QueryType),
					DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{
				Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
		},
	}

	current, err := adminClient.Create(ctx, recordingRule, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, current)

	t.Run("should patch with json patch", func(t *testing.T) {
		current, err := adminClient.Get(ctx, current.Name, v1.GetOptions{})
		require.NoError(t, err)

		patch := []map[string]any{
			{
				"op":    "replace",
				"path":  "/spec/title",
				"value": "patched-title",
			},
		}

		patchData, err := json.Marshal(patch)
		require.NoError(t, err)

		result, err := adminClient.Patch(ctx, current.Name, types.JSONPatchType, patchData, v1.PatchOptions{})
		require.NoError(t, err)

		require.Equal(t, "patched-title", result.Spec.Title)
	})

	// Cleanup
	require.NoError(t, adminClient.Delete(ctx, current.Name, v1.DeleteOptions{}))
}

func TestIntegrationBasicAPI(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	adminClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	t.Run("should be able to list rules", func(t *testing.T) {
		list, err := adminClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		// Should at least be able to list, even if empty
		require.NotNil(t, list)
	})

	t.Run("should handle get of non-existent rule", func(t *testing.T) {
		_, err := adminClient.Get(ctx, "non-existent", v1.GetOptions{})
		// The API might return different error types, so just check that it's an error
		require.Error(t, err)
		t.Logf("Got error: %s", err)
	})
}

func TestIntegrationFolderLabelSyncAndValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	// Prepare two folders for label sync update scenario
	common.CreateTestFolder(t, helper, "test-folder-a")
	common.CreateTestFolder(t, helper, "test-folder-b")

	baseGen := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder-a"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	)

	t.Run("should keep folder label in sync with folder annotation on create and update", func(t *testing.T) {
		rule := baseGen.Generate()
		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					v0alpha1.FolderAnnotationKey: "test-folder-a",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: v0alpha1.RecordingRulePromDuration("10s")},
			},
		}

		created, err := client.Create(ctx, recordingRule, v1.CreateOptions{})
		require.NoError(t, err)
		defer func() { _ = client.Delete(ctx, created.Name, v1.DeleteOptions{}) }()

		// On create, metadata.labels[v0alpha1.FolderLabelKey] should mirror annotation
		require.Equal(t, "test-folder-a", created.Labels[v0alpha1.FolderLabelKey])

		updated := created.Copy().(*v0alpha1.RecordingRule)
		if updated.Annotations == nil {
			updated.Annotations = map[string]string{}
		}
		updated.Annotations[v0alpha1.FolderAnnotationKey] = "test-folder-b"

		after, err := client.Update(ctx, updated, v1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, "test-folder-b", after.Annotations[v0alpha1.FolderAnnotationKey])
		require.Equal(t, "test-folder-b", after.Labels[v0alpha1.FolderLabelKey])
	})

	t.Run("should fail to create recording rule without folder annotation", func(t *testing.T) {
		rule := baseGen.Generate()
		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace:   "default",
				Annotations: map[string]string{},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: v0alpha1.RecordingRulePromDuration("10s")},
			},
		}

		created, err := client.Create(ctx, recordingRule, v1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, created)
	})

	t.Run("should fail to create rule with group labels preset", func(t *testing.T) {
		rule := baseGen.Generate()
		recordingRule := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					v0alpha1.FolderAnnotationKey: "test-folder-a",
				},
				Labels: map[string]string{
					v0alpha1.GroupLabelKey:      "some-group",
					v0alpha1.GroupIndexLabelKey: "0",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: v0alpha1.RecordingRulePromDuration("10s")},
			},
		}

		created, err := client.Create(ctx, recordingRule, v1.CreateOptions{})
		require.Error(t, err)
		require.Nil(t, created)
	})
}

func TestIntegrationListWithLabelSelectors(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	common.CreateTestFolder(t, helper, "rr-folder-alpha")
	common.CreateTestFolder(t, helper, "rr-folder-beta")

	makeRule := func(folder string) *v0alpha1.RecordingRule {
		rule := ngmodels.RuleGen.With(
			ngmodels.RuleMuts.WithUniqueUID(),
			ngmodels.RuleMuts.WithUniqueTitle(),
			ngmodels.RuleMuts.WithNamespaceUID(folder),
			ngmodels.RuleMuts.WithAllRecordingRules(),
			ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
		).Generate()
		return &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": folder,
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}
	}

	// Create 2 rules in rr-folder-alpha and 2 in rr-folder-beta.
	// Group selector tests are covered in the compat tests since the k8s API does not
	// support assigning rules to groups directly.
	alpha1, err := client.Create(ctx, makeRule("rr-folder-alpha"), v1.CreateOptions{})
	require.NoError(t, err)
	alpha2, err := client.Create(ctx, makeRule("rr-folder-alpha"), v1.CreateOptions{})
	require.NoError(t, err)
	beta1, err := client.Create(ctx, makeRule("rr-folder-beta"), v1.CreateOptions{})
	require.NoError(t, err)
	beta2, err := client.Create(ctx, makeRule("rr-folder-beta"), v1.CreateOptions{})
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = client.Delete(ctx, alpha1.Name, v1.DeleteOptions{})
		_ = client.Delete(ctx, alpha2.Name, v1.DeleteOptions{})
		_ = client.Delete(ctx, beta1.Name, v1.DeleteOptions{})
		_ = client.Delete(ctx, beta2.Name, v1.DeleteOptions{})
	})

	t.Run("filter by folder label include", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{LabelSelector: "grafana.app/folder=rr-folder-alpha"})
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
		for _, item := range list.Items {
			require.Equal(t, "rr-folder-alpha", item.Labels[v0alpha1.FolderLabelKey])
		}
	})

	t.Run("filter by folder label exclude", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{LabelSelector: "grafana.app/folder!=rr-folder-alpha"})
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
		for _, item := range list.Items {
			require.Equal(t, "rr-folder-beta", item.Labels[v0alpha1.FolderLabelKey])
		}
	})
}

func TestIntegrationListWithFieldSelectors(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	common.CreateTestFolder(t, helper, "rr-fs-folder")

	baseRule := func(folder string) *v0alpha1.RecordingRule {
		rule := ngmodels.RuleGen.With(
			ngmodels.RuleMuts.WithUniqueUID(),
			ngmodels.RuleMuts.WithUniqueTitle(),
			ngmodels.RuleMuts.WithNamespaceUID(folder),
			ngmodels.RuleMuts.WithAllRecordingRules(),
			ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
		).Generate()
		return &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": folder,
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  rule.Title,
				Metric: v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     util.Pointer(rule.Data[0].QueryType),
						DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}
	}

	t.Run("filter by spec.title", func(t *testing.T) {
		r1 := baseRule("rr-fs-folder")
		r1.Spec.Title = "rr-field-sel-title-unique-xyz"
		r2 := baseRule("rr-fs-folder")

		c1, err := client.Create(ctx, r1, v1.CreateOptions{})
		require.NoError(t, err)
		c2, err := client.Create(ctx, r2, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, c1.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, c2.Name, v1.DeleteOptions{})
		})

		list, err := client.List(ctx, v1.ListOptions{FieldSelector: "spec.title=rr-field-sel-title-unique-xyz"})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "rr-field-sel-title-unique-xyz", list.Items[0].Spec.Title)
	})

	t.Run("filter by spec.paused", func(t *testing.T) {
		paused1 := baseRule("rr-fs-folder")
		paused1.Spec.Paused = util.Pointer(true)
		paused2 := baseRule("rr-fs-folder")
		paused2.Spec.Paused = util.Pointer(true)
		active1 := baseRule("rr-fs-folder")
		active2 := baseRule("rr-fs-folder")

		cp1, err := client.Create(ctx, paused1, v1.CreateOptions{})
		require.NoError(t, err)
		cp2, err := client.Create(ctx, paused2, v1.CreateOptions{})
		require.NoError(t, err)
		ca1, err := client.Create(ctx, active1, v1.CreateOptions{})
		require.NoError(t, err)
		ca2, err := client.Create(ctx, active2, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, cp1.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, cp2.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, ca1.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, ca2.Name, v1.DeleteOptions{})
		})

		t.Run("true returns only paused rules", func(t *testing.T) {
			list, err := client.List(ctx, v1.ListOptions{
				LabelSelector: "grafana.app/folder=rr-fs-folder",
				FieldSelector: "spec.paused=true",
			})
			require.NoError(t, err)
			require.Len(t, list.Items, 2)
			for _, item := range list.Items {
				require.NotNil(t, item.Spec.Paused)
				require.True(t, *item.Spec.Paused)
			}
		})

		t.Run("false returns only non-paused rules", func(t *testing.T) {
			list, err := client.List(ctx, v1.ListOptions{
				LabelSelector: "grafana.app/folder=rr-fs-folder",
				FieldSelector: "spec.paused=false",
			})
			require.NoError(t, err)
			require.Len(t, list.Items, 2)
			for _, item := range list.Items {
				require.True(t, item.Spec.Paused == nil || !*item.Spec.Paused)
			}
		})
	})

	t.Run("filter by spec.metric", func(t *testing.T) {
		matchMetric := "rr_match_metric_unique"
		r1 := baseRule("rr-fs-folder")
		r1.Spec.Metric = v0alpha1.RecordingRuleMetricName(matchMetric)
		r2 := baseRule("rr-fs-folder")
		r2.Spec.Metric = v0alpha1.RecordingRuleMetricName(matchMetric)
		r3 := baseRule("rr-fs-folder") // different unique metric from baseRule

		c1, err := client.Create(ctx, r1, v1.CreateOptions{})
		require.NoError(t, err)
		c2, err := client.Create(ctx, r2, v1.CreateOptions{})
		require.NoError(t, err)
		c3, err := client.Create(ctx, r3, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, c1.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, c2.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, c3.Name, v1.DeleteOptions{})
		})

		list, err := client.List(ctx, v1.ListOptions{FieldSelector: "spec.metric=" + matchMetric})
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
		for _, item := range list.Items {
			require.Equal(t, matchMetric, string(item.Spec.Metric))
		}
	})

	t.Run("filter by spec.targetDatasourceUID", func(t *testing.T) {
		matchUID := "rr-target-ds-unique-uid"
		r1 := baseRule("rr-fs-folder")
		r1.Spec.TargetDatasourceUID = v0alpha1.RecordingRuleDatasourceUID(matchUID)
		r2 := baseRule("rr-fs-folder")
		r2.Spec.TargetDatasourceUID = v0alpha1.RecordingRuleDatasourceUID(matchUID)
		r3 := baseRule("rr-fs-folder")
		r3.Spec.TargetDatasourceUID = v0alpha1.RecordingRuleDatasourceUID("rr-target-ds-other-uid")

		c1, err := client.Create(ctx, r1, v1.CreateOptions{})
		require.NoError(t, err)
		c2, err := client.Create(ctx, r2, v1.CreateOptions{})
		require.NoError(t, err)
		c3, err := client.Create(ctx, r3, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = client.Delete(ctx, c1.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, c2.Name, v1.DeleteOptions{})
			_ = client.Delete(ctx, c3.Name, v1.DeleteOptions{})
		})

		list, err := client.List(ctx, v1.ListOptions{FieldSelector: "spec.targetDatasourceUID=" + matchUID})
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
		for _, item := range list.Items {
			require.Equal(t, matchUID, string(item.Spec.TargetDatasourceUID))
		}
	})
}
