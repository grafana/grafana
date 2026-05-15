package alertrule

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// makeAlertRuleSpec builds a minimal AlertRule with valid expressions, targeting the given folder.
func makeAlertRuleSpec(t *testing.T, folder, title string) *v0alpha1.AlertRule {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()
	return &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": folder,
			},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title: title,
			Expressions: v0alpha1.AlertRuleExpressionMap{
				"A": {
					QueryType:     new("query"),
					DatasourceUID: new(v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        new(true),
					RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
						From: v0alpha1.AlertRulePromDurationWMillis("5m"),
						To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.AlertRuleIntervalTrigger{
				Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
			NoDataState:  v0alpha1.AlertRuleNoDataState(rule.NoDataState),
			ExecErrState: v0alpha1.AlertRuleExecErrState(rule.ExecErrState),
		},
	}
}

// TestIntegrationListHistory exercises the grafana.app/get-history label selector.
func TestIntegrationListHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewAlertRuleClient(t, helper.Org1.Admin)

	common.CreateTestFolder(t, helper, "history-folder")

	resource := makeAlertRuleSpec(t, "history-folder", "history-rule-v1")
	created, err := client.Create(ctx, resource, v1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Delete(ctx, created.Name, v1.DeleteOptions{}) })

	// Two updates produce three versions total.
	for _, title := range []string{"history-rule-v2", "history-rule-v3"} {
		latest, err := client.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		latest.Spec.Title = title
		_, err = client.Update(ctx, latest, v1.UpdateOptions{})
		require.NoError(t, err)
	}

	t.Run("returns all versions for a known rule", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true",
			FieldSelector: "metadata.name=" + created.Name,
		})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(list.Items), 3, "expected at least 3 versions after two updates")

		titles := make(map[string]struct{}, len(list.Items))
		for _, item := range list.Items {
			titles[item.Spec.Title] = struct{}{}
		}
		assert.Contains(t, titles, "history-rule-v1")
		assert.Contains(t, titles, "history-rule-v2")
		assert.Contains(t, titles, "history-rule-v3")

		// Each item carries its rule version on ResourceVersion, so all entries are distinct.
		seen := make(map[string]struct{}, len(list.Items))
		for _, item := range list.Items {
			seen[item.ResourceVersion] = struct{}{}
		}
		assert.GreaterOrEqual(t, len(seen), 3, "history items should have distinct resource versions")
	})

	t.Run("rejects history requests without metadata.name field selector", func(t *testing.T) {
		_, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true",
		})
		require.Error(t, err, "history listing must require metadata.name")
	})

	t.Run("returns 404 for unknown rule", func(t *testing.T) {
		_, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true",
			FieldSelector: "metadata.name=does-not-exist",
		})
		require.Error(t, err)
	})

	t.Run("rejects mixing the history label with other label requirements", func(t *testing.T) {
		_, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true,grafana.app/folder=history-folder",
			FieldSelector: "metadata.name=" + created.Name,
		})
		require.Error(t, err)
	})

	t.Run("history list contains the initial version of a never-updated rule", func(t *testing.T) {
		fresh := makeAlertRuleSpec(t, "history-folder", "history-rule-initial")
		freshCreated, err := client.Create(ctx, fresh, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Delete(ctx, freshCreated.Name, v1.DeleteOptions{}) })

		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true",
			FieldSelector: "metadata.name=" + freshCreated.Name,
		})
		require.NoError(t, err)
		require.NotEmpty(t, list.Items, "a freshly created rule should appear in its own history")

		titles := make(map[string]struct{}, len(list.Items))
		for _, item := range list.Items {
			titles[item.Spec.Title] = struct{}{}
		}
		assert.Contains(t, titles, "history-rule-initial",
			"history of a never-updated rule should contain the original title")
	})

	t.Run("history items preserve the spec of each revision", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetHistory + "=true",
			FieldSelector: "metadata.name=" + created.Name,
		})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(list.Items), 3)

		// Fields that didn't change across updates must be consistent on every history item.
		for _, item := range list.Items {
			assert.Equal(t, created.Spec.Trigger.Interval, item.Spec.Trigger.Interval)
			require.Contains(t, item.Spec.Expressions, "A")
		}
	})
}

