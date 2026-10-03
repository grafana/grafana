package app

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	policyapp "github.com/grafana/grafana/apps/policy/pkg/app"
	"github.com/grafana/grafana/pkg/policy/api"
	"github.com/grafana/grafana/pkg/policy/engine"
	"github.com/grafana/grafana/pkg/policy/schema/manifest"

	rulepolicymanifest "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/manifestdata"
	rulepolicyv0alpha1 "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/rulepolicy/v0alpha1"
)

const namespace = "stack-1"

var alertRuleGVK = schema.GroupVersionKind{Group: rulesGroup, Version: rulesVersion, Kind: "AlertRule"}

// rulePolicies is a ParamSource serving RulePolicies by name, as the API would.
type rulePolicies map[string]*rulepolicyv0alpha1.RulePolicy

func (p rulePolicies) GetParams(_ context.Context, _ schema.GroupVersionKind, _, name string) (map[string]any, error) {
	rp, ok := p[name]
	if !ok {
		return nil, engine.ErrParamsNotFound
	}
	return runtime.DefaultUnstructuredConverter.ToUnstructured(rp)
}

func rulePolicy(name string, enforcement rulepolicyv0alpha1.RulePolicyEnforcement, spec rulepolicyv0alpha1.RulePolicySpec) *rulepolicyv0alpha1.RulePolicy {
	spec.Enforcement = enforcement
	return &rulepolicyv0alpha1.RulePolicy{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace}, Spec: spec}
}

// managedSet compiles the policy and binding the reconciler writes for each RulePolicy, against
// the real RulePolicy and AlertRule schemas.
func managedSet(t *testing.T, policies rulePolicies) *engine.Set {
	t.Helper()
	resolver, err := manifest.NewResolver(*rulepolicymanifest.LocalManifest().ManifestData, *rulesmanifest.LocalManifest().ManifestData)
	require.NoError(t, err)
	compiler := engine.NewCompiler(resolver)

	var compiled []*engine.CompiledPolicy
	var bindings []api.Binding
	for _, rp := range policies {
		meta := metav1.ObjectMeta{Name: managedName(rp.Name), Namespace: namespace}
		cp, err := compiler.Compile(policyapp.ToPolicy(&policyv0alpha1.ValidationPolicy{ObjectMeta: meta, Spec: policySpec()}))
		require.NoError(t, err)
		compiled = append(compiled, cp)
		bindings = append(bindings, policyapp.ToBinding(&policyv0alpha1.ValidationPolicyBinding{ObjectMeta: meta, Spec: bindingSpec(rp)}))
	}
	set, err := engine.NewSet(compiled, bindings, policies)
	require.NoError(t, err)
	return set
}

func ruleWith(labels, annotations map[string]any) map[string]any {
	spec := map[string]any{"title": "rule", "trigger": map[string]any{"interval": "1m"}}
	if labels != nil {
		spec["labels"] = labels
	}
	if annotations != nil {
		spec["annotations"] = annotations
	}
	return map[string]any{"metadata": map[string]any{"name": "r1", "namespace": namespace}, "spec": spec}
}

// decisions returns the messages of every decision, keyed by "<binding>/<action>".
func decisions(t *testing.T, set *engine.Set, obj map[string]any) map[string][]string {
	t.Helper()
	ev := set.EvaluateAll(context.Background(), engine.Input{
		GVK: alertRuleGVK, Namespace: namespace, Object: obj,
		Request: &engine.RequestInfo{Operation: api.OperationCreate},
	})
	for _, r := range ev.Results {
		require.Empty(t, r.Errors)
	}
	out := map[string][]string{}
	for _, d := range ev.Decisions {
		key := d.Binding + "/" + string(d.Action)
		out[key] = append(out[key], d.Message)
	}
	return out
}

