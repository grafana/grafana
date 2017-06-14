package prometheus

import (
	"testing"

	p "github.com/prometheus/common/model"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPrometheus(t *testing.T) {
	Convey("Prometheus", t, func() {

		Convey("converting metric name", func() {
			metric := map[p.LabelName]p.LabelValue{
				p.LabelName("app"):    p.LabelValue("backend"),
				p.LabelName("device"): p.LabelValue("mobile"),
			}

			query := &PrometheusQuery{
				LegendFormat: "legend {{app}} {{ device }} {{broken}}",
			}

			So(formatLegend(metric, query), ShouldEqual, "legend backend mobile {{broken}}")
		})

		Convey("build full serie name", func() {
			metric := map[p.LabelName]p.LabelValue{
				p.LabelName(p.MetricNameLabel): p.LabelValue("http_request_total"),
				p.LabelName("app"):             p.LabelValue("backend"),
				p.LabelName("device"):          p.LabelValue("mobile"),
			}

			query := &PrometheusQuery{
				LegendFormat: "",
			}

			So(formatLegend(metric, query), ShouldEqual, `http_request_total{app="backend", device="mobile"}`)
		})
	})
}
