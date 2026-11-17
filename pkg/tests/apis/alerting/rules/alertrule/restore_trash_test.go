package alertrule

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// prepareRestore mirrors what the Recently deleted UI sends to the create endpoint: the trash
// item's metadata and spec, minus server-managed fields and the group labels the create rejects.
// Generation is cleared too: unified storage marks trash items with a negative generation, which
// the create rejects.
func prepareRestore(meta v1.ObjectMeta) v1.ObjectMeta {
	out := *meta.DeepCopy()
	out.ResourceVersion = ""
	out.Generation = 0
	out.DeletionTimestamp = nil
	out.ManagedFields = nil
	out.Finalizers = nil
	delete(out.Labels, v0alpha1.GroupLabelKey)
	delete(out.Labels, v0alpha1.GroupIndexLabelKey)
	return out
}

func makeRecordingRuleSpec(t *testing.T, folder, title string) *v0alpha1.RecordingRule {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()
	return &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace:   "default",
			Annotations: map[string]string{"grafana.app/folder": folder},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:               title,
			Metric:              v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
			TargetDatasourceUID: v0alpha1.RecordingRuleDatasourceUID(rule.Record.TargetDatasourceUID),
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     new("query"),
					DatasourceUID: new(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        new(true),
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

func trashNames[T any](items []T, meta func(*T) v1.ObjectMeta) map[string]types.UID {
	out := make(map[string]types.UID, len(items))
	for i := range items {
		m := meta(&items[i])
		out[m.Name] = m.UID
	}
	return out
}

// TestIntegrationRestoreFromTrashRemovesTombstone restores a deleted rule the way the Recently
// deleted UI does (create with the trash item's metadata) and checks it leaves the trash.
func TestIntegrationRestoreFromTrashRemovesTombstone(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode2, rest.Mode3, rest.Mode4} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			ctx := context.Background()
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
				UnifiedAlertingDisableExecuteAlerts: true,
			})
			common.CreateTestFolder(t, helper, "restore-folder")

			t.Run("alert rule", func(t *testing.T) {
				client := common.NewAlertRuleClient(t, helper.Org1.Admin)
				spec := makeAlertRuleSpec(t, "restore-folder", "restore-alert")
				spec.Name = util.GenerateShortUID()
				created, err := client.Create(ctx, spec, v1.CreateOptions{})
				require.NoError(t, err)
				require.NoError(t, client.Delete(ctx, created.Name, v1.DeleteOptions{}))

				listTrash := func() []v0alpha1.AlertRule {
					list, err := client.List(ctx, v1.ListOptions{LabelSelector: utils.LabelKeyGetTrash + "=true"})
					require.NoError(t, err)
					return list.Items
				}

				var trashed *v0alpha1.AlertRule
				items := listTrash()
				for i := range items {
					if items[i].Spec.Title == "restore-alert" {
						trashed = &items[i]
					}
				}
				require.NotNil(t, trashed, "deleted rule should be in the trash")
				t.Logf("trash item: name=%s uid=%s (created name=%s uid=%s)", trashed.Name, trashed.UID, created.Name, created.UID)

				restore := &v0alpha1.AlertRule{ObjectMeta: prepareRestore(trashed.ObjectMeta), Spec: trashed.Spec}
				restored, err := client.Create(ctx, restore, v1.CreateOptions{})
				require.NoError(t, err)
				t.Cleanup(func() { _ = client.Delete(ctx, restored.Name, v1.DeleteOptions{}) })
				t.Logf("restored: name=%s uid=%s", restored.Name, restored.UID)

				names := trashNames(listTrash(), func(r *v0alpha1.AlertRule) v1.ObjectMeta { return r.ObjectMeta })
				assert.NotContains(t, names, trashed.Name, "restored rule must leave the trash")
			})

			t.Run("recording rule", func(t *testing.T) {
				client := common.NewRecordingRuleClient(t, helper.Org1.Admin)
				spec := makeRecordingRuleSpec(t, "restore-folder", "restore-recording")
				spec.Name = util.GenerateShortUID()
				created, err := client.Create(ctx, spec, v1.CreateOptions{})
				require.NoError(t, err)
				require.NoError(t, client.Delete(ctx, created.Name, v1.DeleteOptions{}))

				listTrash := func() []v0alpha1.RecordingRule {
					list, err := client.List(ctx, v1.ListOptions{LabelSelector: utils.LabelKeyGetTrash + "=true"})
					require.NoError(t, err)
					return list.Items
				}

				var trashed *v0alpha1.RecordingRule
				items := listTrash()
				for i := range items {
					if items[i].Spec.Title == "restore-recording" {
						trashed = &items[i]
					}
				}
				require.NotNil(t, trashed, "deleted rule should be in the trash")
				t.Logf("trash item: name=%s uid=%s (created name=%s uid=%s)", trashed.Name, trashed.UID, created.Name, created.UID)

				restore := &v0alpha1.RecordingRule{ObjectMeta: prepareRestore(trashed.ObjectMeta), Spec: trashed.Spec}
				restored, err := client.Create(ctx, restore, v1.CreateOptions{})
				require.NoError(t, err)
				t.Cleanup(func() { _ = client.Delete(ctx, restored.Name, v1.DeleteOptions{}) })

				names := trashNames(listTrash(), func(r *v0alpha1.RecordingRule) v1.ObjectMeta { return r.ObjectMeta })
				assert.NotContains(t, names, trashed.Name, "restored rule must leave the trash")
			})
		})
	}
}

