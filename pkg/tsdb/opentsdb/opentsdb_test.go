package opentsdb

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestOpenTsdbExecutor(t *testing.T) {
	Convey("OpenTsdb query testing", t, func() {

		exec := &OpenTsdbExecutor{}

		Convey("Build metric with downsampling enabled", func() {

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

			So(len(metric), ShouldEqual, 3)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")
			So(metric["downsample"], ShouldEqual, "1m-avg")

		})

		Convey("Build metric with downsampling disabled", func() {

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

			So(len(metric), ShouldEqual, 2)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")

		})

		Convey("Build metric with downsampling enabled with params", func() {

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

			So(len(metric), ShouldEqual, 3)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")
			So(metric["downsample"], ShouldEqual, "5m-sum-null")
		})

		Convey("Build metric with tags with downsampling disabled", func() {

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

			So(len(metric), ShouldEqual, 3)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")
			So(metric["downsample"], ShouldEqual, nil)
			So(len(metric["tags"].(map[string]interface{})), ShouldEqual, 2)
			So(metric["tags"].(map[string]interface{})["env"], ShouldEqual, "prod")
			So(metric["tags"].(map[string]interface{})["app"], ShouldEqual, "grafana")
			So(metric["tags"].(map[string]interface{})["ip"], ShouldEqual, nil)
		})

		Convey("Build metric with rate enabled but counter disabled", func() {

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

			So(len(metric), ShouldEqual, 5)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")
			So(len(metric["tags"].(map[string]interface{})), ShouldEqual, 2)
			So(metric["tags"].(map[string]interface{})["env"], ShouldEqual, "prod")
			So(metric["tags"].(map[string]interface{})["app"], ShouldEqual, "grafana")
			So(metric["tags"].(map[string]interface{})["ip"], ShouldEqual, nil)
			So(metric["rate"], ShouldEqual, true)
			So(metric["rateOptions"].(map[string]interface{})["counter"], ShouldEqual, false)
		})

		Convey("Build metric with rate and counter enabled", func() {

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

			So(len(metric), ShouldEqual, 5)
			So(metric["metric"], ShouldEqual, "cpu.average.percent")
			So(metric["aggregator"], ShouldEqual, "avg")
			So(len(metric["tags"].(map[string]interface{})), ShouldEqual, 2)
			So(metric["tags"].(map[string]interface{})["env"], ShouldEqual, "prod")
			So(metric["tags"].(map[string]interface{})["app"], ShouldEqual, "grafana")
			So(metric["tags"].(map[string]interface{})["ip"], ShouldEqual, nil)
			So(metric["rate"], ShouldEqual, true)
			So(len(metric["rateOptions"].(map[string]interface{})), ShouldEqual, 3)
			So(metric["rateOptions"].(map[string]interface{})["counter"], ShouldEqual, true)
			So(metric["rateOptions"].(map[string]interface{})["counterMax"], ShouldEqual, 45)
			So(metric["rateOptions"].(map[string]interface{})["resetValue"], ShouldEqual, 60)
		})

	})
}
