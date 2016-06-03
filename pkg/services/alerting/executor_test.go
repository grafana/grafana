package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestAlertingExecutor(t *testing.T) {
	Convey("Test alert execution", t, func() {
		executor := &ExecutorImpl{}

		Convey("single time serie", func() {
			Convey("Show return ok since avg is above 2", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "sum"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateOk)
			})

			Convey("Show return critical since below 2", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: "<", Aggregator: "sum"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateCritical)
			})

			Convey("Show return critical since sum is above 10", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "sum"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateCritical)
			})

			Convey("Show return ok since avg is below 10", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "avg"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateOk)
			})

			Convey("Show return ok since min is below 10", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "min"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{11, 0}, {9, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateOk)
			})

			Convey("Show return ok since max is above 10", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "max"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{1, 0}, {11, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateCritical)
			})
		})

		Convey("muliple time series", func() {
			Convey("both are ok", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "sum"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
					m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateOk)
			})

			Convey("first serie is good, second is critical", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "sum"}

				timeSeries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
					m.NewTimeSeries("test1", [][2]float64{{11, 0}}),
				}

				result := executor.validateRule(rule, timeSeries)
				So(result.State, ShouldEqual, m.AlertStateCritical)
			})
		})
	})
}
