package alertrule

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Both versions serve the same rules: whichever version writes a rule, the
// other reads it, and v1beta1 requires the notification settings type that
// v0alpha1 defaults.
func TestIntegrationV1beta1(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Legacy storage serves modes 0-3 and unified storage mode 4. The dual writer
	// in between can hand either one the object in the version of the request.
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode0, grafanarest.Mode2, grafanarest.Mode4, grafanarest.Mode5} {
		t.Run(fmt.Sprintf("dualWriterMode=%d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"alertrules.rules.alerting.grafana.app":     {DualWriterMode: mode},
					"recordingrules.rules.alerting.grafana.app": {DualWriterMode: mode},
				},
				UnifiedAlertingDisableExecuteAlerts: true,
			})
			common.CreateTestFolder(t, helper, "test-folder")
			runV1beta1Tests(t, helper, mode)
		})
	}
}

type versionClient struct {
	rc *rest.RESTClient
	gv schema.GroupVersion
}

func (c versionClient) path(resource string, name ...string) []string {
	return append([]string{"apis", c.gv.Group, c.gv.Version, "namespaces", "default", resource}, name...)
}

func (c versionClient) create(ctx context.Context, resource string, obj map[string]any) (map[string]any, error) {
	obj["apiVersion"] = c.gv.String()
	body, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	raw, err := c.rc.Post().AbsPath(c.path(resource)...).Body(body).DoRaw(ctx)
	return decode(raw, err)
}

func (c versionClient) update(ctx context.Context, resource string, obj map[string]any) (map[string]any, error) {
	obj["apiVersion"] = c.gv.String()
	body, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	name := obj["metadata"].(map[string]any)["name"].(string)
	raw, err := c.rc.Put().AbsPath(c.path(resource, name)...).Body(body).DoRaw(ctx)
	return decode(raw, err)
}

func (c versionClient) updateStatus(ctx context.Context, resource string, obj map[string]any) (map[string]any, error) {
	obj["apiVersion"] = c.gv.String()
	body, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	name := obj["metadata"].(map[string]any)["name"].(string)
	raw, err := c.rc.Put().AbsPath(c.path(resource, name, "status")...).Body(body).DoRaw(ctx)
	return decode(raw, err)
}

func (c versionClient) get(ctx context.Context, resource, name string) (map[string]any, error) {
	raw, err := c.rc.Get().AbsPath(c.path(resource, name)...).DoRaw(ctx)
	return decode(raw, err)
}

func (c versionClient) list(ctx context.Context, resource string) (map[string]any, error) {
	raw, err := c.rc.Get().AbsPath(c.path(resource)...).DoRaw(ctx)
	return decode(raw, err)
}

func (c versionClient) delete(ctx context.Context, resource, name string) error {
	return c.rc.Delete().AbsPath(c.path(resource, name)...).Do(ctx).Error()
}

func decode(raw []byte, err error) (map[string]any, error) {
	if err != nil {
		return nil, fmt.Errorf("%w: %s", err, raw)
	}
	var out map[string]any
	return out, json.Unmarshal(raw, &out)
}

// readUnified reads a rule straight from unified storage, bypassing the dual writer.
func readUnified(t *testing.T, helper *apis.K8sTestHelper, resource, name string) map[string]any {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(context.Background(), helper.Org1.OrgID)
	key := &resourcepb.ResourceKey{Namespace: "default", Group: v1beta1.GroupVersion.Group, Resource: resource, Name: name}
	var out map[string]any
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		rsp, err := helper.GetEnv().ResourceClient.Read(ctx, &resourcepb.ReadRequest{Key: key})
		require.NoError(c, err)
		require.Nil(c, rsp.Error)
		require.NoError(c, json.Unmarshal(rsp.Value, &out))
	}, 5*time.Second, 50*time.Millisecond)
	return out
}

