package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryCondition(t *testing.T) {

	Convey("when evaluating query condition", t, func() {

		queryConditionScenario("Given avg() and > 100", func(ctx *queryConditionTestContext) {

			ctx.reducer = `{"type": "avg"}`
			ctx.evaluator = `{"type": ">", "params": [100]}`

			Convey("should trigger when avg is above 100", func() {
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", [][2]float64{{120, 0}})}
				ctx.exec()

				So(ctx.result.Error, ShouldBeNil)
				So(ctx.result.Triggered, ShouldBeTrue)
			})

			Convey("Should not trigger when avg is below 100", func() {
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", [][2]float64{{90, 0}})}
				ctx.exec()

				So(ctx.result.Error, ShouldBeNil)
				So(ctx.result.Triggered, ShouldBeFalse)
			})
		})
	})
}

type queryConditionTestContext struct {
	reducer   string
	evaluator string
	series    tsdb.TimeSeriesSlice
	result    *AlertResultContext
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
		ctx.result = &AlertResultContext{
			Rule: &AlertRule{},
		}

		fn(ctx)
	})
}
