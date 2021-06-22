package eval

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