// seedUnified writes a copy of a rule straight into unified storage, bypassing the dual
// writer, so a test can observe whether a later write touches it.
func seedUnified(t *testing.T, helper *apis.K8sTestHelper, resource string, rule map[string]any) {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(context.Background(), helper.Org1.OrgID)
	name := field(t, rule, "metadata", "name").(string)
	value, err := json.Marshal(map[string]any{
		"apiVersion": rule["apiVersion"],
		"kind":       rule["kind"],
		"metadata": map[string]any{
			"name":        name,
			"namespace":   "default",
			"annotations": field(t, rule, "metadata", "annotations"),
		},
		"spec": rule["spec"],
	})
	require.NoError(t, err)
	rsp, err := helper.GetEnv().ResourceClient.Create(ctx, &resourcepb.CreateRequest{
		Key:   &resourcepb.ResourceKey{Namespace: "default", Group: v1beta1.GroupVersion.Group, Resource: resource, Name: name},
		Value: value,
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
}

func field(t *testing.T, obj map[string]any, path ...string) any {
	t.Helper()
	var cur any = obj
	for _, p := range path {
		m, ok := cur.(map[string]any)
		require.True(t, ok, "%v is not an object at %q", path, p)
		cur = m[p]
	}
	return cur
}

func toMap(t *testing.T, v any) map[string]any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var out map[string]any
	require.NoError(t, json.Unmarshal(raw, &out))
	return out
}

// Named explicitly: unified storage needs a name or generateName, and legacy
// storage rejects generateName.
func objectMeta(name string) metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:        name,
		Namespace:   "default",
		Annotations: map[string]string{v1beta1.FolderAnnotationKey: "test-folder"},
	}
}

// alertRuleBody is a valid AlertRule routed to the "empty" receiver, with an
// explicit notification settings type.
func alertRuleBody(t *testing.T) map[string]any {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	return toMap(t, &v1beta1.AlertRule{
		ObjectMeta: objectMeta(rule.UID),
		Spec: v1beta1.AlertRuleSpec{
			Title: rule.Title,
			Expressions: v1beta1.AlertRuleExpressionMap{"A": {
				QueryType:         new("query"),
				DatasourceUID:     new(v1beta1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID)),
				Model:             rule.Data[0].Model,
				Source:            new(true),
				RelativeTimeRange: &v1beta1.AlertRuleRelativeTimeRange{From: "5m", To: "0s"},
			}},
			Trigger:      v1beta1.AlertRuleIntervalTrigger{Interval: v1beta1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
			NoDataState:  v1beta1.AlertRuleNoDataState(common.ToK8sNoDataState(rule.NoDataState)),
			ExecErrState: v1beta1.AlertRuleExecErrState(common.ToK8sExecErrState(rule.ExecErrState)),
			NotificationSettings: &v1beta1.AlertRuleNotificationSettings{SimplifiedRouting: &v1beta1.AlertRuleSimplifiedRouting{
				Type:     v1beta1.AlertRuleNotificationSettingsTypeSimplifiedRouting,
				Receiver: "empty",
			}},
		},
	})
}

func withoutNotificationSettingsType(t *testing.T, obj map[string]any) map[string]any {
	t.Helper()
	delete(field(t, obj, "spec", "notificationSettings").(map[string]any), "type")
	return obj
}

