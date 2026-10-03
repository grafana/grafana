package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/policy/api"
	policyschema "github.com/grafana/grafana/pkg/policy/schema"
)

const testGroup = "rules.example.grafana.app"

var (
	alertRuleGVK     = schema.GroupVersionKind{Group: testGroup, Version: "v1", Kind: "AlertRule"}
	recordingRuleGVK = schema.GroupVersionKind{Group: testGroup, Version: "v1", Kind: "RecordingRule"}
)

// Both kinds share title, interval, labels, items and an untyped model. Only AlertRule has `for`.
const alertRuleSchema = `{
  "type": "object",
  "properties": {
    "spec": {
      "type": "object",
      "properties": {
        "title":    {"type": "string"},
        "interval": {"type": "string"},
        "for":      {"type": "string"},
        "labels":   {"type": "object", "additionalProperties": {"type": "string"}},
        "items":    {"type": "array", "items": {"type": "string"}},
        "model":    {"type": "object", "x-kubernetes-preserve-unknown-fields": true}
      }
    }
  }
}`

const recordingRuleSchema = `{
  "type": "object",
  "properties": {
    "spec": {
      "type": "object",
      "properties": {
        "title":    {"type": "string"},
        "interval": {"type": "string"},
        "labels":   {"type": "object", "additionalProperties": {"type": "string"}},
        "items":    {"type": "array", "items": {"type": "string"}},
        "model":    {"type": "object", "x-kubernetes-preserve-unknown-fields": true}
      }
    }
  }
}`

func mustSchema(t *testing.T, raw string) *spec.Schema {
	t.Helper()
	s := &spec.Schema{}
	require.NoError(t, json.Unmarshal([]byte(raw), s))
	return s
}

func testCompiler(t *testing.T) *Compiler {
	t.Helper()
	return NewCompiler(policyschema.StaticResolver{
		alertRuleGVK:     mustSchema(t, alertRuleSchema),
		recordingRuleGVK: mustSchema(t, recordingRuleSchema),
	})
}

func rulePolicy(validations ...api.Validation) api.Policy {
	return api.Policy{
		Name: "test",
		Match: []api.ResourceMatch{{
			Group:    testGroup,
			Versions: []string{"v1"},
			Kinds:    []string{"AlertRule", "RecordingRule"},
		}},
		Validations: validations,
	}
}

func mustCompile(t *testing.T, p api.Policy) *CompiledPolicy {
	t.Helper()
	cp, err := testCompiler(t).Compile(p)
	require.NoError(t, err)
	return cp
}

func rule(spec map[string]any) map[string]any {
	return map[string]any{
		"apiVersion": testGroup + "/v1",
		"kind":       "AlertRule",
		"metadata":   map[string]any{"name": "r1", "namespace": "default", "labels": map[string]any{"team": "a"}},
		"spec":       spec,
	}
}

func compileErr(t *testing.T, p api.Policy) *CompileError {
	t.Helper()
	_, err := testCompiler(t).Compile(p)
	require.Error(t, err)
	var cerr *CompileError
	require.ErrorAs(t, err, &cerr)
	return cerr
}

