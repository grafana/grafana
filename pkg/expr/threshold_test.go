package expr

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestNewThresholdCommand(t *testing.T) {
	type testCase struct {
		fn            ThresholdType
		args          []float64
		shouldError   bool
		expectedError string
	}

	cases := []testCase{
		{
			fn:          "gt",
			args:        []float64{0},
			shouldError: false,
		},
		{
			fn:          "lt",
			args:        []float64{0},
			shouldError: false,
		},
		{
			fn:          "within_range",
			args:        []float64{0, 1},
			shouldError: false,
		},
		{
			fn:          "outside_range",
			args:        []float64{0, 1},
			shouldError: false,
		},
		{
			fn:            "gt",
			args:          []float64{},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "lt",
			args:          []float64{},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "within_range",
			args:          []float64{0},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "outside_range",
			args:          []float64{0},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
	}

	for _, tc := range cases {
		cmd, err := NewThresholdCommand("B", "A", tc.fn, tc.args)

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

func TestUnmarshalThresholdCommand(t *testing.T) {
	type testCase struct {
		description   string
		query         string
		shouldError   bool
		expectedError string
		assert        func(*testing.T, Command)
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
			assert: func(t *testing.T, command Command) {
				require.IsType(t, &ThresholdCommand{}, command)
				cmd := command.(*ThresholdCommand)
				require.Equal(t, []string{"A"}, cmd.NeedsVars())
				require.Equal(t, ThresholdIsAbove, cmd.ThresholdFunc)
				require.Equal(t, []float64{20.0, 80.0}, cmd.Conditions)
			},
		},
		{
			description: "unmarshal with missing conditions should error",
			query: `{
				"expression" : "A",
				"type": "threshold",
				"conditions": []
			}`,
			shouldError:   true,
			expectedError: "threshold expression requires exactly one condition",
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
			shouldError: true,
		},
		{
			description: "unmarshal as hysteresis command if two evaluators",
			query: `{
				  "expression": "B",
				  "conditions": [
				    {
				      "evaluator": {
				        "params": [
				          100
				        ],
				        "type": "gt"
				      },
				      "unloadEvaluator": {
				        "params": [
				          31
				        ],
				        "type": "lt"
				      },
				      "loadedDimensions": {"schema":{"name":"test","meta":{"type":"fingerprints","typeVersion":[1,0]},"fields":[{"name":"fingerprints","type":"number","typeInfo":{"frame":"uint64"}}]},"data":{"values":[[18446744073709551615,2,3,4,5]]}}
				    }
				  ]
				}`,
			assert: func(t *testing.T, c Command) {
				require.IsType(t, &HysteresisCommand{}, c)
				cmd := c.(*HysteresisCommand)
				require.Equal(t, []string{"B"}, cmd.NeedsVars())
				require.Equal(t, []string{"B"}, cmd.LoadingThresholdFunc.NeedsVars())
				require.Equal(t, ThresholdIsAbove, cmd.LoadingThresholdFunc.ThresholdFunc)
				require.Equal(t, []float64{100.0}, cmd.LoadingThresholdFunc.Conditions)
				require.Equal(t, []string{"B"}, cmd.UnloadingThresholdFunc.NeedsVars())
				require.Equal(t, ThresholdIsBelow, cmd.UnloadingThresholdFunc.ThresholdFunc)
				require.Equal(t, []float64{31.0}, cmd.UnloadingThresholdFunc.Conditions)
				require.True(t, cmd.UnloadingThresholdFunc.Invert)
				require.NotNil(t, cmd.LoadedDimensions)
				actual := make([]uint64, 0, len(cmd.LoadedDimensions))
				for fingerprint := range cmd.LoadedDimensions {
					actual = append(actual, uint64(fingerprint))
				}
				sort.Slice(actual, func(i, j int) bool {
					return actual[i] < actual[j]
				})

				require.EqualValues(t, []uint64{2, 3, 4, 5, 18446744073709551615}, actual)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.description, func(t *testing.T) {
			q := []byte(tc.query)
			var qmap = make(map[string]any)
			require.NoError(t, json.Unmarshal(q, &qmap))

			cmd, err := UnmarshalThresholdCommand(&rawNode{
				RefID:      "",
				Query:      qmap,
				QueryRaw:   []byte(tc.query),
				QueryType:  "",
				DataSource: nil,
			}, featuremgmt.WithFeatures(featuremgmt.FlagRecoveryThreshold))

			if tc.shouldError {
				require.Nil(t, cmd)
				require.NotNil(t, err)
				require.Contains(t, err.Error(), tc.expectedError)
			} else {
				require.Nil(t, err)
				require.NotNil(t, cmd)
				if tc.assert != nil {
					tc.assert(t, cmd)
				}
			}
		})
	}
}

func TestThresholdCommandVars(t *testing.T) {
	cmd, err := NewThresholdCommand("B", "A", "lt", []float64{1.0})
	require.Nil(t, err)
	require.Equal(t, cmd.NeedsVars(), []string{"A"})
}

func TestCreateMathExpression(t *testing.T) {
	type testCase struct {
		description string
		expected    string

		ref      string
		function ThresholdType
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
			expr, err := createMathExpression(tc.ref, tc.function, tc.params, false)

			require.Nil(t, err)
			require.NotNil(t, expr)

			require.Equal(t, tc.expected, expr)

			t.Run("inverted", func(t *testing.T) {
				expr, err := createMathExpression(tc.ref, tc.function, tc.params, true)
				require.Nil(t, err)
				require.NotNil(t, expr)

				require.Equal(t, fmt.Sprintf("!(%s)", tc.expected), expr)
			})
		})
	}

	t.Run("should error if function is unsupported", func(t *testing.T) {
		expr, err := createMathExpression("A", "foo", []float64{0}, false)
		require.Equal(t, expr, "")
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "no such threshold function")
	})
}