func recordingRuleBody(t *testing.T) map[string]any {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	return toMap(t, &v1beta1.RecordingRule{
		ObjectMeta: objectMeta(rule.UID),
		Spec: v1beta1.RecordingRuleSpec{
			Title: rule.Title,
			Expressions: v1beta1.RecordingRuleExpressionMap{"A": {
				QueryType:         new("query"),
				DatasourceUID:     new(v1beta1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
				Model:             rule.Data[0].Model,
				Source:            new(true),
				RelativeTimeRange: &v1beta1.RecordingRuleRelativeTimeRange{From: "5m", To: "0s"},
			}},
			Trigger:             v1beta1.RecordingRuleIntervalTrigger{Interval: v1beta1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
			Metric:              "v1beta1_recorded_metric",
			TargetDatasourceUID: v1beta1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID),
		},
	})
}

func runV1beta1Tests(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	ctx := context.Background()
	alpha := versionClient{rc: helper.Org1.Admin.RESTClient(t, &v0alpha1.GroupVersion), gv: v0alpha1.GroupVersion}
	beta := versionClient{rc: helper.Org1.Admin.RESTClient(t, &v1beta1.GroupVersion), gv: v1beta1.GroupVersion}
	const alertRules, recordingRules = "alertrules", "recordingrules"

	t.Run("a rule written as v1beta1 is read as either version", func(t *testing.T) {
		created, err := beta.create(ctx, alertRules, alertRuleBody(t))
		require.NoError(t, err)
		name := field(t, created, "metadata", "name").(string)
		t.Cleanup(func() { _ = beta.delete(ctx, alertRules, name) })

		require.Equal(t, v1beta1.GroupVersion.String(), created["apiVersion"])
		// The mutator ran on the v1beta1 request.
		require.Equal(t, "test-folder", field(t, created, "metadata", "labels", v1beta1.FolderLabelKey))

		for _, c := range []versionClient{alpha, beta} {
			got, err := c.get(ctx, alertRules, name)
			require.NoError(t, err, c.gv.Version)
			require.Equal(t, c.gv.String(), got["apiVersion"], c.gv.Version)
			require.Equal(t, field(t, created, "spec", "title"), field(t, got, "spec", "title"), c.gv.Version)
			require.Equal(t, "SimplifiedRouting", field(t, got, "spec", "notificationSettings", "type"), c.gv.Version)
		}
	})

	t.Run("v0alpha1 still defaults the notification settings type", func(t *testing.T) {
		created, err := alpha.create(ctx, alertRules, withoutNotificationSettingsType(t, alertRuleBody(t)))
		require.NoError(t, err)
		name := field(t, created, "metadata", "name").(string)
		t.Cleanup(func() { _ = alpha.delete(ctx, alertRules, name) })

		got, err := beta.get(ctx, alertRules, name)
		require.NoError(t, err)
		require.Equal(t, "SimplifiedRouting", field(t, got, "spec", "notificationSettings", "type"))
		require.Equal(t, "empty", field(t, got, "spec", "notificationSettings", "receiver"))
	})

	t.Run("v1beta1 requires the notification settings type", func(t *testing.T) {
		_, err := beta.create(ctx, alertRules, withoutNotificationSettingsType(t, alertRuleBody(t)))
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err) || apierrors.IsBadRequest(err), "expected a client error, got %v", err)
	})

	t.Run("a rule written as v0alpha1 is updated and deleted as v1beta1", func(t *testing.T) {
		created, err := alpha.create(ctx, alertRules, alertRuleBody(t))
		require.NoError(t, err)
		name := field(t, created, "metadata", "name").(string)

		got, err := beta.get(ctx, alertRules, name)
		require.NoError(t, err)
		got["spec"].(map[string]any)["title"] = "updated as v1beta1"
		updated, err := beta.update(ctx, alertRules, got)
		require.NoError(t, err)
		require.Equal(t, "updated as v1beta1", field(t, updated, "spec", "title"))

		back, err := alpha.get(ctx, alertRules, name)
		require.NoError(t, err)
		require.Equal(t, "updated as v1beta1", field(t, back, "spec", "title"))

		require.NoError(t, beta.delete(ctx, alertRules, name))
		_, err = alpha.get(ctx, alertRules, name)
		require.True(t, apierrors.IsNotFound(err), "expected not found, got %v", err)
	})

	// Modes 1-3 keep status in legacy storage and mirror it to unified storage. Modes 4-5
	// write status to unified storage directly.
	t.Run("status written as either version is stored and mirrored", func(t *testing.T) {
		for _, tc := range []struct {
			resource string
			body     func(*testing.T) map[string]any
			status   map[string]any
		}{
			{alertRules, alertRuleBody, map[string]any{"state": "Firing", "health": "OK"}},
			{recordingRules, recordingRuleBody, map[string]any{"health": "Error", "lastError": "boom"}},
		} {
			for _, c := range []versionClient{alpha, beta} {
				t.Run(tc.resource+"/"+c.gv.Version, func(t *testing.T) {
					created, err := beta.create(ctx, tc.resource, tc.body(t))
					require.NoError(t, err)
					name := field(t, created, "metadata", "name").(string)
					t.Cleanup(func() { _ = beta.delete(ctx, tc.resource, name) })

					if mode >= grafanarest.Mode1 {
						// Wait for the unified copy, which is what gets mirrored to (or served from in modes 4-5).
						readUnified(t, helper, tc.resource, name)
					}

					obj, err := c.get(ctx, tc.resource, name)
					require.NoError(t, err)
					obj["status"] = tc.status
					_, err = c.updateStatus(ctx, tc.resource, obj)
					require.NoError(t, err)

					got, err := c.get(ctx, tc.resource, name)
					require.NoError(t, err)
					require.Equal(t, tc.status, got["status"])

					if mode >= grafanarest.Mode1 {
						require.Equal(t, tc.status, readUnified(t, helper, tc.resource, name)["status"])
					}
				})
			}
		}
	})

	// Mode 0 serves from legacy only, so status must not be mirrored even if a unified
	// copy exists. The copy is seeded directly because in mode 0 the dual writer never
	// creates one.
	t.Run("status is not mirrored to unified in mode 0", func(t *testing.T) {
		if mode != grafanarest.Mode0 {
			t.Skip("only mode 0 skips the mirror")
		}
		for _, tc := range []struct {
			resource string
			body     func(*testing.T) map[string]any
			status   map[string]any
		}{
			{alertRules, alertRuleBody, map[string]any{"state": "Firing", "health": "OK"}},
			{recordingRules, recordingRuleBody, map[string]any{"health": "Error", "lastError": "boom"}},
		} {
			t.Run(tc.resource, func(t *testing.T) {
				created, err := beta.create(ctx, tc.resource, tc.body(t))
				require.NoError(t, err)
				name := field(t, created, "metadata", "name").(string)
				t.Cleanup(func() { _ = beta.delete(ctx, tc.resource, name) })

				seedUnified(t, helper, tc.resource, created)

				obj, err := beta.get(ctx, tc.resource, name)
				require.NoError(t, err)
				obj["status"] = tc.status
				_, err = beta.updateStatus(ctx, tc.resource, obj)
				require.NoError(t, err)

				got, err := beta.get(ctx, tc.resource, name)
				require.NoError(t, err)
				require.Equal(t, tc.status, got["status"], "legacy stays the source of truth")

				require.Empty(t, readUnified(t, helper, tc.resource, name)["status"])
			})
		}
	})

	t.Run("lists are served in either version", func(t *testing.T) {
		created, err := beta.create(ctx, recordingRules, recordingRuleBody(t))
		require.NoError(t, err)
		name := field(t, created, "metadata", "name").(string)
		t.Cleanup(func() { _ = beta.delete(ctx, recordingRules, name) })

		for _, c := range []versionClient{alpha, beta} {
			list, err := c.list(ctx, recordingRules)
			require.NoError(t, err, c.gv.Version)
			require.Equal(t, c.gv.String(), list["apiVersion"], c.gv.Version)
			items, ok := list["items"].([]any)
			require.True(t, ok, c.gv.Version)
			var found bool
			for _, item := range items {
				obj := item.(map[string]any)
				if field(t, obj, "metadata", "name") == name {
					found = true
					require.Equal(t, "v1beta1_recorded_metric", field(t, obj, "spec", "metric"), c.gv.Version)
				}
			}
			require.True(t, found, "%s list is missing %s", c.gv.Version, name)
		}
	})
}