// TestIntegrationListTrash exercises the grafana.app/get-trash label selector. The
// alertRuleRestore feature flag is required for soft-deletes to be retained.
func TestIntegrationListTrash(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertRuleRestore,
		},
	})
	client := common.NewAlertRuleClient(t, helper.Org1.Admin)

	common.CreateTestFolder(t, helper, "trash-folder")

	live := makeAlertRuleSpec(t, "trash-folder", "live-rule-trash-test")
	liveCreated, err := client.Create(ctx, live, v1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Delete(ctx, liveCreated.Name, v1.DeleteOptions{}) })

	deleted := makeAlertRuleSpec(t, "trash-folder", "deleted-rule-trash-test")
	deletedCreated, err := client.Create(ctx, deleted, v1.CreateOptions{})
	require.NoError(t, err)
	require.NoError(t, client.Delete(ctx, deletedCreated.Name, v1.DeleteOptions{}))

	t.Run("trash includes deleted rules but not live ones", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)

		// metadata.uid is derived from the rule GUID, so a tombstone shares the live rule's UID.
		var sawDeleted bool
		for _, item := range list.Items {
			if item.UID == deletedCreated.UID {
				sawDeleted = true
			}
			assert.NotEqual(t, liveCreated.UID, item.UID, "live rule must not appear in trash")
		}
		assert.True(t, sawDeleted, "deleted rule should appear in trash listing")
	})

	t.Run("trash items carry a deletion timestamp", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)
		require.NotEmpty(t, list.Items, "expected at least one trashed rule")
		for _, item := range list.Items {
			assert.NotNil(t, item.DeletionTimestamp, "trashed rule %q should have a deletion timestamp", item.Name)
		}
	})

	t.Run("rejects non-true value for the trash label", func(t *testing.T) {
		_, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=false",
		})
		require.Error(t, err)
	})

	t.Run("trashed rule preserves its spec", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)

		var trashed *v0alpha1.AlertRule
		for i := range list.Items {
			if list.Items[i].UID == deletedCreated.UID {
				trashed = &list.Items[i]
				break
			}
		}
		require.NotNil(t, trashed)
		assert.Equal(t, "deleted-rule-trash-test", trashed.Spec.Title)
		assert.Equal(t, deletedCreated.Spec.Trigger.Interval, trashed.Spec.Trigger.Interval)
		require.Contains(t, trashed.Spec.Expressions, "A")
	})

	t.Run("multiple deletions all surface in trash", func(t *testing.T) {
		extra1 := makeAlertRuleSpec(t, "trash-folder", "extra-trash-1")
		extra1Created, err := client.Create(ctx, extra1, v1.CreateOptions{})
		require.NoError(t, err)
		require.NoError(t, client.Delete(ctx, extra1Created.Name, v1.DeleteOptions{}))

		extra2 := makeAlertRuleSpec(t, "trash-folder", "extra-trash-2")
		extra2Created, err := client.Create(ctx, extra2, v1.CreateOptions{})
		require.NoError(t, err)
		require.NoError(t, client.Delete(ctx, extra2Created.Name, v1.DeleteOptions{}))

		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)

		seen := make(map[types.UID]struct{}, len(list.Items))
		for _, item := range list.Items {
			seen[item.UID] = struct{}{}
		}
		assert.Contains(t, seen, deletedCreated.UID)
		assert.Contains(t, seen, extra1Created.UID)
		assert.Contains(t, seen, extra2Created.UID)
	})

	t.Run("trashed rule can be restored by Create after dropping metadata.uid", func(t *testing.T) {
		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)

		var trashed *v0alpha1.AlertRule
		for i := range list.Items {
			if list.Items[i].UID == deletedCreated.UID {
				trashed = &list.Items[i]
				break
			}
		}
		require.NotNil(t, trashed)

		// Clear server-managed metadata; a fresh UID/Name is assigned on Create.
		restore := trashed.DeepCopy()
		restore.Name = ""
		restore.UID = ""
		restore.ResourceVersion = ""
		restore.Generation = 0
		restore.DeletionTimestamp = nil
		restore.ManagedFields = nil

		restored, err := client.Create(ctx, restore, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = client.Delete(ctx, restored.Name, v1.DeleteOptions{}) })

		assert.Equal(t, trashed.Spec.Title, restored.Spec.Title)
		assert.NotEmpty(t, restored.Name)
		assert.NotEmpty(t, restored.UID)

		got, err := client.Get(ctx, restored.Name, v1.GetOptions{})
		require.NoError(t, err)
		assert.Nil(t, got.DeletionTimestamp)
	})

	t.Run("alerting trash excludes deleted recording rules", func(t *testing.T) {
		// Cross-type isolation: deleting a recording rule must not affect AlertRule trash.
		recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)
		recRule := ngmodels.RuleGen.With(
			ngmodels.RuleMuts.WithUniqueUID(),
			ngmodels.RuleMuts.WithNamespaceUID("trash-folder"),
			ngmodels.RuleMuts.WithAllRecordingRules(),
			ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
		).Generate()
		recording := &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
				Annotations: map[string]string{
					"grafana.app/folder": "trash-folder",
				},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:  "cross-type-recording-trash",
				Metric: v0alpha1.RecordingRuleMetricName(recRule.Record.Metric),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     new("query"),
						DatasourceUID: new(v0alpha1.RecordingRuleDatasourceUID(recRule.Data[0].DatasourceUID)),
						Model:         recRule.Data[0].Model,
						Source:        new(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", recRule.IntervalSeconds)),
				},
			},
		}
		recCreated, err := recClient.Create(ctx, recording, v1.CreateOptions{})
		require.NoError(t, err)
		require.NoError(t, recClient.Delete(ctx, recCreated.Name, v1.DeleteOptions{}))

		list, err := client.List(ctx, v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
		})
		require.NoError(t, err)
		for _, item := range list.Items {
			assert.NotEqual(t, recCreated.UID, item.UID)
			assert.NotEqual(t, "cross-type-recording-trash", item.Spec.Title)
		}
	})
}