// getRulerTrash returns the tombstones the legacy ruler API lists, keyed by GUID.
func getRulerTrash(t *testing.T, helper *apis.K8sTestHelper) map[string]apimodels.GettableExtendedRuleNode {
	t.Helper()
	var resp apimodels.NamespaceConfigResponse
	r := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   "/api/ruler/grafana/api/v1/rules?deleted=true",
	}, &resp)
	require.Equal(t, http.StatusOK, r.Response.StatusCode, string(r.Body))
	out := map[string]apimodels.GettableExtendedRuleNode{}
	for _, groups := range resp {
		for _, g := range groups {
			for _, rule := range g.Rules {
				out[rule.GrafanaManagedAlert.GUID] = rule
			}
		}
	}
	return out
}

// postRulerGroup restores a tombstone through the ruler API the way the legacy UI does: it posts
// the deleted rule DTO as-is into a group. The GUID field does not exist on the postable model.
func postRulerGroup(t *testing.T, helper *apis.K8sTestHelper, folder, group string, rule apimodels.GettableExtendedRuleNode, uid string) {
	t.Helper()
	raw, err := json.Marshal(rule)
	require.NoError(t, err)
	var postable apimodels.PostableExtendedRuleNode
	require.NoError(t, json.Unmarshal(raw, &postable))
	postable.GrafanaManagedAlert.UID = uid
	if postable.GrafanaManagedAlert.MissingSeriesEvalsToResolve == nil {
		// A nil value on a rule with a UID means "keep the existing value", which a new rule
		// does not have. 0 asks for the default.
		postable.GrafanaManagedAlert.MissingSeriesEvalsToResolve = new(int64(0))
	}

	body, err := json.Marshal(apimodels.PostableRuleGroupConfig{
		Name:     group,
		Interval: 0,
		Rules:    []apimodels.PostableExtendedRuleNode{postable},
	})
	require.NoError(t, err)
	r := apis.DoRequest(helper, apis.RequestParams{
		User:        helper.Org1.Admin,
		Method:      http.MethodPost,
		Path:        "/api/ruler/grafana/api/v1/rules/" + folder + "?subtype=cortex",
		Body:        body,
		ContentType: "application/json",
	}, &map[string]any{})
	require.Equal(t, http.StatusAccepted, r.Response.StatusCode, string(r.Body))
}

// TestIntegrationRulerRestoreFromTrash compares the legacy ruler restore with the k8s one.
func TestIntegrationRulerRestoreFromTrash(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewAlertRuleClient(t, helper.Org1.Admin)
	common.CreateTestFolder(t, helper, "ruler-restore-folder")
	// The ruler API validates that query data sources exist; the k8s create does not.
	helper.CreateDS(&datasources.AddDataSourceCommand{
		OrgID: helper.Org1.OrgID,
		Name:  "ruler-restore-ds",
		UID:   "ruler-restore-ds",
		Type:  "testdata",
	})

	deleteAndFindTombstone := func(t *testing.T, title string) (*v0alpha1.AlertRule, apimodels.GettableExtendedRuleNode) {
		t.Helper()
		spec := makeAlertRuleSpec(t, "ruler-restore-folder", title)
		query := spec.Spec.Expressions["A"]
		query.DatasourceUID = new(v0alpha1.AlertRuleDatasourceUID("ruler-restore-ds"))
		spec.Spec.Expressions["A"] = query
		created, err := client.Create(ctx, spec, v1.CreateOptions{})
		require.NoError(t, err)
		require.NoError(t, client.Delete(ctx, created.Name, v1.DeleteOptions{}))
		trash := getRulerTrash(t, helper)
		for _, rule := range trash {
			if rule.GrafanaManagedAlert.Title == title {
				return created, rule
			}
		}
		require.FailNow(t, "deleted rule should be in the ruler trash")
		return nil, apimodels.GettableExtendedRuleNode{}
	}

	t.Run("restore as the legacy UI does keeps the tombstone", func(t *testing.T) {
		// The tombstone has no UID, so the restored rule gets a new UID and nothing ties it to
		// the tombstone.
		_, tombstone := deleteAndFindTombstone(t, "ruler-restore-blank-uid")
		require.Empty(t, tombstone.GrafanaManagedAlert.UID)
		postRulerGroup(t, helper, "ruler-restore-folder", "ruler-restore-blank-uid", tombstone, "")

		assert.Contains(t, getRulerTrash(t, helper), tombstone.GrafanaManagedAlert.GUID)
	})

	t.Run("restore with the tombstone GUID as UID removes the tombstone", func(t *testing.T) {
		// This is the identity the k8s trash list exposes as metadata.name.
		_, tombstone := deleteAndFindTombstone(t, "ruler-restore-guid-uid")
		guid := tombstone.GrafanaManagedAlert.GUID
		postRulerGroup(t, helper, "ruler-restore-folder", "ruler-restore-guid-uid", tombstone, guid)

		assert.NotContains(t, getRulerTrash(t, helper), guid)
		restored, err := client.Get(ctx, guid, v1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, "ruler-restore-guid-uid", restored.Spec.Title)
	})
}
