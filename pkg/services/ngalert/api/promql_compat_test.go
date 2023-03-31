package api

import (
	"encoding/json"
	"testing"

	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/stretchr/testify/require"
)

func Test_instantQueryMarshaling(t *testing.T) {
	for _, tc := range []struct {
		desc      string
		in        string
		exp       parser.ValueType
		expScalar *scalar
		expVector *vector
		isError   bool // successfully unpack an upstream error
	}{
		{
			desc: "scalar",
			in: `{
  "status": "success",
  "data": {
    "resultType": "scalar",
    "result": [
      12,
      "2"
    ]
  }
}`,
			exp: parser.ValueTypeScalar,
			expScalar: &scalar{
				T: 12000,
				V: 2,
			},
		},
		{
			desc: "vector",
			in: `{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {
          "__name__": "apiserver_request:burnrate1d"
        },
        "value": [
          12.04,
          "10.5"
        ]
      }
    ]
  }
}`,
			exp: parser.ValueTypeVector,
			expVector: &vector{
				sample{
					Value: scalar{
						T: 12000, // loses some precision during marshaling
						V: 10.5,
					},
					Metric: []labels.Label{{
						Name:  "__name__",
						Value: "apiserver_request:burnrate1d",
					}},
				},
			},
		},
		{
			desc: "successfully parse error",
			in: `{
  "status": "failure",
  "errorType": "someErr",
  "error": "error doing something"
}`,
			isError: true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			var out instantQueryResponse
			err := json.Unmarshal([]byte(tc.in), &out)
			require.NoError(t, err)

			if tc.isError {
				require.Equal(t, out.Status, "failure")
				require.Greater(t, len(out.ErrorType), 0)
				require.Greater(t, len(out.Error), 0)
				return
			}

			require.Equal(t, tc.exp, out.Data.ResultType)
			b, err := json.MarshalIndent(out, "", "  ")
			require.Nil(t, err)
			require.Equal(t, tc.in, string(b))

			if tc.expScalar != nil {
				require.Equal(t, *tc.expScalar, out.Data.scalar)
			}
			if tc.expVector != nil {
				require.Equal(t, *tc.expVector, out.Data.vector)
			}
		})
	}
}