func TestCompile(t *testing.T) {
	t.Run("compiles once per matched kind", func(t *testing.T) {
		cp := mustCompile(t, rulePolicy(api.Validation{Expression: "object.spec.title != ''"}))
		require.Equal(t, []schema.GroupVersionKind{alertRuleGVK, recordingRuleGVK}, cp.GVKs())
	})

	t.Run("field missing from one matched kind fails for that kind only", func(t *testing.T) {
		cerr := compileErr(t, rulePolicy(api.Validation{Expression: "object.spec.for != ''"}))
		require.Len(t, cerr.Errors, 1)
		require.Equal(t, recordingRuleGVK, cerr.Errors[0].GVK)
		require.Equal(t, "validations[0].expression", cerr.Errors[0].Path)
		require.Contains(t, cerr.Errors[0].Err.Error(), "undefined field 'for'")
	})

	t.Run("type errors are caught at compile time", func(t *testing.T) {
		cerr := compileErr(t, rulePolicy(api.Validation{Expression: "object.spec.title > 5"}))
		require.Len(t, cerr.Errors, 2)
		require.Contains(t, cerr.Error(), "no matching overload")
	})

	t.Run("validations must return bool and messages string", func(t *testing.T) {
		cerr := compileErr(t, rulePolicy(api.Validation{Expression: "object.spec.title", MessageExpression: "1"}))
		require.Contains(t, cerr.Error(), "must evaluate to bool")
		cerr = compileErr(t, rulePolicy(api.Validation{Expression: "true", MessageExpression: "1"}))
		require.Contains(t, cerr.Error(), "validations[0].messageExpression")
		require.Contains(t, cerr.Error(), "must evaluate to string")
	})

	t.Run("metadata is typed beyond name", func(t *testing.T) {
		mustCompile(t, rulePolicy(api.Validation{
			Expression: "object.metadata.namespace != '' && object.metadata.labels['team'] != '' && object.metadata.annotations.all(k, k != '')",
		}))
	})

	t.Run("fields not declared in the schema are not accessible", func(t *testing.T) {
		// Matches Kubernetes: objects that preserve unknown fields expose only declared fields.
		cerr := compileErr(t, rulePolicy(api.Validation{Expression: "object.spec.model.anything == 1"}))
		require.Contains(t, cerr.Error(), "undefined field 'anything'")
	})

	t.Run("variables are typed and must be declared before use", func(t *testing.T) {
		p := rulePolicy(api.Validation{Expression: "variables.titleLen > 0"})
		p.Variables = []api.NamedExpression{{Name: "titleLen", Expression: "size(object.spec.title)"}}
		mustCompile(t, p)

		p.Variables = []api.NamedExpression{
			{Name: "a", Expression: "variables.b"},
			{Name: "b", Expression: "1"},
		}
		require.Contains(t, compileErr(t, p).Error(), "variables[0].expression")

		p.Variables = []api.NamedExpression{{Name: "titleLen", Expression: "object.spec.title"}}
		require.Contains(t, compileErr(t, p).Error(), "no matching overload")
	})

	t.Run("oldObject can be compared with null", func(t *testing.T) {
		mustCompile(t, rulePolicy(api.Validation{Expression: "oldObject == null || oldObject.spec.title == object.spec.title"}))
	})

	t.Run("missing schema is a compile error", func(t *testing.T) {
		p := rulePolicy(api.Validation{Expression: "true"})
		p.Match[0].Kinds = []string{"Unknown"}
		require.Contains(t, compileErr(t, p).Error(), "schema not found")
	})

	t.Run("structural errors are reported before compiling", func(t *testing.T) {
		cerr := compileErr(t, api.Policy{Name: "x"})
		require.Equal(t, []string{"match", "validations"}, []string{cerr.Errors[0].Path, cerr.Errors[1].Path})
	})
}

