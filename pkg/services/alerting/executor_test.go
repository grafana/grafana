package alerting

import (
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestAlertingExecutor(t *testing.T) {
	Convey("Test alert execution", t, func() {
		executor := &ExecutorImpl{}

		Convey("Show return ok since avg is above 2", func() {
			rule := m.AlertRule{CritLevel: 10, CritOperator: "<", Aggregator: "sum"}

			timeseries := []*m.TimeSeries{
				m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			}

			result := executor.ValidateRule(rule, timeseries)
			So(result.State, ShouldEqual, m.AlertStateOk)
		})

		Convey("Show return critical since below 2", func() {
			rule := m.AlertRule{CritLevel: 10, CritOperator: ">", Aggregator: "sum"}

			timeseries := []*m.TimeSeries{
				m.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			}

			result := executor.ValidateRule(rule, timeseries)
			So(result.State, ShouldEqual, m.AlertStateCritical)
		})

		Convey("Show return critical since sum is above 10", func() {
			rule := m.AlertRule{CritLevel: 10, CritOperator: "<", Aggregator: "sum"}

			timeseries := []*m.TimeSeries{
				m.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
			}

			result := executor.ValidateRule(rule, timeseries)
			So(result.State, ShouldEqual, m.AlertStateCritical)
		})
		/*
			Convey("Show return ok since avg is below 10", func() {
				rule := m.AlertRule{CritLevel: 10, CritOperator: "<", Aggregator: "avg"}

				timeseries := []*m.TimeSeries{
					m.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
				}

				result := executor.ValidateRule(rule, timeseries)
				So(result.State, ShouldEqual, m.AlertStateOk)
			})
		*/
	})
}
