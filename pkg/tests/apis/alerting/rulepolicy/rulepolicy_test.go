package rulepolicy

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"

	rulepolicyv0alpha1 "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/rulepolicy/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	namespace = "default"
	folderUID = "rulepolicy-folder"
	// The reconciler and the policy watches are asynchronous, so enforcement starts shortly after a
	// RulePolicy is written.
	eventually = 30 * time.Second
	tick       = 250 * time.Millisecond
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// warnings collects the warnings returned by the API server.
type warnings struct {
	mu       sync.Mutex
	messages []string
}

func (w *warnings) HandleWarningHeader(_ int, _ string, text string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.messages = append(w.messages, text)
}

func (w *warnings) take() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	out := w.messages
	w.messages = nil
	return out
}

func TestIntegrationRulePolicy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		APIServerRuntimeConfig: "policy.grafana.app/v0alpha1=true,rulepolicy.alerting.grafana.app/v0alpha1=true",
	})
	common.CreateTestFolder(t, helper, folderUID)

	adminWarnings := &warnings{}
	adminCfg := helper.Org1.Admin.NewRestConfig()
	adminCfg.WarningHandler = adminWarnings
	admin, err := dynamic.NewForConfig(adminCfg)
	require.NoError(t, err)
	editor, err := dynamic.NewForConfig(helper.Org1.Editor.NewRestConfig())
	require.NoError(t, err)

	rulePolicies := admin.Resource(rulepolicyv0alpha1.RulePolicyKind().GroupVersionResource()).Namespace(namespace)
	rules := admin.Resource(v0alpha1.AlertRuleKind().GroupVersionResource()).Namespace(namespace)
	bindings := admin.Resource(policyv0alpha1.ValidationPolicyBindingKind().GroupVersionResource()).Namespace(namespace)

	createRule := func(labels, annotations map[string]string) error {
		_, err := rules.Create(ctx, alertRule(t, labels, annotations), metav1.CreateOptions{})
		return err
	}

	t.Run("only org admins can write rule policies", func(t *testing.T) {
		rp := toUnstructured(t, newRulePolicy("from-editor", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{}))
		_, err := editor.Resource(rulepolicyv0alpha1.RulePolicyKind().GroupVersionResource()).Namespace(namespace).Create(ctx, rp, metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
	})

	t.Run("users cannot write validation policies directly", func(t *testing.T) {
		vp := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": policyv0alpha1.GroupVersion.String(),
			"kind":       policyv0alpha1.ValidationPolicyKind().Kind(),
			"metadata":   map[string]any{"name": "handmade", "namespace": namespace},
			"spec": map[string]any{
				"match":       []any{map[string]any{"group": "rules.alerting.grafana.app", "versions": []any{"v0alpha1"}, "kinds": []any{"AlertRule"}}},
				"validations": []any{map[string]any{"expression": "false"}},
			},
		}}
		_, err := admin.Resource(policyv0alpha1.ValidationPolicyKind().GroupVersionResource()).Namespace(namespace).Create(ctx, vp, metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
	})

	t.Run("rule policies with invalid keys are rejected", func(t *testing.T) {
		rp := newRulePolicy("conflicting", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{
			RequiredLabels: []string{"team"}, ForbiddenLabels: []string{"team"},
		})
		_, err := rulePolicies.Create(ctx, toUnstructured(t, rp), metav1.CreateOptions{})
		// The app SDK reports every validator rejection as Forbidden, with the field errors in the message.
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.Contains(t, err.Error(), `spec.forbiddenLabels[0]: Invalid value: "team": a key cannot be both required and forbidden`)
	})

	t.Run("a deny rule policy rejects non-compliant rules", func(t *testing.T) {
		rp := newRulePolicy("team", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{
			RequiredLabels:  []string{"team"},
			ForbiddenLabels: []string{"tmp"},
		})
		_, err := rulePolicies.Create(ctx, toUnstructured(t, rp), metav1.CreateOptions{})
		require.NoError(t, err)

		// The reconciler writes a binding that uses the RulePolicy as its parameter object.
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			b, err := bindings.Get(ctx, "rulepolicy-team", metav1.GetOptions{})
			require.NoError(c, err)
			actions, _, _ := unstructured.NestedStringSlice(b.Object, "spec", "actions")
			assert.Equal(c, []string{"Deny"}, actions)
			ref, _, _ := unstructured.NestedString(b.Object, "spec", "paramRef", "name")
			assert.Equal(c, "team", ref)
		}, eventually, tick)

		require.EventuallyWithT(t, func(c *assert.CollectT) {
			err := createRule(nil, nil)
			require.Error(c, err)
			assert.True(c, apierrors.IsInvalid(err), "got %v", err)
			assert.Contains(c, err.Error(), "labels missing or empty: team")
		}, eventually, tick)

		err = createRule(map[string]string{"team": "a", "tmp": "x"}, nil)
		require.True(t, apierrors.IsInvalid(err), "got %v", err)
		require.Contains(t, err.Error(), "forbidden labels present: tmp")

		require.NoError(t, createRule(map[string]string{"team": "a"}, nil))
	})

	t.Run("editing a rule policy changes enforcement without new policies", func(t *testing.T) {
		require.NoError(t, updateRulePolicy(ctx, rulePolicies, "team", func(spec *rulepolicyv0alpha1.RulePolicySpec) {
			spec.RequiredLabels = []string{"team", "severity"}
		}))
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			err := createRule(map[string]string{"team": "a"}, nil)
			require.Error(c, err)
			assert.Contains(c, err.Error(), "labels missing or empty: severity")
		}, eventually, tick)
	})

	t.Run("a warn rule policy admits with a warning", func(t *testing.T) {
		rp := newRulePolicy("hygiene", rulepolicyv0alpha1.RulePolicyEnforcementWarn, rulepolicyv0alpha1.RulePolicySpec{
			RequiredAnnotations: []string{"summary"},
		})
		_, err := rulePolicies.Create(ctx, toUnstructured(t, rp), metav1.CreateOptions{})
		require.NoError(t, err)

		compliant := map[string]string{"team": "a", "severity": "high"}
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			adminWarnings.take()
			require.NoError(c, createRule(compliant, nil))
			assert.Contains(c, fmt.Sprint(adminWarnings.take()), "annotations missing or empty: summary")
		}, eventually, tick)

		adminWarnings.take()
		require.NoError(t, createRule(compliant, map[string]string{"summary": "s"}))
		require.Empty(t, adminWarnings.take())
	})

	t.Run("deleting a rule policy stops its enforcement", func(t *testing.T) {
		require.NoError(t, rulePolicies.Delete(ctx, "team", metav1.DeleteOptions{}))
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			_, err := bindings.Get(ctx, "rulepolicy-team", metav1.GetOptions{})
			assert.True(c, apierrors.IsNotFound(err), "got %v", err)
		}, eventually, tick)
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			assert.NoError(c, createRule(nil, map[string]string{"summary": "s"}))
		}, eventually, tick)
	})
}

