package dryrun

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	unified "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const folderUID = "dryrun-folder"

var dryRunAll = []string{metav1.DryRunAll}

type ruleKind struct {
	name string
	gvr  schema.GroupVersionResource
	// spec builds a valid rule of this kind in the given folder.
	spec func(t *testing.T, folder, name, title string) map[string]any
}

var kinds = []ruleKind{
	{name: "AlertRule", gvr: v0alpha1.AlertRuleKind().GroupVersionResource(), spec: alertRule},
	{name: "RecordingRule", gvr: v0alpha1.RecordingRuleKind().GroupVersionResource(), spec: recordingRule},
}

// TestIntegrationDryRun checks that every mutating verb on the rule kinds honours
// dryRun=All in every storage mode: the request is validated and answered like a
// real write, but neither legacy SQL nor unified storage changes.
func TestIntegrationDryRun(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []struct {
		name string
		mode grafanarest.DualWriterMode
	}{
		{name: "Legacy", mode: grafanarest.Mode0},
		{name: "DualWrite", mode: grafanarest.Mode2},
		{name: "Unified", mode: grafanarest.Mode5},
	}
	for _, m := range modes {
		t.Run(m.name, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: m.mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: m.mode},
				},
				UnifiedAlertingDisableExecuteAlerts: true,
			})
			common.CreateTestFolder(t, helper, folderUID)
			for _, k := range kinds {
				t.Run(k.name, func(t *testing.T) {
					runDryRunTests(t, helper, k, m.mode)
				})
			}
		})
	}
}

func runDryRunTests(t *testing.T, helper *apis.K8sTestHelper, k ruleKind, mode grafanarest.DualWriterMode) {
	ctx := context.Background()
	client := helper.Org1.Admin.ResourceClient(t, k.gvr).Namespace(helper.Namespacer(helper.Org1.OrgID))
	prefix := fmt.Sprintf("dryrun-%s", k.gvr.Resource)

	t.Run("create", func(t *testing.T) {
		name := prefix + "-create"
		before := snapshot(t, helper, k, name)

		out, err := client.Create(ctx, toUnstructured(k.spec(t, folderUID, name, "created by dry run")), metav1.CreateOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		require.Equal(t, name, out.GetName())
		require.Equal(t, "created by dry run", title(t, out))

		require.Equal(t, before, snapshot(t, helper, k, name))
		_, err = client.Get(ctx, name, metav1.GetOptions{})
		require.Truef(t, apierrors.IsNotFound(err), "dry-run create must not persist the rule, got %v", err)
	})

	t.Run("create still validates", func(t *testing.T) {
		name := prefix + "-invalid"
		before := snapshot(t, helper, k, name)
		_, err := client.Create(ctx, toUnstructured(k.spec(t, "folder-that-does-not-exist", name, "invalid")), metav1.CreateOptions{DryRun: dryRunAll})
		require.Error(t, err)
		require.Equal(t, before, snapshot(t, helper, k, name))
	})

	name := prefix + "-existing"
	_, err := client.Create(ctx, toUnstructured(k.spec(t, folderUID, name, "original")), metav1.CreateOptions{})
	require.NoError(t, err)
	if mode != grafanarest.Mode0 {
		// DualWrite copies the rule to unified storage in the background.
		require.Eventually(t, func() bool {
			_, found, err := readUnified(helper, k, name)
			return err == nil && found
		}, 10*time.Second, 50*time.Millisecond)
	}

	t.Run("create of an existing name answers like the real create", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		duplicate := toUnstructured(k.spec(t, folderUID, name, "duplicate"))
		_, dryErr := client.Create(ctx, duplicate.DeepCopy(), metav1.CreateOptions{DryRun: dryRunAll})
		_, realErr := client.Create(ctx, duplicate.DeepCopy(), metav1.CreateOptions{})
		require.Equal(t, http.StatusConflict, statusCode(realErr), "real create: %v", realErr)
		require.Equal(t, statusCode(realErr), statusCode(dryErr), "dry-run create: %v", dryErr)
		require.Equal(t, before, snapshot(t, helper, k, name))
		requireTitle(t, client, name, "original")
	})

	// The legacy store rejects these when it writes. Admission rejects them too, so every mode does.
	storeInvalid := map[string]func(t *testing.T, obj *unstructured.Unstructured){
		"non-string queryType": func(t *testing.T, obj *unstructured.Unstructured) {
			require.NoError(t, unstructured.SetNestedField(obj.Object, int64(5), "spec", "expressions", "A", "model", "queryType"))
		},
		"name that is not a valid rule UID": func(t *testing.T, obj *unstructured.Unstructured) {
			obj.SetName(prefix + ".dotted")
		},
		"empty title": func(t *testing.T, obj *unstructured.Unstructured) {
			require.NoError(t, unstructured.SetNestedField(obj.Object, "", "spec", "title"))
		},
	}
	for desc, mutate := range storeInvalid {
		t.Run("create rejects a rule the store rejects: "+desc, func(t *testing.T) {
			invalid := toUnstructured(k.spec(t, folderUID, prefix+"-store-invalid", "store invalid"))
			mutate(t, invalid)
			before := snapshot(t, helper, k, invalid.GetName())

			_, dryErr := client.Create(ctx, invalid.DeepCopy(), metav1.CreateOptions{DryRun: dryRunAll})
			_, realErr := client.Create(ctx, invalid.DeepCopy(), metav1.CreateOptions{})
			require.Equal(t, http.StatusBadRequest, statusCode(realErr), "real create: %v", realErr)
			require.Equal(t, statusCode(realErr), statusCode(dryErr), "dry-run create: %v", dryErr)
			require.Equal(t, before, snapshot(t, helper, k, invalid.GetName()))
		})
	}

	t.Run("update", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		current, err := client.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedField(current.Object, "updated by dry run", "spec", "title"))

		out, err := client.Update(ctx, current, metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		require.Equal(t, "updated by dry run", title(t, out))

		require.Equal(t, before, snapshot(t, helper, k, name))
		requireTitle(t, client, name, "original")
	})

	t.Run("patch", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		out, err := client.Patch(ctx, name, types.MergePatchType, []byte(`{"spec":{"title":"patched by dry run"}}`), metav1.PatchOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		require.Equal(t, "patched by dry run", title(t, out))

		require.Equal(t, before, snapshot(t, helper, k, name))
		requireTitle(t, client, name, "original")
	})

	t.Run("patch status", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		_, err := client.Patch(ctx, name, types.MergePatchType, []byte(`{"status":{"lastError":"set by dry run"}}`), metav1.PatchOptions{DryRun: dryRunAll}, "status")
		require.NoError(t, err)

		require.Equal(t, before, snapshot(t, helper, k, name))
		current, err := client.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err)
		lastError, _, err := unstructured.NestedString(current.Object, "status", "lastError")
		require.NoError(t, err)
		require.Empty(t, lastError)
	})

	t.Run("delete", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		require.NoError(t, client.Delete(ctx, name, metav1.DeleteOptions{DryRun: dryRunAll}))

		require.Equal(t, before, snapshot(t, helper, k, name))
		requireTitle(t, client, name, "original")
	})

	t.Run("deletecollection", func(t *testing.T) {
		before := snapshot(t, helper, k, name)
		require.NoError(t, client.DeleteCollection(ctx, metav1.DeleteOptions{DryRun: dryRunAll}, metav1.ListOptions{}))

		require.Equal(t, before, snapshot(t, helper, k, name))
		requireTitle(t, client, name, "original")
	})
}

