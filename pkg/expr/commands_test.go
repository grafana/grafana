package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/util"
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

func TestReduceExecute(t *testing.T) {
	varToReduce := util.GenerateShortUID()
	cmd, err := NewReduceCommand(util.GenerateShortUID(), randomReduceFunc(), varToReduce, nil)
	require.NoError(t, err)

	t.Run("should noop if Number", func(t *testing.T) {
		var numbers mathexp.Values = []mathexp.Value{
			mathexp.GenerateNumber(ptr.Float64(rand.Float64())),
			mathexp.GenerateNumber(ptr.Float64(rand.Float64())),
			mathexp.GenerateNumber(ptr.Float64(rand.Float64())),
		}

		vars := map[string]mathexp.Results{
			varToReduce: {
				Values: numbers,
			},
		}

		execute, err := cmd.Execute(context.Background(), vars)
		require.NoError(t, err)

		require.Len(t, execute.Values, len(numbers))
		for i, value := range execute.Values {
			expected := numbers[i]
			require.Equal(t, expected.Type(), value.Type())
			require.Equal(t, expected.GetLabels(), value.GetLabels())

			expectedValue := expected.Value().(*mathexp.Number).GetFloat64Value()
			actualValue := value.Value().(*mathexp.Number).GetFloat64Value()
			require.Equal(t, expectedValue, actualValue)
		}

		t.Run("should add warn notices to every frame", func(t *testing.T) {
			frames := execute.Values.AsDataFrames("test")
			for _, frame := range frames {
				require.Len(t, frame.Meta.Notices, 1)
				notice := frame.Meta.Notices[0]
				require.Equal(t, data.NoticeSeverityWarning, notice.Severity)
			}
		})
	})
}

func randomReduceFunc() string {
	res := mathexp.GetSupportedReduceFuncs()
	return res[rand.Intn(len(res)-1)]
}
