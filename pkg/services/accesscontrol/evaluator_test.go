package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

type evaluateTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	permissions map[string][]string
}

var permissionEvaluateTestCases = []evaluateTestCase{
	{
		desc:      "should deny without permissions",
		evaluator: EvalPermission("reports:read"),
	},
	{
		desc:      "should allow action-only checks when the action has no scopes",
		evaluator: EvalPermission("reports:read"),
		permissions: map[string][]string{
			"reports:read": {},
		},
		expected: true,
	},
	{
		desc:      "should deny an explicit empty scope when the granted scope is empty",
		evaluator: EvalPermission("reports:read", ""),
		permissions: map[string][]string{
			"reports:read": {""},
		},
	},
	{
		desc:      "should evaluate to true",
		expected:  true,
		evaluator: EvalPermission("reports:read", "reports:1"),
		permissions: map[string][]string{
			"reports:read": {"reports:1"},
		},
	},
	{
		desc:      "should evaluate to true when at least one scope matches",
		expected:  true,
		evaluator: EvalPermission("reports:read", "reports:1", "reports:2"),
		permissions: map[string][]string{
			"reports:read": {"reports:2"},
		},
	},
	{
		desc:      "should evaluate to true for empty scope",
		expected:  true,
		evaluator: EvalPermission("reports:read"),
		permissions: map[string][]string{
			"reports:read": {"reports:1"},
		},
	},
	{
		desc:      "should evaluate to false when no scopes matches",
		expected:  false,
		evaluator: EvalPermission("reports:read", "reports:1", "reports:2"),
		permissions: map[string][]string{
			"reports:read": {"reports:9", "reports:10"},
		},
	},
}

func TestPermission_Evaluate(t *testing.T) {
	for _, test := range permissionEvaluateTestCases {
		t.Run(test.desc, func(t *testing.T) {
			ok := test.evaluator.Evaluate(test.permissions)
			assert.Equal(t, test.expected, ok)
		})
	}
}

type injectTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	params      scopeParams
	permissions map[string][]string
}

func TestPermission_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:      "should inject field",
			expected:  true,
			evaluator: EvalPermission("orgs:read", Scope("orgs", Field("OrgID"))),
			params: scopeParams{
				OrgID: 3,
			},
			permissions: map[string][]string{
				"orgs:read": {"orgs:3"},
			},
		},
		{
			desc:      "should inject correct param",
			expected:  true,
			evaluator: EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
			params: scopeParams{
				URLParams: map[string]string{
					":id":       "10",
					":reportId": "1",
				},
			},
			permissions: map[string][]string{
				"reports:read": {"reports:1"},
			},
		},
		{
			desc:      "should fail for nil params",
			expected:  false,
			evaluator: EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
			params:    scopeParams{},
			permissions: map[string][]string{
				"reports:read": {"reports:1"},
			},
		},
		{
			desc:      "should inject several parameters to one permission",
			expected:  true,
			evaluator: EvalPermission("reports:read", Scope("reports", Parameter(":reportId"), Parameter(":reportId2"))),
			params: scopeParams{
				URLParams: map[string]string{
					":reportId":  "report",
					":reportId2": "report2",
				},
			},
			permissions: map[string][]string{
				"reports:read": {"reports:report:report2"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.MutateScopes(context.TODO(), scopeInjector(test.params))
			assert.NoError(t, err)
			ok := injected.Evaluate(test.permissions)
			assert.Equal(t, test.expected, ok)
		})
	}
}

var allEvaluateTestCases = []evaluateTestCase{
	{
		desc:      "should allow empty all without permissions at evaluator level",
		evaluator: EvalAll(),
		expected:  true,
	},
	{
		desc:      "should allow empty all with unrelated permissions",
		evaluator: EvalAll(),
		permissions: map[string][]string{
			"folders:read": {"folders:uid:folder-1"},
		},
		expected: true,
	},
	{
		desc:      "should deny nonempty all without permissions",
		evaluator: EvalAll(EvalPermission("reports:read")),
	},
	{
		desc: "should return true for one that matches",
		evaluator: EvalAll(
			EvalPermission("settings:write", Scope("settings", "*")),
		),
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
		},
		expected: true,
	},
	{
		desc: "should return true for several that matches",
		evaluator: EvalAll(
			EvalPermission("settings:write", Scope("settings", "*")),
			EvalPermission("settings:read", Scope("settings", "auth.saml", "*")),
		),
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
			"settings:read":  {"settings:*"},
		},
		expected: true,
	},
	{
		desc: "should return false if one does not match",
		evaluator: EvalAll(
			EvalPermission("settings:write", Scope("settings", "*")),
			EvalPermission("settings:read", Scope("settings", "auth.saml", "*")),
			EvalPermission("report:read", Scope("reports", "*")),
		),
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
			"settings:read":  {"settings:*"},
			"report:read":    {"report:1"},
		},
		expected: false,
	},
}