// persisted is everything a dry-run must leave untouched, read straight from the stores
// rather than through the API under test.
type persisted struct {
	legacyRule      string
	legacyStatus    string
	versionRows     int64
	provenanceRows  int64
	ruleRows        int64
	unifiedRV       int64
	unifiedNotFound bool
}

func snapshot(t *testing.T, helper *apis.K8sTestHelper, k ruleKind, name string) persisted {
	t.Helper()
	var p persisted
	orgID := helper.Org1.OrgID
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		var rows []struct {
			Title     string
			Version   int64
			K8sStatus *string `xorm:"k8s_status"`
		}
		if err := sess.Table("alert_rule").Cols("title", "version", "k8s_status").Where("org_id = ? AND uid = ?", orgID, name).Find(&rows); err != nil {
			return err
		}
		for _, r := range rows {
			p.legacyRule = fmt.Sprintf("%s@%d", r.Title, r.Version)
			if r.K8sStatus != nil {
				p.legacyStatus = *r.K8sStatus
			}
		}
		var err error
		if p.ruleRows, err = sess.Table("alert_rule").Where("org_id = ?", orgID).Count(); err != nil {
			return err
		}
		if p.versionRows, err = sess.Table("alert_rule_version").Where("rule_org_id = ?", orgID).Count(); err != nil {
			return err
		}
		p.provenanceRows, err = sess.Table("provenance_type").Where("org_id = ?", orgID).Count()
		return err
	})
	require.NoError(t, err)

	rv, found, err := readUnified(helper, k, name)
	require.NoError(t, err)
	p.unifiedRV = rv
	p.unifiedNotFound = !found
	return p
}

// readUnified reads the rule straight from unified storage, bypassing the dual writer.
func readUnified(helper *apis.K8sTestHelper, k ruleKind, name string) (rv int64, found bool, err error) {
	ctx, _ := identity.WithServiceIdentity(context.Background(), helper.Org1.OrgID)
	rsp, err := helper.GetEnv().ResourceClient.Read(ctx, &resourcepb.ReadRequest{Key: &resourcepb.ResourceKey{
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		Group:     k.gvr.Group,
		Resource:  k.gvr.Resource,
		Name:      name,
	}})
	if err != nil {
		if result := unified.AsErrorResult(err); result != nil && result.Code == int32(http.StatusNotFound) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return rsp.ResourceVersion, true, nil
}

// statusCode returns the HTTP status of an API error, or 0 for success.
func statusCode(err error) int {
	if err == nil {
		return 0
	}
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		return int(status.Status().Code)
	}
	return -1
}

func requireTitle(t *testing.T, client dynamic.ResourceInterface, name, want string) {
	t.Helper()
	current, err := client.Get(context.Background(), name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, want, title(t, current))
}

func title(t *testing.T, obj *unstructured.Unstructured) string {
	t.Helper()
	v, _, err := unstructured.NestedString(obj.Object, "spec", "title")
	require.NoError(t, err)
	return v
}

func toUnstructured(obj map[string]any) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: obj}
}

func toMap(t *testing.T, obj any) map[string]any {
	t.Helper()
	out, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(t, err)
	return out
}

func alertRule(t *testing.T, folder, name, title string) map[string]any {
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	obj := &v0alpha1.AlertRule{
		TypeMeta: metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.String(), Kind: "AlertRule"},
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Annotations: map[string]string{"grafana.app/folder": folder},
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
			Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
			NoDataState:  common.ToK8sNoDataState(rule.NoDataState),
			ExecErrState: common.ToK8sExecErrState(rule.ExecErrState),
		},
	}
	return toMap(t, obj)
}

func recordingRule(t *testing.T, folder, name, title string) map[string]any {
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithNamespaceUID(folder),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	obj := &v0alpha1.RecordingRule{
		TypeMeta: metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.String(), Kind: "RecordingRule"},
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
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
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
		},
	}
	return toMap(t, obj)
}
