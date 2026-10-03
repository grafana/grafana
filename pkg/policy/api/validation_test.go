package api

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func validPolicy() Policy {
	return Policy{
		Name: "min-interval",
		Match: []ResourceMatch{{
			Group:    "rules.alerting.grafana.app",
			Versions: []string{"v0alpha1"},
			Kinds:    []string{"AlertRule", "RecordingRule"},
		}},
		Variables:   []NamedExpression{{Name: "interval", Expression: "object.spec.trigger.interval"}},
		Validations: []Validation{{Expression: "variables.interval != ''"}},
	}
}

func fieldPaths(errs field.ErrorList) []string {
	paths := make([]string, 0, len(errs))
	for _, e := range errs {
		paths = append(paths, e.Field)
	}
	return paths
}

func TestPolicyValidate(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(p *Policy)
		want   []string
	}{
		{name: "valid", mutate: func(p *Policy) {}},
		{
			name:   "missing name, match and validations",
			mutate: func(p *Policy) { p.Name, p.Match, p.Validations = "", nil, nil },
			want:   []string{"name", "match", "validations"},
		},
		{
			name: "incomplete match",
			mutate: func(p *Policy) {
				p.Match = []ResourceMatch{{Kinds: []string{"AlertRule", "AlertRule"}, Operations: []Operation{"PATCH"}}}
			},
			want: []string{"match[0].group", "match[0].versions", "match[0].kinds[1]", "match[0].operations[0]"},
		},
		{
			name: "variable names must be CEL identifiers and unique",
			mutate: func(p *Policy) {
				p.Variables = []NamedExpression{
					{Name: "has-dash", Expression: "1"},
					{Name: "x", Expression: "1"},
					{Name: "x", Expression: ""},
				}
			},
			want: []string{"variables[0].name", "variables[2].name", "variables[2].expression"},
		},
		{
			name:   "match condition names may contain dashes",
			mutate: func(p *Policy) { p.MatchConditions = []NamedExpression{{Name: "only-v1", Expression: "true"}} },
		},
		{
			name: "validation fields",
			mutate: func(p *Policy) {
				p.Validations = []Validation{
					{Name: "a", Expression: "true", Reason: "Teapot"},
					{Name: "a"},
				}
			},
			want: []string{"validations[0].reason", "validations[1].expression", "validations[1].name"},
		},
		{
			name:   "unknown failure policy",
			mutate: func(p *Policy) { p.FailurePolicy = "Sometimes" },
			want:   []string{"failurePolicy"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := validPolicy()
			tt.mutate(&p)
			require.ElementsMatch(t, tt.want, fieldPaths(p.Validate()))
		})
	}
}

func TestBindingValidate(t *testing.T) {
	tests := []struct {
		name    string
		binding Binding
		want    []string
	}{
		{name: "valid deny", binding: Binding{Name: "b", PolicyName: "p", Actions: []Action{ActionDeny}}},
		{name: "valid warn", binding: Binding{Name: "b", PolicyName: "p", Actions: []Action{ActionWarn}}},
		{name: "missing everything", want: []string{"name", "policyName", "actions"}},
		{
			name:    "deny and warn cannot be combined",
			binding: Binding{Name: "b", PolicyName: "p", Actions: []Action{ActionDeny, ActionWarn}},
			want:    []string{"actions"},
		},
		{
			name:    "unsupported and duplicate actions",
			binding: Binding{Name: "b", PolicyName: "p", Actions: []Action{"Audit", ActionWarn, ActionWarn}},
			want:    []string{"actions[0]", "actions[2]"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.ElementsMatch(t, tt.want, fieldPaths(tt.binding.Validate()))
		})
	}
}

func TestDefaults(t *testing.T) {
	require.Equal(t, FailurePolicyFail, Policy{}.EffectiveFailurePolicy())
	require.Equal(t, DefaultOperations, ResourceMatch{}.EffectiveOperations())
	require.Equal(t, ReasonInvalid, Validation{}.EffectiveReason())
}