func TestManagedPolicies(t *testing.T) {
	set := managedSet(t, rulePolicies{
		"team": rulePolicy("team", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{
			RequiredLabels:       []string{"team", " severity "},
			RequiredAnnotations:  []string{"runbook_url"},
			ForbiddenAnnotations: []string{"legacy_id"},
		}),
		"hygiene": rulePolicy("hygiene", rulepolicyv0alpha1.RulePolicyEnforcementWarn, rulepolicyv0alpha1.RulePolicySpec{
			RequiredAnnotations: []string{"summary"},
			ForbiddenLabels:     []string{"tmp"},
		}),
	})

	t.Run("each rule policy applies with its own enforcement", func(t *testing.T) {
		got := decisions(t, set, ruleWith(
			map[string]any{"team": "a", "severity": "  ", "tmp": ""},
			map[string]any{"legacy_id": "42"},
		))
		require.Len(t, got, 2)
		require.ElementsMatch(t, []string{
			"labels missing or empty: severity",
			"annotations missing or empty: runbook_url",
			"forbidden annotations present: legacy_id",
		}, got["rulepolicy-team/Deny"])
		require.ElementsMatch(t, []string{
			"annotations missing or empty: summary",
			"forbidden labels present: tmp",
		}, got["rulepolicy-hygiene/Warn"])
	})

	t.Run("a compliant rule passes every rule policy", func(t *testing.T) {
		got := decisions(t, set, ruleWith(
			map[string]any{"team": "a", "severity": "high"},
			map[string]any{"runbook_url": "u", "summary": "s"},
		))
		require.Empty(t, got)
	})

	t.Run("a rule policy without keys checks nothing", func(t *testing.T) {
		empty := managedSet(t, rulePolicies{"empty": rulePolicy("empty", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{})})
		require.Empty(t, decisions(t, empty, ruleWith(nil, nil)))
	})

	t.Run("a deleted rule policy no longer applies", func(t *testing.T) {
		rp := rulePolicy("gone", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{RequiredLabels: []string{"team"}})
		policies := rulePolicies{"gone": rp}
		set := managedSet(t, policies)
		require.NotEmpty(t, decisions(t, set, ruleWith(nil, nil)))
		// Until the reconciler removes the binding, it refers to a parameter object that no longer exists.
		delete(policies, "gone")
		require.Empty(t, decisions(t, set, ruleWith(nil, nil)))
	})
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name string
		rp   *rulepolicyv0alpha1.RulePolicy
		want []string
	}{
		{
			name: "valid",
			rp: rulePolicy("team", rulepolicyv0alpha1.RulePolicyEnforcementWarn, rulepolicyv0alpha1.RulePolicySpec{
				RequiredLabels: []string{"team"}, ForbiddenLabels: []string{"tmp"},
			}),
		},
		{
			name: "enforcement is required",
			rp:   rulePolicy("team", "", rulepolicyv0alpha1.RulePolicySpec{}),
			want: []string{"spec.enforcement"},
		},
		{
			name: "keys must be non-blank and unique",
			rp: rulePolicy("team", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{
				RequiredLabels: []string{"team", " team", " "},
			}),
			want: []string{"spec.requiredLabels[1]", "spec.requiredLabels[2]"},
		},
		{
			name: "a key cannot be both required and forbidden",
			rp: rulePolicy("team", rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{
				RequiredAnnotations: []string{"summary"}, ForbiddenAnnotations: []string{"summary "},
			}),
			want: []string{"spec.forbiddenAnnotations[0]"},
		},
		{
			name: "the name must leave room for the managed names",
			rp:   rulePolicy(strings.Repeat("a", 250), rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicySpec{}),
			want: []string{"metadata.name"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validate(tt.rp)
			if len(tt.want) == 0 {
				require.NoError(t, err)
				return
			}
			var status apierrors.APIStatus
			require.ErrorAs(t, err, &status)
			var fields []string
			for _, c := range status.Status().Details.Causes {
				fields = append(fields, c.Field)
			}
			require.ElementsMatch(t, tt.want, fields)
		})
	}
}
