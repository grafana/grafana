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
	})
}
