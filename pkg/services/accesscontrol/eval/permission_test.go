package eval

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
			desc:      "should evaluate to true for empty scope",
			expected:  true,
			evaluator: Permission("reports:read", ScopeNone),
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
			desc:      "should should fail for nil params",
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
