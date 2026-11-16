package accesscontrol

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestToLegacyExpression(t *testing.T) {
	tests := []struct {
		name      string
		evaluator Evaluator
		expected  string
	}{
		{
			name:      "action only",
			evaluator: EvalPermission("users:create"),
			expected:  `{"permission": {"action": "users:create"}}`,
		},
		{
			name:      "empty scope list is action only",
			evaluator: EvalPermission("users:create", []string{}...),
			expected:  `{"permission": {"action": "users:create"}}`,
		},
		{
			name:      "explicit empty scope is preserved",
			evaluator: EvalPermission("users:create", ""),
			expected:  `{"permission": {"action": "users:create", "scopes": [""]}}`,
		},
		{
			name: "multiple scopes retain order and wildcards",
			evaluator: EvalPermission(
				"dashboards:read",
				"dashboards:uid:dash-2",
				"dashboards:uid:dash-1",
				"dashboards:*",
			),
			expected: `{
				"permission": {
					"action": "dashboards:read",
					"scopes": ["dashboards:uid:dash-2", "dashboards:uid:dash-1", "dashboards:*"]
				}
			}`,
		},
		{
			name:      "empty all",
			evaluator: EvalAll(),
			expected:  `{"all": {}}`,
		},
		{
			name:      "empty any",
			evaluator: EvalAny(),
			expected:  `{"any": {}}`,
		},
		{
			name: "nesting order and separate checks for the same action",
			evaluator: EvalAll(
				EvalPermission("dashboards:read", "dashboards:uid:dash-1"),
				EvalAny(
					EvalPermission("dashboards:read", "dashboards:uid:dash-2"),
					EvalAll(
						EvalPermission("users:create"),
						EvalPermission("users:write", ""),
					),
					EvalAll(),
					EvalAny(),
				),
			),
			expected: `{
				"all": {
					"expressions": [
						{"permission": {"action": "dashboards:read", "scopes": ["dashboards:uid:dash-1"]}},
						{"any": {"expressions": [
							{"permission": {"action": "dashboards:read", "scopes": ["dashboards:uid:dash-2"]}},
							{"all": {"expressions": [
								{"permission": {"action": "users:create"}},
								{"permission": {"action": "users:write", "scopes": [""]}}
							]}},
							{"all": {}},
							{"any": {}}
						]}}
					]
				}
			}`,
		},
		{
			name: "pointer evaluators",
			evaluator: &allEvaluator{
				allOf: []Evaluator{
					&anyEvaluator{
						anyOf: []Evaluator{
							&permissionEvaluator{
								Action: "dashboards:read",
								Scopes: []string{"dashboards:uid:dash-1"},
							},
						},
					},
				},
			},
			expected: `{
				"all": {"expressions": [
					{"any": {"expressions": [
						{"permission": {"action": "dashboards:read", "scopes": ["dashboards:uid:dash-1"]}}
					]}}
				]}
			}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expression, err := ToLegacyExpression(tc.evaluator)

			require.NoError(t, err)
			require.NotNil(t, expression)

			encoded, err := proto.Marshal(expression)
			require.NoError(t, err)

			decoded := &authzextv1.LegacyExpression{}
			require.NoError(t, proto.Unmarshal(encoded, decoded))
			require.True(t, proto.Equal(expression, decoded))

			actual, err := protojson.Marshal(decoded)
			require.NoError(t, err)
			require.JSONEq(t, tc.expected, string(actual))
		})
	}
}

func TestToLegacyExpressionCopiesScopesAndChildren(t *testing.T) {
	scopes := []string{"dashboards:uid:dash-1"}
	permission := EvalPermission("dashboards:read", scopes...)
	children := []Evaluator{permission, permission}
	evaluator := EvalAll(children...)

	expression, err := ToLegacyExpression(evaluator)

	require.NoError(t, err)

	scopes[0] = "dashboards:uid:dash-2"
	children[0] = EvalPermission("users:create")

	first := expression.GetAll().GetExpressions()[0].GetPermission()
	second := expression.GetAll().GetExpressions()[1].GetPermission()
	require.Equal(t, "dashboards:read", first.GetAction())
	require.Equal(t, []string{"dashboards:uid:dash-1"}, first.GetScopes())
	require.Equal(t, []string{"dashboards:uid:dash-1"}, second.GetScopes())

	first.Scopes[0] = "dashboards:uid:dash-3"

	require.Equal(t, []string{"dashboards:uid:dash-1"}, second.GetScopes())
	require.Equal(t, []string{"dashboards:uid:dash-2"}, scopes)
}

func TestToLegacyExpressionRejectsInvalidEvaluators(t *testing.T) {
	tests := []struct {
		name      string
		evaluator Evaluator
		error     string
	}{
		{
			name:      "nil evaluator",
			evaluator: nil,
			error:     "legacy evaluator is required",
		},
		{
			name:      "nil permission pointer",
			evaluator: (*permissionEvaluator)(nil),
			error:     "legacy permission evaluator is required",
		},
		{
			name:      "nil all pointer",
			evaluator: (*allEvaluator)(nil),
			error:     "legacy all evaluator is required",
		},
		{
			name:      "nil any pointer",
			evaluator: (*anyEvaluator)(nil),
			error:     "legacy any evaluator is required",
		},
		{
			name:      "missing action",
			evaluator: EvalPermission("", "dashboards:*"),
			error:     "legacy permission action is required",
		},
		{
			name:      "unsupported custom evaluator",
			evaluator: unsupportedLegacyEvaluator{},
			error:     "unsupported legacy evaluator type",
		},
		{
			name:      "nil custom evaluator pointer",
			evaluator: (*unsupportedLegacyEvaluator)(nil),
			error:     "unsupported legacy evaluator type",
		},
		{
			name: "unsupported child of all",
			evaluator: EvalAll(
				EvalPermission("dashboards:read"),
				unsupportedLegacyEvaluator{},
			),
			error: "unsupported legacy evaluator type",
		},
		{
			name: "unsupported child of any",
			evaluator: EvalAny(
				EvalAll(),
				unsupportedLegacyEvaluator{},
			),
			error: "unsupported legacy evaluator type",
		},
		{
			name: "nil nested child",
			evaluator: EvalAll(
				EvalAny(nil),
			),
			error: "legacy evaluator is required",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expression, err := ToLegacyExpression(tc.evaluator)

			require.ErrorContains(t, err, tc.error)
			require.Nil(t, expression)
		})
	}
}

func TestToLegacyExpressionLimits(t *testing.T) {
	tests := []struct {
		name      string
		evaluator Evaluator
		error     string
	}{
		{
			name:      "maximum depth",
			evaluator: nestedLegacyEvaluator(maxLegacyExpressionDepth),
			error:     "",
		},
		{
			name:      "too deep",
			evaluator: nestedLegacyEvaluator(maxLegacyExpressionDepth + 1),
			error:     "exceeds maximum depth",
		},
		{
			name: "maximum nodes with shared leaves",
			evaluator: EvalAll(repeatedLegacyEvaluators(
				EvalPermission("dashboards:read"),
				maxLegacyExpressionNodes-1,
			)...),
			error: "",
		},
		{
			name: "too many nodes in a wide tree",
			evaluator: EvalAny(repeatedLegacyEvaluators(
				EvalPermission("dashboards:read"),
				maxLegacyExpressionNodes,
			)...),
			error: "exceeds maximum nodes",
		},
		{
			name: "too many nodes across shared subtrees",
			evaluator: EvalAll(repeatedLegacyEvaluators(
				EvalAny(EvalPermission("dashboards:read")),
				maxLegacyExpressionNodes/2,
			)...),
			error: "exceeds maximum nodes",
		},
		{
			name: "maximum scopes across shared leaves",
			evaluator: EvalAll(repeatedLegacyEvaluators(
				EvalPermission("dashboards:read", make([]string, maxLegacyExpressionScopes/2)...),
				2,
			)...),
			error: "",
		},
		{
			name: "too many scopes across shared leaves",
			evaluator: EvalAll(repeatedLegacyEvaluators(
				EvalPermission("dashboards:read", make([]string, maxLegacyExpressionScopes/2)...),
				3,
			)...),
			error: "exceeds maximum scopes",
		},
		{
			name:      "maximum distinct actions",
			evaluator: EvalAny(distinctLegacyPermissionEvaluators(maxLegacyExpressionActions)...),
			error:     "",
		},
		{
			name:      "too many distinct actions",
			evaluator: EvalAny(distinctLegacyPermissionEvaluators(maxLegacyExpressionActions + 1)...),
			error:     "exceeds maximum distinct actions",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expression, err := ToLegacyExpression(tc.evaluator)

			if tc.error != "" {
				require.ErrorContains(t, err, tc.error)
				require.Nil(t, expression)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, expression)
		})
	}
}

func TestToLegacyExpressionRejectsCycles(t *testing.T) {
	t.Run("cycle through a shared child slice", func(t *testing.T) {
		children := make([]Evaluator, 1)
		evaluator := EvalAll(children...)
		children[0] = evaluator

		expression, err := ToLegacyExpression(evaluator)

		require.ErrorContains(t, err, "exceeds maximum depth")
		require.Nil(t, expression)
	})

	t.Run("cycle through a pointer", func(t *testing.T) {
		evaluator := &anyEvaluator{}
		evaluator.anyOf = []Evaluator{evaluator}

		expression, err := ToLegacyExpression(evaluator)

		require.ErrorContains(t, err, "exceeds maximum depth")
		require.Nil(t, expression)
	})
}

// Any method call on this evaluator panics: serialization must inspect its type,
// without executing custom evaluation, scope mutation or formatting behavior.
type unsupportedLegacyEvaluator struct {
	Evaluator
}

func nestedLegacyEvaluator(depth int) Evaluator {
	evaluator := EvalPermission("dashboards:read")
	for i := 1; i < depth; i++ {
		evaluator = EvalAll(evaluator)
	}
	return evaluator
}

func repeatedLegacyEvaluators(evaluator Evaluator, count int) []Evaluator {
	children := make([]Evaluator, count)
	for i := range children {
		children[i] = evaluator
	}
	return children
}

func distinctLegacyPermissionEvaluators(count int) []Evaluator {
	children := make([]Evaluator, count)
	for i := range children {
		children[i] = EvalPermission(fmt.Sprintf("action:%d", i))
	}
	return children
}
