package expr

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewThresholdCommand(t *testing.T) {
	cmd, err := NewThresholdCommand("B", "A", "is_above", []float64{})
	require.Nil(t, err)
	require.NotNil(t, cmd)
}

func TestUnmarshalThresholdCommand(t *testing.T) {
	type testCase struct {
		description   string
		query         string
		shouldError   bool
		expectedError string
	}

	cases := []testCase{
		{
			description: "unmarshal proper object",
			query: `{
				"expression" : "A",
				"type": "threshold",
				"conditions": [{
					"evaluator": {
						"type": "gt",
						"params": [20, 80]
					}
				}]
			}`,
			shouldError: false,
		},
		{
			description: "unmarshal with missing conditions should error",
			query: `{
				"expression" : "A",
				"type": "threshold",
				"conditions": []
			}`,
			shouldError:   true,
			expectedError: "requires exactly one condition",
		},
		{
			description: "unmarshal with missing conditions should error",
			query: `{
				"expression" : "A",
				"type": "threshold",
				"conditions": []
			}`,
			shouldError:   true,
			expectedError: "requires exactly one condition",
		},
		{
			description: "unmarshal with unsupported threshold function",
			query: `{
				"expression" : "A",
				"type": "threshold",
				"conditions": [{
					"evaluator": {
						"type": "foo",
						"params": [20, 80]
					}
				}]
			}`,
			shouldError:   true,
			expectedError: "expected threshold function to be one of",
		},
		{
			description: "unmarshal with bad expression",
			query: `{
				"expression" : 0,
				"type": "threshold",
				"conditions": []
			}`,
			shouldError:   true,
			expectedError: "expected threshold variable to be a string",
		},
	}

	for _, tc := range cases {
		q := []byte(tc.query)

		var qmap = make(map[string]interface{})
		require.NoError(t, json.Unmarshal(q, &qmap))

		cmd, err := UnmarshalThresholdCommand(&rawNode{
			RefID:      "",
			Query:      qmap,
			QueryType:  "",
			DataSource: nil,
		})

		if tc.shouldError {
			require.Nil(t, cmd)
			require.NotNil(t, err)
			require.Contains(t, err.Error(), tc.expectedError)
		} else {
			require.Nil(t, err)
			require.NotNil(t, cmd)
		}
	}
}

func TestThresholdCommandVars(t *testing.T) {
	cmd, err := NewThresholdCommand("B", "A", "is_above", []float64{})
	require.Nil(t, err)
	require.Equal(t, cmd.NeedsVars(), []string{"A"})
}

func TestCreateMathExpression(t *testing.T) {
	type testCase struct {
		description string
		expected    string

		ref      string
		function string
		params   []float64
	}

	cases := []testCase{
		{
			description: "is above",
			ref:         "My Ref",
			function:    "gt",
			params:      []float64{0},
			expected:    "${My Ref} > 0.000000",
		},
		{
			description: "is below",
			ref:         "A",
			function:    "lt",
			params:      []float64{0},
			expected:    "${A} < 0.000000",
		},
		{
			description: "is within",
			ref:         "B",
			function:    "within_range",
			params:      []float64{20, 80},
			expected:    "${B} > 20.000000 && ${B} < 80.000000",
		},
		{
			description: "is outside",
			ref:         "B",
			function:    "outside_range",
			params:      []float64{20, 80},
			expected:    "${B} < 20.000000 || ${B} > 80.000000",
		},
	}

	for _, tc := range cases {
		t.Run(tc.description, func(t *testing.T) {
			expr, err := createMathExpression(tc.ref, tc.function, tc.params)

			require.Nil(t, err)
			require.NotNil(t, expr)

			require.Equal(t, expr, tc.expected)
		})
	}

	t.Run("should error if function is unsupported", func(t *testing.T) {
		expr, err := createMathExpression("A", "foo", []float64{0})
		require.Equal(t, expr, "")
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "no such threshold function")
	})
}

func TestIsSupportedThresholdFunc(t *testing.T) {
	type testCase struct {
		function  string
		supported bool
	}

	cases := []testCase{
		{
			function:  ThresholdIsAbove,
			supported: true,
		},
		{
			function:  ThresholdIsBelow,
			supported: true,
		},
		{
			function:  ThresholdIsWithinRange,
			supported: true,
		},
		{
			function:  ThresholdIsOutsideRange,
			supported: true,
		},
		{
			function:  "foo",
			supported: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.function, func(t *testing.T) {
			supported := IsSupportedThresholdFunc(tc.function)
			require.Equal(t, supported, tc.supported)
		})
	}
}
