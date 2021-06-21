package dsl

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

type permissionTestCase struct {
	desc        string
	permission  Eval
	expected    bool
	permissions map[string]map[string]struct{}
}

func TestPermission(t *testing.T) {
	tests := []permissionTestCase{
		{
			desc:       "should evaluate to true",
			expected:   true,
			permission: Permission("reports:read", "reports:1"),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:       "should evaluate to true for empty scope",
			expected:   true,
			permission: Permission("reports:read", ScopeNone),
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			ok, err := test.permission.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}

type permissionInjectTestCase struct {
	desc        string
	eval        Eval
	expected    bool
	params      map[string]string
	permissions map[string]map[string]struct{}
}

func TestPermission_Inject(t *testing.T) {
	tests := []permissionInjectTestCase{
		{
			desc:     "should inject correct param",
			expected: true,
			eval:     Permission("reports:read", Combine("reports", Parameter(":reportId"))),
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
			desc:     "should should fail for nil params",
			expected: false,
			eval:     Permission("reports:read", Combine("reports", Parameter(":reportId"))),
			params:   nil,
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:1": struct{}{},
				},
			},
		},
		{
			desc:     "all should be injected with correct params",
			expected: true,
			eval: All(
				Permission("reports:read", Combine("reports", Parameter(":reportId"))),
				Permission("settings:read", Combine("settings", Parameter(":settingsId"))),
			),
			params: map[string]string{
				":settingsId": "setting",
				":reportId":   "report",
			},
			permissions: map[string]map[string]struct{}{
				"reports:read": {
					"reports:report": struct{}{},
				},
				"settings:read": {
					"settings:setting": struct{}{},
				},
			},
		},
		{
			desc:     "should inject several parameters to one permission",
			expected: true,
			eval:     Permission("reports:read", Combine("reports", Parameter(":reportId"), Parameter(":reportId2"))),
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
			assert.NoError(t, test.eval.Inject(test.params))
			ok, err := test.eval.Evaluate(test.permissions)
			assert.NoError(t, err)
			assert.Equal(t, test.expected, ok)
		})
	}
}