func TestEvaluate(t *testing.T) {
	ctx := context.Background()

	t.Run("collects every violation with its details", func(t *testing.T) {
		cp := mustCompile(t, rulePolicy(
			api.Validation{Name: "title", Expression: "object.spec.title != ''", Message: "title is required", FieldPath: "spec.title"},
			api.Validation{Expression: "object.spec.interval == '1m'", MessageExpression: "'interval ' + object.spec.interval + ' is not allowed'", Reason: api.ReasonForbidden},
			api.Validation{Expression: "size(object.spec.items) > 0"},
			api.Validation{Expression: "object.metadata.labels['team'] == 'a'"},
		))
		res := cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(map[string]any{"title": "", "interval": "5m", "items": []any{}})})
		require.True(t, res.Applicable)
		require.Empty(t, res.Errors)
		require.Equal(t, []Violation{
			{Policy: "test", Validation: "title", Message: "title is required", Reason: api.ReasonInvalid, FieldPath: "spec.title"},
			{Policy: "test", Validation: "validations[1]", Message: "interval 5m is not allowed", Reason: api.ReasonForbidden},
			{Policy: "test", Validation: "validations[2]", Message: "failed expression: size(object.spec.items) > 0", Reason: api.ReasonInvalid},
		}, res.Violations)
	})

	t.Run("message falls back when messageExpression is empty", func(t *testing.T) {
		cp := mustCompile(t, rulePolicy(api.Validation{Expression: "false", Message: "static", MessageExpression: "''"}))
		res := cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(map[string]any{})})
		require.Equal(t, "static", res.Violations[0].Message)
	})

	t.Run("variables", func(t *testing.T) {
		p := rulePolicy(api.Validation{Expression: "variables.doubled == 4"})
		p.Variables = []api.NamedExpression{
			{Name: "count", Expression: "size(object.spec.items)"},
			{Name: "doubled", Expression: "variables.count * 2"},
		}
		cp := mustCompile(t, p)
		res := cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(map[string]any{"items": []any{"a", "b"}})})
		require.True(t, res.Applicable)
		require.Empty(t, res.Violations)
		require.Empty(t, res.Errors)
	})

	t.Run("kind and operation must match", func(t *testing.T) {
		cp := mustCompile(t, rulePolicy(api.Validation{Expression: "false"}))
		other := schema.GroupVersionKind{Group: testGroup, Version: "v2", Kind: "AlertRule"}
		require.False(t, cp.Evaluate(ctx, Input{GVK: other, Object: rule(nil)}).Applicable)

		del := &RequestInfo{Operation: api.OperationDelete}
		require.False(t, cp.Evaluate(ctx, Input{GVK: alertRuleGVK, OldObject: rule(nil), Request: del}).Applicable)

		create := &RequestInfo{Operation: api.OperationCreate}
		require.True(t, cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(nil), Request: create}).Applicable)
		// Without request context, operations are not known and not checked.
		require.True(t, cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(nil)}).Applicable)
	})

	t.Run("match conditions", func(t *testing.T) {
		p := rulePolicy(api.Validation{Expression: "false"})
		p.MatchConditions = []api.NamedExpression{{Name: "team-a", Expression: "object.metadata.labels['team'] == 'a'"}}
		cp := mustCompile(t, p)
		require.True(t, cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(nil)}).Applicable)

		other := rule(nil)
		other["metadata"] = map[string]any{"labels": map[string]any{"team": "b"}}
		require.False(t, cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: other}).Applicable)
	})

	t.Run("failure policy", func(t *testing.T) {
		// Indexing a missing map key is a runtime error.
		p := rulePolicy(api.Validation{Expression: "object.spec.labels['missing'] == 'x'"})
		p.MatchConditions = []api.NamedExpression{{Name: "has-severity", Expression: "object.spec.labels['severity'] == 'high'"}}
		in := Input{GVK: alertRuleGVK, Object: rule(map[string]any{"labels": map[string]any{}})}

		res := mustCompile(t, p).Evaluate(ctx, in)
		require.True(t, res.Applicable, "Fail must not let an unevaluable match condition exempt the resource")
		require.Len(t, res.Errors, 1)
		require.Equal(t, "matchConditions[0].expression", res.Errors[0].Path)

		p.FailurePolicy = api.FailurePolicyIgnore
		res = mustCompile(t, p).Evaluate(ctx, in)
		require.False(t, res.Applicable)
		require.Empty(t, res.Errors)

		p.MatchConditions = nil
		res = mustCompile(t, p).Evaluate(ctx, in)
		require.True(t, res.Applicable)
		require.Empty(t, res.Errors)
		require.Empty(t, res.Violations)
	})

	t.Run("rules needing request context are skipped without it", func(t *testing.T) {
		p := rulePolicy(
			api.Validation{Name: "unchanged", Expression: "oldObject == null || oldObject.spec.title == object.spec.title"},
			api.Validation{Name: "admin", Expression: "variables.isAdmin"},
			api.Validation{Name: "plain", Expression: "object.spec.title != ''"},
		)
		p.Variables = []api.NamedExpression{{Name: "isAdmin", Expression: "'admins' in request.userInfo.groups"}}
		cp := mustCompile(t, p)

		res := cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(map[string]any{"title": "x"})})
		require.Equal(t, []Skip{
			{Policy: "test", Path: "validations[0].expression", Reason: skipReasonNoRequest},
			{Policy: "test", Path: "validations[1].expression", Reason: skipReasonNoRequest},
		}, res.Skipped)
		require.Empty(t, res.Violations)

		res = cp.Evaluate(ctx, Input{
			GVK:       alertRuleGVK,
			Object:    rule(map[string]any{"title": "new"}),
			OldObject: rule(map[string]any{"title": "old"}),
			Request:   &RequestInfo{Operation: api.OperationUpdate, UserInfo: UserInfo{Groups: []string{"admins"}}},
		})
		require.Empty(t, res.Skipped)
		require.Len(t, res.Violations, 1)
		require.Equal(t, "unchanged", res.Violations[0].Validation)

		res = cp.Evaluate(ctx, Input{
			GVK:     alertRuleGVK,
			Object:  rule(map[string]any{"title": "new"}),
			Request: &RequestInfo{Operation: api.OperationCreate},
		})
		require.Len(t, res.Violations, 1)
		require.Equal(t, "admin", res.Violations[0].Validation)
	})

	t.Run("per-expression cost limit", func(t *testing.T) {
		items := make([]any, 2000)
		for i := range items {
			items[i] = strings.Repeat("x", i%10)
		}
		cp := mustCompile(t, rulePolicy(api.Validation{Expression: "object.spec.items.all(a, object.spec.items.all(b, size(a) + size(b) >= 0))"}))
		res := cp.Evaluate(ctx, Input{GVK: alertRuleGVK, Object: rule(map[string]any{"items": items})})
		require.Len(t, res.Errors, 1)
		require.Contains(t, res.Errors[0].Error(), "cost limit exceeded")
	})

	t.Run("cancelled context stops evaluation", func(t *testing.T) {
		cctx, cancel := context.WithCancel(ctx)
		cancel()
		cp := mustCompile(t, rulePolicy(api.Validation{Expression: "true"}, api.Validation{Expression: "true"}))
		res := cp.Evaluate(cctx, Input{GVK: alertRuleGVK, Object: rule(nil)})
		require.Len(t, res.Errors, 1)
		require.ErrorIs(t, res.Errors[0], context.Canceled)
	})
}

