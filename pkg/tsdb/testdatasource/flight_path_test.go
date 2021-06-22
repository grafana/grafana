package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestFlightPathScenario(t *testing.T) {
	cfg := setting.NewCfg()
	p := &testDataPlugin{
		Cfg: cfg,
	}

	t.Run("simple flight", func(t *testing.T) {
		start := time.Date(2020, time.January, 10, 23, 0, 0, 0, time.UTC)
		qr := &backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID: "X",
					TimeRange: backend.TimeRange{
						From: start,
						To:   start.Add(time.Minute * 10),
					},
					Interval:      time.Minute,
					MaxDataPoints: 10,
					JSON: json.RawMessage(`{
						"period": 600
					}`),
				},
			},
		}

		rsp, err := p.handleFlightPathScenario(context.Background(), qr)
		require.NoError(t, err)
		require.NotNil(t, rsp)
		for k, v := range rsp.Responses {
			dr := v
			filePath := filepath.Join("testdata", fmt.Sprintf("flight-simple-%s.txt", k))
			err = experimental.CheckGoldenDataResponse(filePath, &dr, true)
			require.NoError(t, err)
		}
	})
}
