package eval

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type anyTestCase struct {
	desc        string
	any         Evaluator
	expected    bool
	permissions map[string]map[string]struct{}
}

func TestAny(t *testing.T) {
	tests := []anyTestCase{
		{
			desc: "should return true for for one that matches",
			any: Any(
				Permission("settings:write", Combine("settings", ScopeWildcard)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return true for when at least one matches",
			any: Any(
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
			any: Any(
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
			ok, err := test.any.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}
