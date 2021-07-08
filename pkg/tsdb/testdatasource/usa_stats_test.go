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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUSAScenario(t *testing.T) {
	cfg := setting.NewCfg()
	p := &testDataPlugin{
		Cfg: cfg,
	}

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
			filePath := filepath.Join("testdata", fmt.Sprintf("usa-%s.txt", k))
			err = experimental.CheckGoldenDataResponse(filePath, &dr, true)
			assert.NoError(t, err) // require will fail after a single value
		}
	})
}
