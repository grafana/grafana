package sims

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestFlightPathQuery(t *testing.T) {
	s, err := NewSimulationEngine()
	require.NoError(t, err)

	t.Run("simple flight", func(t *testing.T) {
		sq := &simulationQuery{}
		sq.Key = simulationKey{
			Type:   "flight",
			TickHZ: 1,
		}
		sq.Stream = true
		sb, err := json.Marshal(map[string]interface{}{
			"sim": sq,
		})
		require.NoError(t, err)

		start := time.Date(2020, time.January, 10, 23, 0, 0, 0, time.UTC)
		qr := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: start,
						To:   start.Add(time.Second * 10),
					},
					Interval:      time.Second,
					MaxDataPoints: 10,
					JSON:          sb,
				},
			},
		}

		rsp, err := s.QueryData(context.Background(), qr)
		require.NoError(t, err)
		require.NotNil(t, rsp)
		for k, v := range rsp.Responses {
			dr := v
			filePath := filepath.Join("testdata", fmt.Sprintf("flight_path_query_%s.txt", k))
			err = experimental.CheckGoldenDataResponse(filePath, &dr, true)
			require.NoError(t, err)
		}
	})
}
