package opentsdb

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestOpenTsdbExecutor(t *testing.T) {
	exec := &OpenTsdbExecutor{}

	t.Run("Build metric with downsampling enabled", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", false)
		query.Model.Set("downsampleInterval", "")
		query.Model.Set("downsampleAggregator", "avg")
		query.Model.Set("downsampleFillPolicy", "none")

		metric := exec.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Equal(t, "1m-avg", metric["downsample"])
	})

	t.Run("Build metric with downsampling disabled", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", true)
		query.Model.Set("downsampleInterval", "")
		query.Model.Set("downsampleAggregator", "avg")
		query.Model.Set("downsampleFillPolicy", "none")

		metric := exec.buildMetric(query)

		require.Len(t, metric, 2)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
	})

	t.Run("Build metric with downsampling enabled with params", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", false)
		query.Model.Set("downsampleInterval", "5m")
		query.Model.Set("downsampleAggregator", "sum")
		query.Model.Set("downsampleFillPolicy", "null")

		metric := exec.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Equal(t, "5m-sum-null", metric["downsample"])
	})

	t.Run("Build metric with tags with downsampling disabled", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", true)
		query.Model.Set("downsampleInterval", "5m")
		query.Model.Set("downsampleAggregator", "sum")
		query.Model.Set("downsampleFillPolicy", "null")

		tags := simplejson.New()
		tags.Set("env", "prod")
		tags.Set("app", "grafana")
		query.Model.Set("tags", tags.MustMap())

		metric := exec.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Nil(t, metric["downsample"])

		metricTags := metric["tags"].(map[string]interface{})
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])
	})

	t.Run("Build metric with rate enabled but counter disabled", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", true)
		query.Model.Set("shouldComputeRate", true)
		query.Model.Set("isCounter", false)

		tags := simplejson.New()
		tags.Set("env", "prod")
		tags.Set("app", "grafana")
		query.Model.Set("tags", tags.MustMap())

		metric := exec.buildMetric(query)

		require.Len(t, metric, 5)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])

		metricTags := metric["tags"].(map[string]interface{})
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		require.False(t, metric["rateOptions"].(map[string]interface{})["counter"].(bool))
	})

	t.Run("Build metric with rate and counter enabled", func(t *testing.T) {
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		query.Model.Set("metric", "cpu.average.percent")
		query.Model.Set("aggregator", "avg")
		query.Model.Set("disableDownsampling", true)
		query.Model.Set("shouldComputeRate", true)
		query.Model.Set("isCounter", true)
		query.Model.Set("counterMax", 45)
		query.Model.Set("counterResetValue", 60)

		tags := simplejson.New()
		tags.Set("env", "prod")
		tags.Set("app", "grafana")
		query.Model.Set("tags", tags.MustMap())

		metric := exec.buildMetric(query)

		require.Len(t, metric, 5)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])

		metricTags := metric["tags"].(map[string]interface{})
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		metricRateOptions := metric["rateOptions"].(map[string]interface{})
		require.Len(t, metricRateOptions, 3)
		require.True(t, metricRateOptions["counter"].(bool))
		require.Equal(t, float64(45), metricRateOptions["counterMax"])
		require.Equal(t, float64(60), metricRateOptions["resetValue"])
	})
}
