package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"
)

func Test_UnmarshalReduceCommand_Settings(t *testing.T) {
	var tests = []struct {
		name           string
		querySettings  string
		isError        bool
		expectedMapper mathexp.ReduceMapper
	}{
		{
			name:           "no mapper function when settings is not specified",
			querySettings:  ``,
			expectedMapper: nil,
		},
		{
			name:           "no mapper function when mode is not specified",
			querySettings:  `, "settings" : { }`,
			expectedMapper: nil,
		},
		{
			name:          "error when settings is not object",
			querySettings: `, "settings" : "drop-nan"`,
			isError:       true,
		},
		{
			name:           "no mapper function when mode is empty",
			querySettings:  `, "settings" : { "mode": "" }`,
			expectedMapper: nil,
		},
		{
			name:          "error when mode is not known",
			querySettings: `, "settings" : { "mode": "test" }`,
			isError:       true,
		},
		{
			name:           "filterNonNumber function when mode is 'dropNN'",
			querySettings:  `, "settings" : { "mode": "dropNN" }`,
			expectedMapper: mathexp.DropNonNumber{},
		},
		{
			name:           "replaceNanWithValue function when mode is 'dropNN'",
			querySettings:  `, "settings" : { "mode": "replaceNN" , "replaceWithValue": -12 }`,
			expectedMapper: mathexp.ReplaceNonNumberWithValue{Value: -12},
		},
		{
			name:          "error if mode is 'replaceNN' but field replaceWithValue is not specified",
			querySettings: `, "settings" : { "mode": "replaceNN" }`,
			isError:       true,
		},
		{
			name:          "error if mode is 'replaceNN' but field replaceWithValue is not a number",
			querySettings: `, "settings" : { "mode": "replaceNN", "replaceWithValue" : "-12" }`,
			isError:       true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			q := fmt.Sprintf(`{ "expression" : "$A", "reducer": "sum"%s }`, test.querySettings)
			var qmap = make(map[string]interface{})
			require.NoError(t, json.Unmarshal([]byte(q), &qmap))

			cmd, err := UnmarshalReduceCommand(&rawNode{
				RefID:      "A",
				Query:      qmap,
				QueryType:  "",
				TimeRange:  TimeRange{},
				DataSource: nil,
			})

			if test.isError {
				require.Error(t, err)
				return
			}

			require.NotNil(t, cmd)

			require.Equal(t, test.expectedMapper, cmd.seriesMapper)
		})
	}
}

func TestResampleCommand_Execute(t *testing.T) {
	varToReduce := util.GenerateShortUID()
	tr := TimeRange{
		From: time.Now().Add(-10 * time.Second),
		To:   time.Now(),
	}
	cmd, err := NewResampleCommand(util.GenerateShortUID(), "1s", varToReduce, "sum", "pad", tr)
	require.NoError(t, err)

	var tests = []struct {
		name         string
		vals         mathexp.Value
		isError      bool
		expectedType parse.ReturnType
	}{
		{
			name:         "should resample when input Series",
			vals:         mathexp.NewSeries(varToReduce, nil, 100),
			expectedType: parse.TypeSeriesSet,
		},
		{
			name:         "should return NoData when input NoData",
			vals:         mathexp.NoData{},
			expectedType: parse.TypeNoData,
		}, {
			name:    "should return error when input Number",
			vals:    mathexp.NewNumber("test", nil),
			isError: true,
		}, {
			name:    "should return error when input Scalar",
			vals:    mathexp.NewScalar("test", pointer.Float64(rand.Float64())),
			isError: true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, err := cmd.Execute(context.Background(), mathexp.Vars{
				varToReduce: mathexp.Results{Values: mathexp.Values{test.vals}},
			})
			if test.isError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Len(t, result.Values, 1)
				res := result.Values[0]
				require.Equal(t, test.expectedType, res.Type())
			}
		})
	}

	t.Run("should return empty result if input is nil Value", func(t *testing.T) {
		result, err := cmd.Execute(context.Background(), mathexp.Vars{
			varToReduce: mathexp.Results{Values: mathexp.Values{nil}},
		})
		require.Empty(t, result.Values)
		require.NoError(t, err)
	})
}