func TestAll_Evaluate(t *testing.T) {
	for _, test := range allEvaluateTestCases {
		t.Run(test.desc, func(t *testing.T) {
			ok := test.evaluator.Evaluate(test.permissions)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAll_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:     "should inject correct param",
			expected: true,
			evaluator: EvalAll(
				EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
				EvalPermission("settings:read", Scope("settings", Parameter(":settingsId"))),
			),
			params: scopeParams{
				URLParams: map[string]string{
					":id":         "10",
					":settingsId": "3",
					":reportId":   "1",
				},
			},
			permissions: map[string][]string{
				"reports:read":  {"reports:1"},
				"settings:read": {"settings:3"},
			},
		},
		{
			desc:     "should inject field and URL param",
			expected: true,
			evaluator: EvalAll(
				EvalPermission("orgs:read", Scope("orgs", Field("OrgID"))),
				EvalPermission("orgs:read", Scope("orgs", Parameter(":orgId"))),
			),
			params: scopeParams{
				OrgID: 3,
				URLParams: map[string]string{
					":orgId": "4",
				},
			},
			permissions: map[string][]string{
				"orgs:read": {"orgs:3", "orgs:4"},
			},
		},
		{
			desc:     "should fail for nil params",
			expected: false,
			evaluator: EvalAll(
				EvalPermission("settings:read", Scope("reports", Parameter(":settingsId"))),
				EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
			),
			params: scopeParams{},
			permissions: map[string][]string{
				"reports:read":  {"reports:1"},
				"settings:read": {"settings:3"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.MutateScopes(context.TODO(), scopeInjector(test.params))
			assert.NoError(t, err)
			ok := injected.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

var anyEvaluateTestCases = []evaluateTestCase{
	{
		desc:      "should deny empty any without permissions",
		evaluator: EvalAny(),
	},
	{
		desc:      "should deny empty any with unrelated permissions",
		evaluator: EvalAny(),
		permissions: map[string][]string{
			"folders:read": {"folders:uid:folder-1"},
		},
	},
	{
		desc: "should return true for one that matches",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "*")),
		),
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
		},
		expected: true,
	},
	{
		desc: "should return true when at least one matches",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "auth.saml", "*")),
			EvalPermission("report:read", Scope("reports", "1")),
			EvalPermission("report:write", Scope("reports", "10")),
		),
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
		},
		expected: true,
	},
	{
		desc: "should return false when there is no match",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "auth.saml", "*")),
			EvalPermission("report:read", Scope("reports", "1")),
			EvalPermission("report:write", Scope("reports", "10")),
		),
		permissions: map[string][]string{
			"permissions:write": {"permissions:type:delegate"},
		},
		expected: false,
	},
}

func TestAny_Evaluate(t *testing.T) {
	for _, test := range anyEvaluateTestCases {
		t.Run(test.desc, func(t *testing.T) {
			ok := test.evaluator.Evaluate(test.permissions)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAny_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:     "should inject correct param",
			expected: true,
			evaluator: EvalAny(
				EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
				EvalPermission("settings:read", Scope("settings", Parameter(":settingsId"))),
			),
			params: scopeParams{
				URLParams: map[string]string{
					":id":         "10",
					":settingsId": "3",
					":reportId":   "1",
				},
			},
			permissions: map[string][]string{
				"reports:read":  {"reports:1"},
				"settings:read": {"settings:3"},
			},
		},
		{
			desc:     "should inject field and URL param",
			expected: true,
			evaluator: EvalAny(
				EvalPermission("orgs:read", Scope("orgs", Field("OrgID"))),
				EvalPermission("orgs:read", Scope("orgs", Parameter(":orgId"))),
			),
			params: scopeParams{
				OrgID: 3,
				URLParams: map[string]string{
					":orgId": "4",
				},
			},
			permissions: map[string][]string{
				"orgs:read": {"orgs:3", "orgs:4"},
			},
		},
		{
			desc:     "should fail for nil params",
			expected: false,
			evaluator: EvalAny(
				EvalPermission("settings:read", Scope("reports", Parameter(":settingsId"))),
				EvalPermission("reports:read", Scope("reports", Parameter(":reportId"))),
			),
			params: scopeParams{},
			permissions: map[string][]string{
				"reports:read":  {"reports:1"},
				"settings:read": {"settings:3"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.MutateScopes(context.TODO(), scopeInjector(test.params))
			assert.NoError(t, err)
			ok := injected.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

type combinedTestCase = evaluateTestCase

var combinedEvaluateTestCases = []combinedTestCase{
	{
		desc: "should allow nested empty all with unrelated permissions",
		evaluator: EvalAny(
			EvalPermission("reports:read", "reports:1"),
			EvalAll(),
		),
		permissions: map[string][]string{
			"folders:read": {"folders:uid:folder-1"},
		},
		expected: true,
	},
	{
		desc: "should deny nested empty any despite another matching child",
		evaluator: EvalAll(
			EvalPermission("reports:read", "reports:1"),
			EvalAny(),
		),
		permissions: map[string][]string{
			"reports:read": {"reports:1"},
		},
	},
	{
		desc: "should evaluate all containing any with alternative scopes",
		evaluator: EvalAll(
			EvalAny(
				EvalPermission("reports:write", "reports:1"),
				EvalPermission("reports:read", "reports:missing", "reports:1"),
			),
			EvalPermission("folders:read", "folders:uid:folder-1"),
		),
		permissions: map[string][]string{
			"reports:read": {"reports:1"},
			"folders:read": {"folders:uid:folder-1"},
		},
		expected: true,
	},
	{
		desc: "should return true when first is true",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "*")),
			EvalAll(
				EvalPermission("settings:write", "settings:auth.saml:enabled"),
				EvalPermission("settings:write", "settings:auth.saml:max_issue_delay"),
			),
		),
		expected: true,
		permissions: map[string][]string{
			"settings:write": {"settings:*"},
		},
	},
	{
		desc: "should return true when first is false and all is true",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "*")),
			EvalAll(
				EvalPermission("settings:write", "settings:auth.saml:enabled"),
				EvalPermission("settings:write", "settings:auth.saml:max_issue_delay"),
			),
		),
		expected: true,
		permissions: map[string][]string{
			"settings:write": {"settings:auth.saml:enabled", "settings:auth.saml:max_issue_delay"},
		},
	},
	{
		desc: "should return false when both are false",
		evaluator: EvalAny(
			EvalPermission("settings:write", Scope("settings", "*")),
			EvalAll(
				EvalPermission("settings:write", "settings:auth.saml:enabled"),
				EvalPermission("settings:write", "settings:auth.saml:max_issue_delay"),
			),
		),
		expected: false,
		permissions: map[string][]string{
			"settings:write": {"settings:auth.saml:enabled"},
		},
	},
}

