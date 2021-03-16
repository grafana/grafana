package loki

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestLoki(t *testing.T) {
	dsInfo := &models.DataSource{
		JsonData: simplejson.New(),
	}

	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &lokiQuery{
			LegendFormat: "legend {{app}} {{ device }} {{broken}}",
		}

		require.Equal(t, "legend backend mobile ", formatLegend(metric, query))
	})

	t.Run("build full series name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName(p.MetricNameLabel): p.LabelValue("http_request_total"),
			p.LabelName("app"):             p.LabelValue("backend"),
			p.LabelName("device"):          p.LabelValue("mobile"),
		}

		query := &lokiQuery{
			LegendFormat: "",
		}

		require.Equal(t, `http_request_total{app="backend", device="mobile"}`, formatLegend(metric, query))
	})

	t.Run("parsing query model with step", func(t *testing.T) {
		json := `{
				"expr": "go_goroutines",
				"format": "time_series",
				"refId": "A"
			}`
		jsonModel, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		timeRange := plugins.NewDataTimeRange("12h", "now")
		queryContext := plugins.DataQuery{
			Queries: []plugins.DataSubQuery{
				{Model: jsonModel},
			},
			TimeRange: &timeRange,
		}

		exe := newExecutor()
		require.NoError(t, err)
		models, err := exe.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		json := `{
				"expr": "go_goroutines",
				"format": "time_series",
				"refId": "A"
			}`
		jsonModel, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		timeRange := plugins.NewDataTimeRange("48h", "now")
		queryContext := plugins.DataQuery{
			TimeRange: &timeRange,
			Queries: []plugins.DataSubQuery{
				{Model: jsonModel},
			},
		}
		exe := newExecutor()
		require.NoError(t, err)
		models, err := exe.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)

		timeRange = plugins.NewDataTimeRange("1h", "now")
		queryContext.TimeRange = &timeRange
		models, err = exe.parseQuery(dsInfo, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*2, models[0].Step)
	})
}
