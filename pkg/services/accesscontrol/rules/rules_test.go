package rules

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type evaluateTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	permissions map[string]map[string]struct{}
}

type injectTestCase struct {
	desc        string
	expected    bool
	evaluator   Evaluator
	params      map[string]string
	permissions map[string]map[string]struct{}
}

func TestPermission_Evaluate(t *testing.T) {
	tests := []evaluateTestCase{
		{
			desc:      "should evaluate to true",
			expected:  true,
			evaluator: Permission("reports:read", "reports:1"),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:      "should evaluate to true when all required scopes matches",
			expected:  true,
			evaluator: Permission("reports:read", "reports:1", "reports:2"),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
					"reports:2": struct{}{},
				},
			},
		},
		{
			desc:      "should evaluate to true for empty scope",
			expected:  true,
			evaluator: Permission("reports:read"),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:      "should evaluate to false when only one of required scopes exists",
			expected:  false,
			evaluator: Permission("reports:read", "reports:1", "reports:2"),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ok, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestPermission_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:      "should inject correct param",
			expected:  true,
			evaluator: Permission("reports:read", Combine("reports", Parameter(":reportId"))),
			params: map[string]string{
				":id":       "10",
				":reportId": "1",
			},
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:      "should fail for nil params",
			expected:  false,
			evaluator: Permission("reports:read", Combine("reports", Parameter(":reportId"))),
			params:    nil,
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:      "should inject several parameters to one permission",
			expected:  true,
			evaluator: Permission("reports:read", Combine("reports", Parameter(":reportId"), Parameter(":reportId2"))),
			params: map[string]string{
				":reportId":  "report",
				":reportId2": "report2",
			},
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:report:report2": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.Inject(test.params)
			assert.NoError(t, err)
			ok, err := injected.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAll_Evaluate(t *testing.T) {
	tests := []evaluateTestCase{
		{
			desc: "should return true for one that matches",
			evaluator: All(
				Permission("settings:write", Combine("settings", ScopeAll)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return true for several that matches",
			evaluator: All(
				Permission("settings:write", Combine("settings", ScopeAll)),
				Permission("settings:read", Combine("settings", "auth.saml", ScopeAll)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
				"settings:read":  {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return false if one does not match",
			evaluator: All(
				Permission("settings:write", Combine("settings", ScopeAll)),
				Permission("settings:read", Combine("settings", "auth.saml", ScopeAll)),
				Permission("report:read", Combine("reports", ScopeAll)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
				"settings:read":  {"settings:**": struct{}{}},
				"report:read":    {"report:1": struct{}{}},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ok, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAll_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:     "should inject correct param",
			expected: true,
			evaluator: All(
				Permission("reports:read", Combine("reports", Parameter(":reportId"))),
				Permission("settings:read", Combine("settings", Parameter(":settingsId"))),
			),
			params: map[string]string{
				":id":         "10",
				":settingsId": "3",
				":reportId":   "1",
			},
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
				"settings:read": {
					"settings:3": struct{}{},
				},
			},
		},
		{
			desc:     "should fail for nil params",
			expected: false,
			evaluator: All(
				Permission("settings:read", Combine("reports", Parameter(":settingsId"))),
				Permission("reports:read", Combine("reports", Parameter(":reportId"))),
			),
			params: nil,
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
				"settings:read": {
					"settings:3": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.Inject(test.params)
			assert.NoError(t, err)
			ok, err := injected.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAny_Evaluate(t *testing.T) {
	tests := []evaluateTestCase{
		{
			desc: "should return true for one that matches",
			evaluator: Any(
				Permission("settings:write", Combine("settings", ScopeAll)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return true when at least one matches",
			evaluator: Any(
				Permission("settings:write", Combine("settings", "auth.saml", ScopeAll)),
				Permission("report:read", Combine("reports", "1")),
				Permission("report:write", Combine("reports", "10")),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return false when there is no match",
			evaluator: Any(
				Permission("settings:write", Combine("settings", "auth.saml", ScopeAll)),
				Permission("report:read", Combine("reports", "1")),
				Permission("report:write", Combine("reports", "10")),
			),
			permissions: map[string]map[string]struct{}{
				"permissions:write": {"permissions:delegate": struct{}{}},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ok, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAny_Inject(t *testing.T) {
	tests := []injectTestCase{
		{
			desc:     "should inject correct param",
			expected: true,
			evaluator: Any(
				Permission("reports:read", Combine("reports", Parameter(":reportId"))),
				Permission("settings:read", Combine("settings", Parameter(":settingsId"))),
			),
			params: map[string]string{
				":id":         "10",
				":settingsId": "3",
				":reportId":   "1",
			},
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
				"settings:read": {
					"settings:3": struct{}{},
				},
			},
		},
		{
			desc:     "should fail for nil params",
			expected: false,
			evaluator: Any(
				Permission("settings:read", Combine("reports", Parameter(":settingsId"))),
				Permission("reports:read", Combine("reports", Parameter(":reportId"))),
			),
			params: nil,
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
				"settings:read": {
					"settings:3": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			injected, err := test.evaluator.Inject(test.params)
			assert.NoError(t, err)
			ok, err := injected.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

type combinedTestCase struct {
	desc        string
	evaluator   Evaluator
	expected    bool
	permissions map[string]map[string]struct{}
}

func TestEval(t *testing.T) {
	tests := []combinedTestCase{
		{
			desc: "should return true when first is true",
			evaluator: Any(
				Permission("settings:write", Combine("settings", ScopeAll)),
				All(
					Permission("settings:write", "settings:auth.saml:enabled"),
					Permission("settings:write", "settings:auth.saml:max_issue_delay"),
				),
			),
			expected: true,
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
		},
		{
			desc: "should return true when first is false and all is true",
			evaluator: Any(
				Permission("settings:write", Combine("settings", ScopeAll)),
				All(
					Permission("settings:write", "settings:auth.saml:enabled"),
					Permission("settings:write", "settings:auth.saml:max_issue_delay"),
				),
			),
			expected: true,
			permissions: map[string]map[string]struct{}{
				"settings:write": {
					"settings:auth.saml:enabled":         struct{}{},
					"settings:auth.saml:max_issue_delay": struct{}{},
				},
			},
		},
		{
			desc: "should return false when both are false",
			evaluator: Any(
				Permission("settings:write", Combine("settings", ScopeAll)),
				All(
					Permission("settings:write", "settings:auth.saml:enabled"),
					Permission("settings:write", "settings:auth.saml:max_issue_delay"),
				),
			),
			expected: false,
			permissions: map[string]map[string]struct{}{
				"settings:write": {
					"settings:auth.saml:enabled": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ok, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}
