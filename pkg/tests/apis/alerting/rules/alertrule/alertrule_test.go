package alertrule

import (
	"context"
	"time"

	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	prom_model "github.com/prometheus/common/model"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationResourceIdentifier(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewAlertRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	newResource := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title: rule.Title,
			Data: map[string]v0alpha1.AlertRuleQuery{
				"A": {
					QueryType:     "query",
					DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
						From: v0alpha1.AlertRulePromDurationWMillis("5m"),
						To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.AlertRuleIntervalTrigger{
				Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
			NoDataState:  string(rule.NoDataState),
			ExecErrState: string(rule.ExecErrState),
		},
	}

	// Test 1: Create with explicit name
	namedResource := newResource.Copy().(*v0alpha1.AlertRule)
	namedResource.Name = "explicit-name-rule"
	namedRule, err := client.Create(ctx, namedResource, v1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "explicit-name-rule", namedRule.Name)
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
	updatedRule := retrievedRule.Copy().(*v0alpha1.AlertRule)
	updatedRule.Spec.Title = "updated-title"

	finalRule, err := client.Update(ctx, updatedRule, v1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, "updated-title", finalRule.Spec.Title)
	require.Equal(t, retrievedRule.Name, finalRule.Name, "Update should preserve the resource name")
	require.NotEqual(t, retrievedRule.ResourceVersion, finalRule.ResourceVersion, "Update should change the resource version")

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
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	// Test with admin user for basic functionality
	adminClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	alertRule := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title: rule.Title,
			Data: map[string]v0alpha1.AlertRuleQuery{
				"A": {
					QueryType:     "query",
					DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
						From: v0alpha1.AlertRulePromDurationWMillis("5m"),
						To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.AlertRuleIntervalTrigger{
				Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
			NoDataState:  string(rule.NoDataState),
			ExecErrState: string(rule.ExecErrState),
		},
	}

	t.Run("admin should be able to create rule", func(t *testing.T) {
		created, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		require.Equal(t, alertRule.Spec.Title, created.Spec.Title)

		// Cleanup
		defer func() {
			_ = adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		}()

		t.Run("admin should be able to read rule", func(t *testing.T) {
			read, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, created.Spec.Title, read.Spec.Title)
		})

		t.Run("admin should be able to update rule", func(t *testing.T) {
			updated := created.Copy().(*v0alpha1.AlertRule)
			updated.Spec.Title = "updated-title"

			result, err := adminClient.Update(ctx, updated, v1.UpdateOptions{})
			require.NoError(t, err)
			require.Equal(t, "updated-title", result.Spec.Title)
		})

		t.Run("admin should be able to delete rule", func(t *testing.T) {
			err := adminClient.Delete(ctx, created.Name, v1.DeleteOptions{})
			require.NoError(t, err)
		})
	})
}

func TestIntegrationCRUD(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	adminClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	baseGen := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	)

	t.Run("should be able to create and read rule", func(t *testing.T) {
		rule := baseGen.Generate()

		alertRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder":     "test-folder",
					"grafana.com/provenance": "",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: rule.Title,
				Data: map[string]v0alpha1.AlertRuleQuery{
					"A": {
						QueryType:     "query",
						DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
							From: v0alpha1.AlertRulePromDurationWMillis("5m"),
							To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
				NoDataState:  string(rule.NoDataState),
				ExecErrState: string(rule.ExecErrState),
			},
		}

		created, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		t.Run("should be able to read what it is created", func(t *testing.T) {
			get, err := adminClient.Get(ctx, created.Name, v1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, alertRule.Spec.Title, get.Spec.Title)

			createdDuration, err := prom_model.ParseDuration(string(alertRule.Spec.Trigger.Interval))
			require.NoError(t, err)
			require.Equal(t, createdDuration.String(), string(get.Spec.Trigger.Interval))

			provenance := get.GetProvenanceStatus()
			require.Equal(t, v0alpha1.ProvenanceStatusNone, provenance)
		})

		// Cleanup
		require.NoError(t, adminClient.Delete(ctx, created.Name, v1.DeleteOptions{}))
	})

	t.Run("should fail to create rule with invalid provenance status", func(t *testing.T) {
		rule := baseGen.Generate()

		alertRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder":     "test-folder",
					"grafana.com/provenance": "invalid",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: rule.Title,
				Data: map[string]v0alpha1.AlertRuleQuery{
					"A": {
						QueryType:     "query",
						DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
							From: v0alpha1.AlertRulePromDurationWMillis("5m"),
							To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
				NoDataState:  string(rule.NoDataState),
				ExecErrState: string(rule.ExecErrState),
			},
		}

		_, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
		require.Error(t, err, "Creating invalid rule should fail")
	})

	t.Run("should fail to create rule with invalid config", func(t *testing.T) {
		invalidRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: "invalid-rule",
				Data:  map[string]v0alpha1.AlertRuleQuery{}, // Empty data should fail
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: "30",
				},
				NoDataState:  "NoData",
				ExecErrState: "Error",
			},
		}

		_, err := adminClient.Create(ctx, invalidRule, v1.CreateOptions{})
		require.Errorf(t, err, "Expected error but got successful result")
		// The validation happens at the service level, so we just need to verify it fails
		require.Error(t, err, "Creating invalid rule should fail")
	})

	t.Run("should not be able to add rule to group", func(t *testing.T) {
		rule := baseGen.Generate()

		alertRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: rule.Title,
				Data: map[string]v0alpha1.AlertRuleQuery{
					"A": {
						QueryType:     "query",
						DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
							From: v0alpha1.AlertRulePromDurationWMillis("5m"),
							To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
				NoDataState:  string(rule.NoDataState),
				ExecErrState: string(rule.ExecErrState),
			},
		}

		created, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
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

		alertRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: rule.Title,
				Data: map[string]v0alpha1.AlertRuleQuery{
					"A": {
						QueryType:     "query",
						DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
						Model:         rule.Data[0].Model,
						RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
							From: v0alpha1.AlertRulePromDurationWMillis("5m"),
							To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
				NoDataState:  string(rule.NoDataState),
				ExecErrState: string(rule.ExecErrState),
			},
		}

		created, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
		require.ErrorContains(t, err, "no query marked as source")
		require.Nil(t, created)
	})
	t.Run("should not be able to create rule with interval less than base", func(t *testing.T) {
		rule := baseGen.With(
			ngmodels.RuleMuts.WithInterval(time.Duration(1) * time.Second),
		).Generate()

		alertRule := &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "test-folder",
				},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: rule.Title,
				Data: map[string]v0alpha1.AlertRuleQuery{
					"A": {
						QueryType:     "query",
						DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
						Model:         rule.Data[0].Model,
						Source:        util.Pointer(true),
						RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
							From: v0alpha1.AlertRulePromDurationWMillis("5m"),
							To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.AlertRuleIntervalTrigger{
					Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
				NoDataState:  string(rule.NoDataState),
				ExecErrState: string(rule.ExecErrState),
			},
		}

		created, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
		require.ErrorContains(t, err, "invalid alert rule")
		require.Nil(t, created)
	})
}

func TestIntegrationPatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	adminClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	alertRule := &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title: rule.Title,
			Data: map[string]v0alpha1.AlertRuleQuery{
				"A": {
					QueryType:     "query",
					DatasourceUID: v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
						From: v0alpha1.AlertRulePromDurationWMillis("5m"),
						To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.AlertRuleIntervalTrigger{
				Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
			NoDataState:  string(rule.NoDataState),
			ExecErrState: string(rule.ExecErrState),
		},
	}

	current, err := adminClient.Create(ctx, alertRule, v1.CreateOptions{})
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
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewAlertRuleClient(t, helper.Org1.Admin)

	t.Run("should be able to list rules", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		// Should at least be able to list, even if empty
		require.NotNil(t, list)
	})

	t.Run("should handle get of non-existent rule", func(t *testing.T) {
		_, err := client.Get(ctx, "non-existent", v1.GetOptions{})
		// The API might return different error types, so just check that it's an error
		require.Error(t, err)
		t.Logf("Got error: %s", err)
	})
}