func TestSet(t *testing.T) {
	ctx := context.Background()
	titled := mustCompile(t, rulePolicy(api.Validation{Expression: "object.spec.title != ''", Message: "title is required"}))
	broken := rulePolicy(api.Validation{Expression: "object.spec.labels['missing'] == 'x'"})
	broken.Name = "broken"
	brokenPolicy := mustCompile(t, broken)

	t.Run("rejects invalid bindings", func(t *testing.T) {
		_, err := NewSet([]*CompiledPolicy{titled}, []api.Binding{
			{Name: "a", PolicyName: "nope", Actions: []api.Action{api.ActionDeny}},
			{Name: "b", PolicyName: "test", Actions: []api.Action{api.ActionDeny, api.ActionWarn}},
		}, nil)
		require.ErrorContains(t, err, `references unknown policy "nope"`)
		require.ErrorContains(t, err, "Deny and Warn cannot be combined")

		_, err = NewSet([]*CompiledPolicy{titled, titled}, nil, nil)
		require.ErrorContains(t, err, `duplicate policy "test"`)
	})

	t.Run("applies bindings by namespace", func(t *testing.T) {
		s, err := NewSet([]*CompiledPolicy{titled, brokenPolicy}, []api.Binding{
			{Name: "deny-prod", PolicyName: "test", Actions: []api.Action{api.ActionDeny}, Namespaces: []string{"prod"}},
			{Name: "warn-all", PolicyName: "test", Actions: []api.Action{api.ActionWarn}},
			{Name: "deny-broken", PolicyName: "broken", Actions: []api.Action{api.ActionDeny}},
		}, nil)
		require.NoError(t, err)
		require.True(t, s.Matches(recordingRuleGVK))
		require.False(t, s.Matches(schema.GroupVersionKind{Group: "other", Version: "v1", Kind: "Thing"}))

		in := Input{GVK: alertRuleGVK, Namespace: "dev", Object: rule(map[string]any{"title": "", "labels": map[string]any{}})}
		got := s.EvaluateAll(ctx, in)
		require.Len(t, got.Results, 2)
		type decision struct {
			binding string
			action  api.Action
			isErr   bool
		}
		var decisions []decision
		for _, d := range got.Decisions {
			decisions = append(decisions, decision{d.Binding, d.Action, d.Err != nil})
		}
		require.ElementsMatch(t, []decision{
			{"warn-all", api.ActionWarn, false},
			{"deny-broken", api.ActionDeny, true},
		}, decisions)

		in.Namespace = "prod"
		got = s.EvaluateAll(ctx, in)
		require.Len(t, got.Decisions, 3)
	})
}
