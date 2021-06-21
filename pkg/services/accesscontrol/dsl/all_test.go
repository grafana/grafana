package dsl

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type allTestCase struct {
	desc        string
	all         Eval
	expected    bool
	permissions map[string]map[string]struct{}
}

func TestAll(t *testing.T) {
	tests := []allTestCase{
		{
			desc: "should return true for one that matches",
			all: All(
				Permission("settings:write", Combine("settings", ScopeWildcard)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return true for several that matches",
			all: All(
				Permission("settings:write", Combine("settings", ScopeWildcard)),
				Permission("settings:read", Combine("settings", "auth.saml", ScopeAll)),
			),
			permissions: map[string]map[string]struct{}{
				"settings:write": {"settings:**": struct{}{}},
				"settings:read":  {"settings:**": struct{}{}},
			},
			expected: true,
		},
		{
			desc: "should return false for if one does not match",
			all: All(
				Permission("settings:write", Combine("settings", ScopeWildcard)),
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
			ok, err := test.all.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}