func TestIsSupportedThresholdFunc(t *testing.T) {
	type testCase struct {
		function  ThresholdType
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
		t.Run(string(tc.function), func(t *testing.T) {
			supported := IsSupportedThresholdFunc(string(tc.function))
			require.Equal(t, supported, tc.supported)
		})
	}
}

func TestIsHysteresisExpression(t *testing.T) {
	cases := []struct {
		name     string
		input    json.RawMessage
		expected bool
	}{
		{
			name:     "false if it's empty",
			input:    json.RawMessage(`{}`),
			expected: false,
		},
		{
			name:     "false if it is not threshold type",
			input:    json.RawMessage(`{ "type": "reduce" }`),
			expected: false,
		},
		{
			name:     "false if no conditions",
			input:    json.RawMessage(`{ "type": "threshold" }`),
			expected: false,
		},
		{
			name:     "false if many conditions",
			input:    json.RawMessage(`{ "type": "threshold", "conditions": [{}, {}] }`),
			expected: false,
		},
		{
			name:     "false if condition is not an object",
			input:    json.RawMessage(`{ "type": "threshold", "conditions": ["test"] }`),
			expected: false,
		},
		{
			name:     "false if condition is does not have unloadEvaluator",
			input:    json.RawMessage(`{ "type": "threshold", "conditions": [{}] }`),
			expected: false,
		},
		{
			name:     "true type is threshold and a single condition has unloadEvaluator field",
			input:    json.RawMessage(`{ "type": "threshold", "conditions": [{ "unloadEvaluator" : {}}] }`),
			expected: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query := map[string]any{}
			require.NoError(t, json.Unmarshal(tc.input, &query))
			require.Equal(t, tc.expected, IsHysteresisExpression(query))
		})
	}
}

func TestSetLoadedDimensionsToHysteresisCommand(t *testing.T) {
	cases := []struct {
		name  string
		input json.RawMessage
	}{
		{
			name:  "error if model is empty",
			input: json.RawMessage(`{}`),
		},
		{
			name:  "error if is not a threshold type",
			input: json.RawMessage(`{ "type": "reduce" }`),
		},
		{
			name:  "error if threshold but no conditions",
			input: json.RawMessage(`{ "type": "threshold" }`),
		},
		{
			name:  "error if threshold and many conditions",
			input: json.RawMessage(`{ "type": "threshold", "conditions": [{}, {}] }`),
		},
		{
			name:  "error if condition is not an object",
			input: json.RawMessage(`{ "type": "threshold", "conditions": ["test"] }`),
		},
		{
			name:  "error if condition does not have unloadEvaluator",
			input: json.RawMessage(`{ "type": "threshold", "conditions": [{ "evaluator": { "params": [5], "type": "gt"}}], "expression": "A" }`),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			query := map[string]any{}
			require.NoError(t, json.Unmarshal(tc.input, &query))
			err := SetLoadedDimensionsToHysteresisCommand(query, Fingerprints{math.MaxUint64: {}, 2: {}, 3: {}})
			require.Error(t, err)
		})
	}

	t.Run("when unloadEvaluator is set, mutates query with loaded dimensions", func(t *testing.T) {
		fingerprints := Fingerprints{math.MaxUint64: {}, 2: {}, 3: {}}
		input := json.RawMessage(`{ "type": "threshold", "conditions": [{ "evaluator": { "params": [5], "type": "gt" }, "unloadEvaluator" : {"params": [2], "type": "lt"}}], "expression": "A" }`)
		query := map[string]any{}
		require.NoError(t, json.Unmarshal(input, &query))
		require.NoError(t, SetLoadedDimensionsToHysteresisCommand(query, fingerprints))
		raw, err := json.Marshal(query)
		require.NoError(t, err)

		// Assert the query is set by unmarshalling the query because it's the easiest way to assert Fingerprints
		cmd, err := UnmarshalThresholdCommand(&rawNode{
			RefID:    "B",
			QueryRaw: raw,
		}, featuremgmt.WithFeatures(featuremgmt.FlagRecoveryThreshold))
		require.NoError(t, err)

		require.Equal(t, fingerprints, cmd.(*HysteresisCommand).LoadedDimensions)
	})
}
