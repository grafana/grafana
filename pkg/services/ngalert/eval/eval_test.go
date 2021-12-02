package eval

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestEvaluateExecutionResult(t *testing.T) {
	cases := []struct {
		desc               string
		execResults        ExecutionResults
		expectResultLength int
		expectResults      Results
	}{
		{
			desc: "zero valued single instance is single Normal state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{ptr.Float64(0)})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Normal,
				},
			},
		},
		{
			desc: "non-zero valued single instance is single Alerting state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{ptr.Float64(1)})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Alerting,
				},
			},
		},
		{
			desc: "nil value single instance is single a NoData state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{nil})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "an execution error produces a single Error state result",
			execResults: ExecutionResults{
				Error: fmt.Errorf("an execution error"),
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("an execution error"),
				},
			},
		},
		{
			desc:               "empty results produces a single NoData state result",
			execResults:        ExecutionResults{},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "frame with no fields produces a NoData state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame(""),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "empty field produces a NoData state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", nil, []*float64{})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: NoData,
				},
			},
		},
		{
			desc: "empty field with labels produces a NoData state result with labels",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("", data.NewField("", data.Labels{"a": "b"}, []*float64{})),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State:    NoData,
					Instance: data.Labels{"a": "b"},
				},
			},
		},
		{
			desc: "malformed frame (unequal lengths) produces Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(23)}),
						data.NewField("", nil, []*float64{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unable to get frame row length: frame has different field lengths, field 0 is len 1 but field 1 is len 0"),
				},
			},
		},
		{
			desc: "too many fields produces Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{}),
						data.NewField("", nil, []*float64{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unexpected field length: 2 instead of 1"),
				},
			},
		},
		{
			desc: "more than one row produces Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(2), ptr.Float64(3)}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : unexpected row length: 2 instead of 0 or 1"),
				},
			},
		},
		{
			desc: "time fields (looks like time series) returns error",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []time.Time{}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : looks like time series data, only reduced data can be alerted on."),
				},
			},
		},
		{
			desc: "non []*float64 field will produce Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []float64{2}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : invalid field type: []float64"),
				},
			},
		},
		{
			desc: "duplicate labels produce a single Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(1)}),
					),
					data.NewFrame("",
						data.NewField("", nil, []*float64{ptr.Float64(2)}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : frame cannot uniquely be identified by its labels: has duplicate results with labels {}"),
				},
			},
		},
		{
			desc: "error that produce duplicate empty labels produce a single Error state result",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", data.Labels{"a": "b"}, []float64{2}),
					),
					data.NewFrame("",
						data.NewField("", nil, []float64{2}),
					),
				},
			},
			expectResultLength: 1,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : frame cannot uniquely be identified by its labels: has duplicate results with labels {}"),
				},
			},
		},
		{
			desc: "certain errors will produce multiple mixed Error and other state results",
			execResults: ExecutionResults{
				Results: []*data.Frame{
					data.NewFrame("",
						data.NewField("", nil, []float64{3}),
					),
					data.NewFrame("",
						data.NewField("", data.Labels{"a": "b"}, []*float64{ptr.Float64(2)}),
					),
				},
			},
			expectResultLength: 2,
			expectResults: Results{
				{
					State: Error,
					Error: fmt.Errorf("invalid format of evaluation results for the alert definition : invalid field type: []float64"),
				},
				{
					State:    Alerting,
					Instance: data.Labels{"a": "b"},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.desc, func(t *testing.T) {
			res := evaluateExecutionResult(tc.execResults, time.Time{})

			require.Equal(t, tc.expectResultLength, len(res))

			for i, r := range res {
				require.Equal(t, tc.expectResults[i].State, r.State)
				require.Equal(t, tc.expectResults[i].Instance, r.Instance)
				if tc.expectResults[i].State == Error {
					require.EqualError(t, tc.expectResults[i].Error, r.Error.Error())
				}
			}
		})
	}
}

func TestEvaluateExecutionResultsNoData(t *testing.T) {
	t.Run("no data for Ref ID will produce NoData result", func(t *testing.T) {
		results := ExecutionResults{
			NoData: map[string]string{
				"A": "1",
			},
		}
		v := evaluateExecutionResult(results, time.Time{})
		require.Len(t, v, 1)
		require.Equal(t, data.Labels{"datasource_uid": "1"}, v[0].Instance)
		require.Equal(t, NoData, v[0].State)
	})

	t.Run("no data for Ref IDs will produce NoData result for each data source", func(t *testing.T) {
		results := ExecutionResults{
			NoData: map[string]string{
				"A": "1",
				"B": "1",
				"C": "2",
			},
		}
		v := evaluateExecutionResult(results, time.Time{})
		require.Len(t, v, 2)
		require.Equal(t, NoData, v[0].State)
		require.Equal(t, NoData, v[1].State)

		datasourceUIDs := make([]string, 0, len(v))
		for _, next := range v {
			datasourceUID, ok := next.Instance["datasource_uid"]
			require.True(t, ok)
			require.NotEqual(t, "", datasourceUID)
			datasourceUIDs = append(datasourceUIDs, datasourceUID)
		}
		require.ElementsMatch(t, []string{"1", "2"}, datasourceUIDs)
	})
}
