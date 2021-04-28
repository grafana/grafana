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
				},
			},
		},
		{
			desc: "more than one row (e.g. time series) Error state result",
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
			}
		})
	}
}
