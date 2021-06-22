package eval

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAny_Evaluate(t *testing.T) {
	tests := []evaluateTestCase{
		{
			desc: "should return true for for one that matches",
			evaluator: Any(
				Permission("settings:write", Combine("settings", ScopeWildcard)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return true for when at least one matches",
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
			desc: "should return false when there is no matches",
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
			desc:     "should should fail for nil params",
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
			assert.NoError(t, test.evaluator.Inject(test.params))
			ok, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

func TestAny_Failed(t *testing.T) {
	tests := []failedTestCase{
		{
			desc:   "should all as failed permissions",
			failed: 3,
			evaluator: Any(
				Permission("reports:read", "reports:2"),
				Permission("reports:read", "reports:3"),
				Permission("reports:read", "reports:4"),
			),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:   "should not be any failed",
			failed: 0,
			evaluator: All(
				Permission("reports:read", "reports:2"),
				Permission("reports:read", "reports:3"),
				Permission("reports:read", "reports:4"),
			),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:2": struct{}{},
					"reports:3": struct{}{},
					"reports:4": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			_, err := test.evaluator.Evaluate(test.permissions)
			assert.NoError(t, err)
			if test.failed != 0 {
				assert.Len(t, test.evaluator.Failed(), test.failed)
			}
		})
	}
}