func newRulePolicy(name string, enforcement rulepolicyv0alpha1.RulePolicyEnforcement, spec rulepolicyv0alpha1.RulePolicySpec) *rulepolicyv0alpha1.RulePolicy {
	spec.Enforcement = enforcement
	return &rulepolicyv0alpha1.RulePolicy{
		TypeMeta:   metav1.TypeMeta{APIVersion: rulepolicyv0alpha1.GroupVersion.String(), Kind: rulepolicyv0alpha1.RulePolicyKind().Kind()},
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       spec,
	}
}

func updateRulePolicy(ctx context.Context, c dynamic.ResourceInterface, name string, mutate func(*rulepolicyv0alpha1.RulePolicySpec)) error {
	u, err := c.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	rp := &rulepolicyv0alpha1.RulePolicy{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, rp); err != nil {
		return err
	}
	mutate(&rp.Spec)
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(rp)
	if err != nil {
		return err
	}
	_, err = c.Update(ctx, &unstructured.Unstructured{Object: obj}, metav1.UpdateOptions{})
	return err
}

func toUnstructured(t *testing.T, obj any) *unstructured.Unstructured {
	t.Helper()
	u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(t, err)
	return &unstructured.Unstructured{Object: u}
}

func alertRule(t *testing.T, labels, annotations map[string]string) *unstructured.Unstructured {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID(folderUID),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()

	spec := v0alpha1.AlertRuleSpec{
		Title: rule.Title,
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
	}
	if labels != nil {
		spec.Labels = map[string]v0alpha1.AlertRuleTemplateString{}
		for k, v := range labels {
			spec.Labels[k] = v0alpha1.AlertRuleTemplateString(v)
		}
	}
	if annotations != nil {
		spec.Annotations = map[string]v0alpha1.AlertRuleTemplateString{}
		for k, v := range annotations {
			spec.Annotations[k] = v0alpha1.AlertRuleTemplateString(v)
		}
	}
	return toUnstructured(t, &v0alpha1.AlertRule{
		TypeMeta: metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.String(), Kind: v0alpha1.AlertRuleKind().Kind()},
		ObjectMeta: metav1.ObjectMeta{
			// Legacy storage does not support generateName.
			Name:        rule.UID,
			Namespace:   namespace,
			Annotations: map[string]string{"grafana.app/folder": folderUID},
		},
		Spec: spec,
	})
}
