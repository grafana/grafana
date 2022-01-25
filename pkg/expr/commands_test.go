package expr

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
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