func TestEval(t *testing.T) {
	for _, test := range combinedEvaluateTestCases {
		t.Run(test.desc, func(t *testing.T) {
			ok := test.evaluator.Evaluate(test.permissions)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestEval_MutateScopes(t *testing.T) {
	t.Run("should return error if none of the scopes was a resolved", func(t *testing.T) {
		eval := EvalAll(
			EvalPermission("action:1", "scope:uid:1"),
			EvalPermission("action:2", "scope:id:1"),
		)

		calls := 0
		_, err := eval.MutateScopes(context.Background(), func(ctx context.Context, s string) ([]string, error) {
			calls += 1
			return nil, ErrResolverNotFound
		})

		assert.Equal(t, 2, calls)
		assert.ErrorIs(t, err, ErrResolverNotFound)
	})

	t.Run("should return if at least one scope was resolved", func(t *testing.T) {
		eval := EvalAll(
			EvalPermission("action:1", "scope:uid:1"),
			EvalPermission("action:2", "scope:id:1"),
		)

		calls := 0
		resolved := 0
		eval, err := eval.MutateScopes(context.Background(), func(ctx context.Context, s string) ([]string, error) {
			calls += 1
			if s == "scope:id:1" {
				resolved += 1
				return []string{"scope:uid:2"}, nil
			}
			return nil, ErrResolverNotFound
		})

		assert.NoError(t, err)
		assert.Equal(t, 2, calls)
		assert.Equal(t, 1, resolved)

		hasAccess := eval.Evaluate(map[string][]string{
			"action:1": {"scope:uid:1"},
			"action:2": {"scope:uid:2"},
		})
		assert.True(t, hasAccess)
	})
}

func TestEval_ShortCircuit(t *testing.T) {
	for _, tc := range []struct {
		name        string
		compose     func(...Evaluator) Evaluator
		permissions map[string][]string
		wantCalls   []string
		allowed     bool
	}{
		{
			name:      "all stops at the first denial",
			compose:   EvalAll,
			wantCalls: []string{"first"},
		},
		{
			name:    "any stops at the first grant",
			compose: EvalAny,
			permissions: map[string][]string{
				"first": {},
			},
			wantCalls: []string{"first"},
			allowed:   true,
		},
		{
			name:    "all visits matching children in order",
			compose: EvalAll,
			permissions: map[string][]string{
				"first":  {},
				"second": {},
			},
			wantCalls: []string{"first", "second"},
			allowed:   true,
		},
		{
			name:      "any visits denied children in order",
			compose:   EvalAny,
			wantCalls: []string{"first", "second"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls []string
			evaluator := tc.compose(
				recordingEvaluator{Evaluator: EvalPermission("first"), calls: &calls},
				recordingEvaluator{Evaluator: EvalPermission("second"), calls: &calls},
			)

			assert.Equal(t, tc.allowed, evaluator.Evaluate(tc.permissions))
			assert.Equal(t, tc.wantCalls, calls)
		})
	}
}

type recordingEvaluator struct {
	Evaluator
	calls *[]string
}

func (e recordingEvaluator) Evaluate(permissions map[string][]string) bool {
	*e.calls = append(*e.calls, e.String())
	return e.Evaluator.Evaluate(permissions)
}
