package conditions

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryCondition(t *testing.T) {

	Convey("when evaluating query condition", t, func() {

		queryConditionScenario("Given avg() and > 100", func(ctx *queryConditionTestContext) {

			ctx.reducer = `{"type": "avg"}`
			ctx.evaluator = `{"type": ">", "params": [100]}`

			Convey("Can read query condition from json model", func() {
				ctx.exec()

				So(ctx.condition.Query.From, ShouldEqual, "5m")
				So(ctx.condition.Query.To, ShouldEqual, "now")
				So(ctx.condition.Query.DatasourceId, ShouldEqual, 1)

				Convey("Can read query reducer", func() {
					reducer, ok := ctx.condition.Reducer.(*SimpleReducer)
					So(ok, ShouldBeTrue)
					So(reducer.Type, ShouldEqual, "avg")
				})

				Convey("Can read evaluator", func() {
					evaluator, ok := ctx.condition.Evaluator.(*DefaultAlertEvaluator)
					So(ok, ShouldBeTrue)
					So(evaluator.Type, ShouldEqual, ">")
				})
			})

			Convey("should fire when avg is above 100", func() {
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", [][2]float64{{120, 0}})}
				ctx.exec()

				So(ctx.result.Error, ShouldBeNil)
				So(ctx.result.Firing, ShouldBeTrue)
			})

			Convey("Should not fire when avg is below 100", func() {
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", [][2]float64{{90, 0}})}
				ctx.exec()

				So(ctx.result.Error, ShouldBeNil)
				So(ctx.result.Firing, ShouldBeFalse)
			})
		})
	})
}

type queryConditionTestContext struct {
	reducer   string
	evaluator string
	series    tsdb.TimeSeriesSlice
	result    *alerting.AlertResultContext
	condition *QueryCondition
}

type queryConditionScenarioFunc func(c *queryConditionTestContext)

func (ctx *queryConditionTestContext) exec() {
	jsonModel, err := simplejson.NewJson([]byte(`{
            "type": "query",
            "query":  {
              "params": ["A", "5m", "now"],
              "datasourceId": 1,
              "model": {"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
            },
            "reducer":` + ctx.reducer + `,
            "evaluator":` + ctx.evaluator + `
          }`))
	So(err, ShouldBeNil)

	condition, err := NewQueryCondition(jsonModel, 0)
	So(err, ShouldBeNil)

	ctx.condition = condition

	condition.HandleRequest = func(req *tsdb.Request) (*tsdb.Response, error) {
		return &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"A": {Series: ctx.series},
			},
		}, nil
	}

	condition.Eval(ctx.result)
}

func queryConditionScenario(desc string, fn queryConditionScenarioFunc) {
	Convey(desc, func() {

		bus.AddHandler("test", func(query *m.GetDataSourceByIdQuery) error {
			query.Result = &m.DataSource{Id: 1, Type: "graphite"}
			return nil
		})

		ctx := &queryConditionTestContext{}
		ctx.result = &alerting.AlertResultContext{
			Rule: &alerting.AlertRule{},
		}

		fn(ctx)
	})
}
