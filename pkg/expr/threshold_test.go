package expr

import (
	"context"
	"encoding/json"
	"math"
	"slices"
	"sort"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
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
			fn:          "eq",
			args:        []float64{0},
			shouldError: false,
		},
		{
			fn:          "ne",
			args:        []float64{0},
			shouldError: false,
		},
		{
			fn:          "gte",
			args:        []float64{0},
			shouldError: false,
		},
		{
			fn:          "lte",
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
			fn:          "within_range_included",
			args:        []float64{0, 1},
			shouldError: false,
		},
		{
			fn:          "outside_range_included",
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
			fn:            "eq",
			args:          []float64{},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "ne",
			args:          []float64{},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "gte",
			args:          []float64{},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "lte",
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
		{
			fn:            "within_range_included",
			args:          []float64{0},
			shouldError:   true,
			expectedError: "incorrect number of arguments",
		},
		{
			fn:            "outside_range_included",
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
				require.Equal(t, greaterThanPredicate{20.0}, cmd.predicate)
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
				require.Equal(t, greaterThanPredicate{100.0}, cmd.LoadingThresholdFunc.predicate)
				require.Equal(t, []string{"B"}, cmd.UnloadingThresholdFunc.NeedsVars())
				require.Equal(t, ThresholdIsBelow, cmd.UnloadingThresholdFunc.ThresholdFunc)
				require.Equal(t, lessThanPredicate{31.0}, cmd.UnloadingThresholdFunc.predicate)
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
			function:  ThresholdIsEqual,
			supported: true,
		},
		{
			function:  ThresholdIsNotEqual,
			supported: true,
		},
		{
			function:  ThresholdIsGreaterThanEqual,
			supported: true,
		},
		{
			function:  ThresholdIsLessThanEqual,
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
			function:  ThresholdIsWithinRangeIncluded,
			supported: true,
		},
		{
			function:  ThresholdIsOutsideRangeIncluded,
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

func TestThresholdExecute(t *testing.T) {
	input := map[string]mathexp.Value{
		//
		"no-data": mathexp.NewNoData(),
		//
		"series - numbers":     newSeries(8, 9, 10, 11, 12),
		"series - empty":       newSeriesPointer(),
		"series - all nils":    newSeriesPointer(nil, nil, nil),
		"series - with labels": newSeriesWithLabels(data.Labels{"test": "test"}, nil, util.Pointer(float64(9)), nil, util.Pointer(float64(11)), nil),
		"series - with NaNs":   newSeries(math.NaN(), math.NaN(), math.NaN()),
		//
		"scalar - nil": newScalar(nil),
		"scalar - NaN": newScalar(util.Pointer(math.NaN())),
		"scalar - 8":   newScalar(util.Pointer(float64(8))),
		"scalar - 9":   newScalar(util.Pointer(float64(9))),
		"scalar - 10":  newScalar(util.Pointer(float64(10))),
		"scalar - 11":  newScalar(util.Pointer(float64(11))),
		"scalar - 12":  newScalar(util.Pointer(float64(12))),
		//
		"number - nil": newNumber(data.Labels{"number": "test"}, nil),
		"number - NaN": newNumber(data.Labels{"number": "test"}, util.Pointer(math.NaN())),
		"number - 8":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(8))),
		"number - 9":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(9))),
		"number - 10":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(10))),
		"number - 11":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(11))),
		"number - 12":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(12))),
	}
	keys := maps.Keys(input)
	slices.Sort(keys)
	testCases := []struct {
		name     string
		pred     predicate
		expected map[string]mathexp.Value
		errorMsg string
	}{
		{
			name: "greater than 10",
			pred: greaterThanPredicate{10.0},
			expected: map[string]mathexp.Value{
				//
				"no-data": mathexp.NewNoData(),
				//
				"series - numbers":     newSeries(0, 0, 0, 1, 1),
				"series - empty":       newSeriesPointer(),
				"series - all nils":    newSeriesPointer(nil, nil, nil),
				"series - with labels": newSeriesWithLabels(data.Labels{"test": "test"}, nil, util.Pointer(float64(0)), nil, util.Pointer(float64(1)), nil),
				"series - with NaNs":   newSeries(0, 0, 0),
				//
				"scalar - nil": newScalar(nil),
				"scalar - NaN": newScalar(util.Pointer(float64(0))),
				"scalar - 8":   newScalar(util.Pointer(float64(0))),
				"scalar - 9":   newScalar(util.Pointer(float64(0))),
				"scalar - 10":  newScalar(util.Pointer(float64(0))),
				"scalar - 11":  newScalar(util.Pointer(float64(1))),
				"scalar - 12":  newScalar(util.Pointer(float64(1))),
				//
				"number - nil": newNumber(data.Labels{"number": "test"}, nil),
				"number - NaN": newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 8":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 9":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 10":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 11":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
				"number - 12":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
			},
		},
		{
			name: "less than 10",
			pred: lessThanPredicate{10.0},
			expected: map[string]mathexp.Value{
				//
				"no-data": mathexp.NewNoData(),
				//
				"series - numbers":     newSeries(1, 1, 0, 0, 0),
				"series - empty":       newSeriesPointer(),
				"series - all nils":    newSeriesPointer(nil, nil, nil),
				"series - with labels": newSeriesWithLabels(data.Labels{"test": "test"}, nil, util.Pointer(float64(1)), nil, util.Pointer(float64(0)), nil),
				"series - with NaNs":   newSeries(0, 0, 0),
				//
				"scalar - nil": newScalar(nil),
				"scalar - NaN": newScalar(util.Pointer(float64(0))),
				"scalar - 8":   newScalar(util.Pointer(float64(1))),
				"scalar - 9":   newScalar(util.Pointer(float64(1))),
				"scalar - 10":  newScalar(util.Pointer(float64(0))),
				"scalar - 11":  newScalar(util.Pointer(float64(0))),
				"scalar - 12":  newScalar(util.Pointer(float64(0))),
				//
				"number - nil": newNumber(data.Labels{"number": "test"}, nil),
				"number - NaN": newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 8":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
				"number - 9":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
				"number - 10":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 11":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 12":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
			},
		},
		{
			name: "within range (8,11)",
			pred: withinRangePredicate{8, 11},
			expected: map[string]mathexp.Value{
				//
				"no-data": mathexp.NewNoData(),
				//
				"series - numbers":     newSeries(0, 1, 1, 0, 0),
				"series - empty":       newSeriesPointer(),
				"series - all nils":    newSeriesPointer(nil, nil, nil),
				"series - with labels": newSeriesWithLabels(data.Labels{"test": "test"}, nil, util.Pointer(float64(1)), nil, util.Pointer(float64(0)), nil),
				"series - with NaNs":   newSeries(0, 0, 0),
				//
				"scalar - nil": newScalar(nil),
				"scalar - NaN": newScalar(util.Pointer(float64(0))),
				"scalar - 8":   newScalar(util.Pointer(float64(0))),
				"scalar - 9":   newScalar(util.Pointer(float64(1))),
				"scalar - 10":  newScalar(util.Pointer(float64(1))),
				"scalar - 11":  newScalar(util.Pointer(float64(0))),
				"scalar - 12":  newScalar(util.Pointer(float64(0))),
				//
				"number - nil": newNumber(data.Labels{"number": "test"}, nil),
				"number - NaN": newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 8":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 9":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
				"number - 10":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
				"number - 11":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 12":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
			},
		},
		{
			name: "outside range (8, 11)",
			pred: outsideRangePredicate{8, 11},
			expected: map[string]mathexp.Value{
				//
				"no-data": mathexp.NewNoData(),
				//
				"series - numbers":     newSeries(0, 0, 0, 0, 1),
				"series - empty":       newSeriesPointer(),
				"series - all nils":    newSeriesPointer(nil, nil, nil),
				"series - with labels": newSeriesWithLabels(data.Labels{"test": "test"}, nil, util.Pointer(float64(0)), nil, util.Pointer(float64(0)), nil),
				"series - with NaNs":   newSeries(0, 0, 0),
				//
				"scalar - nil": newScalar(nil),
				"scalar - NaN": newScalar(util.Pointer(float64(0))),
				"scalar - 8":   newScalar(util.Pointer(float64(0))),
				"scalar - 9":   newScalar(util.Pointer(float64(0))),
				"scalar - 10":  newScalar(util.Pointer(float64(0))),
				"scalar - 11":  newScalar(util.Pointer(float64(0))),
				"scalar - 12":  newScalar(util.Pointer(float64(1))),
				//
				"number - nil": newNumber(data.Labels{"number": "test"}, nil),
				"number - NaN": newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 8":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 9":   newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 10":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 11":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(0))),
				"number - 12":  newNumber(data.Labels{"number": "test"}, util.Pointer(float64(1))),
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cmd := ThresholdCommand{
				predicate:    tc.pred,
				ReferenceVar: "A",
			}
			for _, name := range keys {
				t.Run(name, func(t *testing.T) {
					result, err := cmd.Execute(context.Background(), time.Now(), mathexp.Vars{
						"A": newResults(input[name]),
					}, tracing.InitializeTracerForTest())
					require.NoError(t, err)
					require.Equal(t, newResults(tc.expected[name]), result)
				})
			}
		})
	}
}
