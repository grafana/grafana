package testdatasource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestUSAScenario(t *testing.T) {
	p := &Service{}

	t.Run("usa query modes", func(t *testing.T) {
		start := time.Date(2020, time.January, 10, 23, 0, 0, 0, time.UTC)
		qr := &backend.QueryDataRequest{}
		for _, mode := range []string{
			modeValueAsRow,
			modeValueAsFields,
			modeValueAsLabeledFields,
			modeTimeseries,
			modeTimeseriesWide,
		} {
			query := usaQueryWrapper{
				USA: usaQuery{
					Mode: mode,
				},
			}

			if mode != modeValueAsRow {
				query.USA.Fields = []string{"foo", "bar"}
				query.USA.States = []string{"CA", "OR", "NV"}
			}

			raw, _ := json.Marshal(query)
			qr.Queries = append(qr.Queries,
				backend.DataQuery{
					RefID: mode,
					TimeRange: backend.TimeRange{
						From: start,
						To:   start.Add(time.Second * 10),
					},
					Interval:      time.Second,
					MaxDataPoints: 10,
					JSON:          raw,
				},
			)
		}

		rsp, err := p.handleUSAScenario(context.Background(), qr)
		require.NoError(t, err)
		require.NotNil(t, rsp)
		for k, v := range rsp.Responses {
			dr := v
			experimental.CheckGoldenJSONResponse(t, "testdata", "usa-"+k, &dr, true)
		}
	})

	t.Run("max results caps data points", func(t *testing.T) {
		// maxUSAResults is 10k. With 3 states and 2 fields, totalFactor = 6,
		// so maxAllowed = 10_000/6 = 1666.
		// A huge MaxDataPoints should be capped down to that.
		svc := &Service{}
		query := usaQueryWrapper{
			USA: usaQuery{
				Mode:   modeTimeseries,
				Fields: []string{"foo", "bar"},
				States: []string{"CA", "OR", "NV"},
			},
		}

		raw, _ := json.Marshal(query)
		start := time.Date(2020, time.January, 10, 23, 0, 0, 0, time.UTC)
		qr := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: start,
						To:   start.Add(time.Hour),
					},
					Interval:      time.Millisecond,
					MaxDataPoints: 999_999_999,
					JSON:          raw,
				},
			},
		}

		rsp, err := svc.handleUSAScenario(context.Background(), qr)
		require.NoError(t, err)
		require.NotNil(t, rsp)

		dr := rsp.Responses["A"]
		// 2 fields × 3 states = 6 frames
		require.Len(t, dr.Frames, 6)
		// Each frame should have at most maxUSAResults/(states*fields) = 1666 rows
		maxAllowed := int(maxUSAResults / (3 * 2))
		for _, frame := range dr.Frames {
			require.LessOrEqual(t, frame.Rows(), maxAllowed)
		}
	})
}
