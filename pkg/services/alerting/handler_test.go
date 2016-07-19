package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingExecutor(t *testing.T) {
	Convey("Test alert execution", t, func() {
		handler := NewHandler()

		Convey("single time serie", func() {
			Convey("Show return ok since avg is above 2", func() {
				json := `
        {
				"name": "name2",
				"description": "desc2",
				"handler": 0,
				"enabled": true,
				"frequency": "60s",
        "conditions": [
          {
            "type": "query",
            "query":  {
              "params": ["A", "5m", "now"],
              "datasourceId": 1,
              "model": {"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
            },
            "reducer": {"type": "avg", "params": []},
            "evaluator": {"type": ">", "params": [100]}
          }
        ]
			}
			`

				alertJSON, jsonErr := simplejson.NewJson([]byte(json))
				So(jsonErr, ShouldBeNil)

				alert := &models.Alert{Settings: alertJSON}
				rule, _ := NewAlertRuleFromDBModel(alert)

				// timeSeries := []*tsdb.TimeSeries{
				// 	tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
				// }

				result := handler.eval(rule)
				So(result.Triggered, ShouldEqual, true)
			})

			// 	Convey("Show return critical since below 2", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: "<"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Critical)
			// 	})
			//
			// 	Convey("Show return critical since sum is above 10", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("sum"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Critical)
			// 	})
			//
			// 	Convey("Show return ok since avg is below 10", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{9, 0}, {9, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Ok)
			// 	})
			//
			// 	Convey("Show return ok since min is below 10", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{11, 0}, {9, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Ok)
			// 	})
			//
			// 	Convey("Show return ok since max is above 10", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("max"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{6, 0}, {11, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Critical)
			// 	})
			//
			// })
			//
			// Convey("muliple time series", func() {
			// 	Convey("both are ok", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Ok)
			// 	})
			//
			// 	Convey("first serie is good, second is critical", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{2, 0}}),
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{11, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Critical)
			// 	})
			//
			// 	Convey("first serie is warn, second is critical", func() {
			// 		rule := &AlertRule{
			// 			Critical:    Level{Value: 10, Operator: ">"},
			// 			Warning:     Level{Value: 5, Operator: ">"},
			// 			Transformer: transformers.NewAggregationTransformer("avg"),
			// 		}
			//
			// 		timeSeries := []*tsdb.TimeSeries{
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{6, 0}}),
			// 			tsdb.NewTimeSeries("test1", [][2]float64{{11, 0}}),
			// 		}
			//
			// 		result := executor.evaluateRule(rule, timeSeries)
			// 		So(result.State, ShouldEqual, alertstates.Critical)
			// 	})
		})
	})
}
