package prometheus

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	p "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestPrometheus(t *testing.T) {
	dsInfo := &models.DataSource{
		JsonData: simplejson.New(),
	}

	t.Run("converting metric name", func(t *testing.T) {
		metric := map[p.LabelName]p.LabelValue{
			p.LabelName("app"):    p.LabelValue("backend"),
			p.LabelName("device"): p.LabelValue("mobile"),
		}

		query := &PrometheusQuery{
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

		query := &PrometheusQuery{
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
		jsonModel, _ := simplejson.NewJson([]byte(json))
		queryContext := &tsdb.TsdbQuery{}
		queryModels := []*tsdb.Query{
			{Model: jsonModel},
		}

		queryContext.TimeRange = tsdb.NewTimeRange("12h", "now")

		models, err := parseQuery(dsInfo, queryModels, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*30, models[0].Step)
	})

	t.Run("parsing query model without step parameter", func(t *testing.T) {
		json := `{
				"expr": "go_goroutines",
				"format": "time_series",
				"intervalFactor": 1,
				"refId": "A"
			}`
		jsonModel, _ := simplejson.NewJson([]byte(json))
		queryContext := &tsdb.TsdbQuery{}
		queryModels := []*tsdb.Query{
			{Model: jsonModel},
		}

		queryContext.TimeRange = tsdb.NewTimeRange("48h", "now")
		models, err := parseQuery(dsInfo, queryModels, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)

		queryContext.TimeRange = tsdb.NewTimeRange("1h", "now")
		models, err = parseQuery(dsInfo, queryModels, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Second*15, models[0].Step)
	})

	t.Run("parsing query model with high intervalFactor", func(t *testing.T) {
		json := `{
					"expr": "go_goroutines",
					"format": "time_series",
					"intervalFactor": 10,
					"refId": "A"
				}`
		jsonModel, _ := simplejson.NewJson([]byte(json))
		queryContext := &tsdb.TsdbQuery{}
		queryModels := []*tsdb.Query{
			{Model: jsonModel},
		}

		queryContext.TimeRange = tsdb.NewTimeRange("48h", "now")

		models, err := parseQuery(dsInfo, queryModels, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Minute*20, models[0].Step)
	})

	t.Run("parsing query model with low intervalFactor", func(t *testing.T) {
		json := `{
					"expr": "go_goroutines",
					"format": "time_series",
					"intervalFactor": 1,
					"refId": "A"
				}`
		jsonModel, _ := simplejson.NewJson([]byte(json))
		queryContext := &tsdb.TsdbQuery{}
		queryModels := []*tsdb.Query{
			{Model: jsonModel},
		}

		queryContext.TimeRange = tsdb.NewTimeRange("48h", "now")

		models, err := parseQuery(dsInfo, queryModels, queryContext)
		require.NoError(t, err)
		require.Equal(t, time.Minute*2, models[0].Step)
	})
}
