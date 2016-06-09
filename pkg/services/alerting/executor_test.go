package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingExecutor(t *testing.T) {
	Convey("Test alert execution", t, func() {
		executor := NewExecutor()

		Convey("single time serie", func() {
			Convey("Show return ok since avg is above 2", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Ok)
			})

			Convey("Show return critical since below 2", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: "<"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Critical)
			})

			Convey("Show return critical since sum is above 10", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Critical)
			})

			Convey("Show return ok since avg is below 10", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Ok)
			})

			Convey("Show return ok since min is below 10", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{11, 0}, {9, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Ok)
			})

			Convey("Show return ok since max is above 10", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{1, 0}, {11, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Critical)
			})
		})

		Convey("muliple time series", func() {
			Convey("both are ok", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
					tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Ok)
			})

			Convey("first serie is good, second is critical", func() {
				rule := &AlertRule{Critical: Level{Level: 10, Operator: ">"}}

				timeSeries := []*tsdb.TimeSeries{
					tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
					tsdb.NewTimeSeries("test1", [][2]float64{{11, 0}}),
				}

				result := executor.evaluateRule(rule, timeSeries)
				So(result.State, ShouldEqual, alertstates.Critical)
			})
		})
	})
}
