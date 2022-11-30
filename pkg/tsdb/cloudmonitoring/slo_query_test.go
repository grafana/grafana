package cloudmonitoring

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func SLOQuery(t *testing.T) {
	t.Run("when data from query returns slo and alias by is defined", func(t *testing.T) {
		data, err := loadTestFile("./test-data/6-series-response-slo.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))

		t.Run("and alias by is expanded", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringSLO{
				params: url.Values{},
				parameters: &sloQuery{
					ProjectName:  "test-proj",
					SelectorName: "select_slo_compliance",
					ServiceId:    "test-service",
					SloId:        "test-slo",
				},
				aliasBy: "{{project}} - {{service}} - {{slo}} - {{selector}}",
			}
			err = query.parseResponse(res, data, "")
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, "test-proj - test-service - test-slo - select_slo_compliance", frames[0].Fields[1].Name)
		})
	})

	t.Run("when data from query returns slo and alias by is not defined", func(t *testing.T) {
		data, err := loadTestFile("./test-data/6-series-response-slo.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))

		t.Run("and alias by is expanded", func(t *testing.T) {
			res := &backend.DataResponse{}
			query := &cloudMonitoringSLO{
				params: url.Values{},
				parameters: &sloQuery{
					ProjectName:  "test-proj",
					SelectorName: "select_slo_compliance",
					ServiceId:    "test-service",
					SloId:        "test-slo",
				},
			}
			err = query.parseResponse(res, data, "")
			require.NoError(t, err)
			frames := res.Frames
			require.NoError(t, err)
			assert.Equal(t, "select_slo_compliance(\"projects/test-proj/services/test-service/serviceLevelObjectives/test-slo\")", frames[0].Fields[1].Name)
		})
	})

	t.Run("when data comes from a slo query, it should skip the link", func(t *testing.T) {
		data, err := loadTestFile("./test-data/3-series-response-distribution-exponential.json")
		require.NoError(t, err)
		assert.Equal(t, 1, len(data.TimeSeries))

		res := &backend.DataResponse{}
		query := &cloudMonitoringSLO{params: url.Values{}, parameters: &sloQuery{SloId: "yes"}}
		err = query.parseResponse(res, data, "")
		require.NoError(t, err)
		frames := res.Frames
		assert.Equal(t, len(frames[0].Fields[1].Config.Links), 0)
	})
}
