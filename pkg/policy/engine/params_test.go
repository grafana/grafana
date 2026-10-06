package engine

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/policy/api"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
)

var requirementsGVK = schema.GroupVersionKind{Group: "requirements.example.grafana.app", Version: "v1", Kind: "Requirements"}

const requirementsSchema = `{
  "type": "object",
  "properties": {
    "spec": {
      "type": "object",
      "properties": {
        "requiredLabels": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["key"],
            "properties": {
              "key":     {"type": "string"},
              "enforce": {"type": "boolean"}
            }
          }
        }
      }
    }
  }
}`

func paramCompiler(t *testing.T) *Compiler {
	t.Helper()
	return NewCompiler(policyschema.StaticResolver{
		alertRuleGVK:     mustSchema(t, alertRuleSchema),
		recordingRuleGVK: mustSchema(t, recordingRuleSchema),
		requirementsGVK:  mustSchema(t, requirementsSchema),
	})
}

// requiredLabelsPolicy checks the labels the parameter object marks as enforced, the way the
// rule requirements demo does.
func requiredLabelsPolicy() api.Policy {
	return api.Policy{
		Name: "required-labels",
		Match: []api.ResourceMatch{{
			Group: testGroup, Versions: []string{"v1"}, Kinds: []string{"AlertRule"},
		}},
		ParamKind: &api.ParamKind{Group: requirementsGVK.Group, Version: requirementsGVK.Version, Kind: requirementsGVK.Kind},
		Variables: []api.NamedExpression{
			{Name: "required", Expression: "params.spec.requiredLabels.filter(r, has(r.enforce) && r.enforce && r.key.trim() != '').map(r, r.key.trim())"},
			{Name: "missing", Expression: "variables.required.filter(k, !has(object.spec.labels) || !(k in object.spec.labels) || object.spec.labels[k].trim() == '')"},
		},
		Validations: []api.Validation{{
			Expression:        "size(variables.missing) == 0",
			MessageExpression: "'required labels missing or empty: ' + variables.missing.join(', ')",
			FieldPath:         "spec.labels",
		}},
	}
}

func requirements(labels ...map[string]any) map[string]any {
	items := make([]any, 0, len(labels))
	for _, l := range labels {
		items = append(items, l)
	}
	return map[string]any{"spec": map[string]any{"requiredLabels": items}}
}

type fakeParams map[string]map[string]any

func (f fakeParams) GetParams(_ context.Context, gvk schema.GroupVersionKind, namespace, name string) (map[string]any, error) {
	if gvk != requirementsGVK {
		return nil, errors.New("unexpected param kind " + gvk.String())
	}
	if name == "broken" {
		return nil, errors.New("storage unavailable")
	}
	p, ok := f[namespace+"/"+name]
	if !ok {
		return nil, ErrParamsNotFound
	}
	return p, nil
}

func TestParamsCompile(t *testing.T) {
	t.Run("params are typed from the param kind", func(t *testing.T) {
		cp, err := paramCompiler(t).Compile(requiredLabelsPolicy())
		require.NoError(t, err)
		gvk, ok := cp.ParamGVK()
		require.True(t, ok)
		require.Equal(t, requirementsGVK, gvk)

		p := requiredLabelsPolicy()
		p.Variables[0].Expression = "params.spec.requiredLabelz"
		_, err = paramCompiler(t).Compile(p)
		require.ErrorContains(t, err, "undefined field 'requiredLabelz'")
	})

	t.Run("params are undefined without a param kind", func(t *testing.T) {
		p := requiredLabelsPolicy()
		p.ParamKind = nil
		_, err := paramCompiler(t).Compile(p)
		require.ErrorContains(t, err, "undeclared reference to 'params'")
	})

	t.Run("param kind schema must resolve", func(t *testing.T) {
		p := requiredLabelsPolicy()
		p.ParamKind.Kind = "Missing"
		_, err := paramCompiler(t).Compile(p)
		require.ErrorContains(t, err, "paramKind")
		require.ErrorContains(t, err, "schema not found")
	})
}

func TestParamsSet(t *testing.T) {
	ctx := context.Background()
	cp, err := paramCompiler(t).Compile(requiredLabelsPolicy())
	require.NoError(t, err)
	deny := api.Binding{Name: "deny", PolicyName: "required-labels", Actions: []api.Action{api.ActionDeny}, ParamRef: &api.ParamRef{Name: "default"}}

	t.Run("bindings must reference params and a source must exist", func(t *testing.T) {
		noRef := deny
		noRef.ParamRef = nil
		_, err := NewSet([]*CompiledPolicy{cp}, []api.Binding{noRef}, fakeParams{})
		require.ErrorContains(t, err, "must set paramRef")

		_, err = NewSet([]*CompiledPolicy{cp}, []api.Binding{deny}, nil)
		require.ErrorContains(t, err, "no param source")
	})

	params := fakeParams{
		"stack-1/default": requirements(
			map[string]any{"key": "team", "enforce": true},
			map[string]any{"key": " severity ", "enforce": true},
			map[string]any{"key": "owner", "enforce": false},
			map[string]any{"key": " ", "enforce": true},
		),
		"stack-1/strict": requirements(map[string]any{"key": "runbook", "enforce": true}),
	}
	warn := api.Binding{Name: "warn", PolicyName: "required-labels", Actions: []api.Action{api.ActionWarn}, ParamRef: &api.ParamRef{Name: "strict"}}
	s, err := NewSet([]*CompiledPolicy{cp}, []api.Binding{deny, warn}, params)
	require.NoError(t, err)

	in := Input{GVK: alertRuleGVK, Namespace: "stack-1", Object: rule(map[string]any{
		"labels": map[string]any{"team": "a", "severity": "  "},
	})}

	t.Run("each binding is evaluated with its own params", func(t *testing.T) {
		got := s.EvaluateAll(ctx, in)
		require.Len(t, got.Results, 2)
		messages := map[string]string{}
		for _, d := range got.Decisions {
			messages[d.Binding+"/"+string(d.Action)] = d.Message
		}
		require.Equal(t, map[string]string{
			"deny/Deny": "required labels missing or empty: severity",
			"warn/Warn": "required labels missing or empty: runbook",
		}, messages)
	})

	t.Run("missing params mean the binding does not apply", func(t *testing.T) {
		other := in
		other.Namespace = "stack-2"
		require.Empty(t, s.EvaluateAll(ctx, other).Results)
	})

	t.Run("failing to read params follows the failure policy", func(t *testing.T) {
		broken := deny
		broken.Name, broken.ParamRef = "broken", &api.ParamRef{Name: "broken"}

		s, err := NewSet([]*CompiledPolicy{cp}, []api.Binding{broken}, params)
		require.NoError(t, err)
		got := s.EvaluateAll(ctx, in)
		require.Len(t, got.Decisions, 1)
		require.ErrorContains(t, got.Decisions[0].Err, "storage unavailable")

		p := requiredLabelsPolicy()
		p.FailurePolicy = api.FailurePolicyIgnore
		ignoring, err := paramCompiler(t).Compile(p)
		require.NoError(t, err)
		s, err = NewSet([]*CompiledPolicy{ignoring}, []api.Binding{broken}, params)
		require.NoError(t, err)
		got = s.EvaluateAll(ctx, in)
		require.Empty(t, got.Decisions)
		require.Len(t, got.Results, 1, "the ignored error is still reported")
		require.Equal(t, "broken", got.Results[0].Binding)
		require.False(t, got.Results[0].Applicable)
		require.Len(t, got.Results[0].Ignored, 1)
		require.Equal(t, "paramRef", got.Results[0].Ignored[0].Path)
	})
}
