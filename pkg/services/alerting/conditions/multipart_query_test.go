package conditions

import (
	"context"
	"testing"

	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMultipartQueryCondition(t *testing.T) {

	Convey("when evaluating multi-part query condition", t, func() {

		multipartQueryConditionScenario("Given ( avg(), avg() ), and A > B", func(ctx *multipartQueryConditionTestContext) {

			ctx.reducer = `{"type": "avg"}`
			ctx.evaluator = `{"type": "gt-query"}`

			Convey("Can read condition queries from json model", func() {
				ctx.exec()

				So(ctx.condition.QueryParts[0].Query.From, ShouldEqual, "5m")
				So(ctx.condition.QueryParts[0].Query.To, ShouldEqual, "now")
				So(ctx.condition.QueryParts[0].Query.DatasourceId, ShouldEqual, 1)

				So(ctx.condition.QueryParts[1].Query.From, ShouldEqual, "5m")
				So(ctx.condition.QueryParts[1].Query.To, ShouldEqual, "now")
				So(ctx.condition.QueryParts[1].Query.DatasourceId, ShouldEqual, 1)

				Convey("Can read query reducers", func() {
					reducer, ok := ctx.condition.QueryParts[0].Reducer.(*SimpleReducer)
					So(ok, ShouldBeTrue)
					So(reducer.Type, ShouldEqual, "avg")

					reducer, ok = ctx.condition.QueryParts[1].Reducer.(*SimpleReducer)
					So(ok, ShouldBeTrue)
					So(reducer.Type, ShouldEqual, "avg")
				})

				Convey("Can read query evaluators", func() {
					evaluator, ok := ctx.condition.Evaluator.(*QueryComparisonEvaluator)
					So(ok, ShouldBeTrue)
					So(evaluator.Type, ShouldEqual, "gt-query")
				})
			})

			Convey("should fire when avg(A) is above avg(B)", func() {
				pointsA := tsdb.NewTimeSeriesPointsFromArgs(120, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)
				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {tsdb.NewTimeSeries("test1", pointsA)},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("Should not fire when avg(A) is below avg(B)", func() {
				pointsA := tsdb.NewTimeSeriesPointsFromArgs(90, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)

				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {tsdb.NewTimeSeries("test1", pointsA)},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeFalse)
			})

			Convey("Should fire if only first serie matches", func() {

				pointsASerie1 := tsdb.NewTimeSeriesPointsFromArgs(120, 0)
				pointsASerie2 := tsdb.NewTimeSeriesPointsFromArgs(0, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)

				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {
						tsdb.NewTimeSeries("test1", pointsASerie1),
						tsdb.NewTimeSeries("test2", pointsASerie2),
					},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})
		})

		multipartQueryConditionScenario("Given ( avg(), avg() ), (1.0, 0.8) and A > B", func(ctx *multipartQueryConditionTestContext) {

			ctx.reducer = `{"type": "avg"}`
			ctx.evaluator = `{"type": "gt-query"}`

			ctx.scalars["A"] = 1.0
			ctx.scalars["B"] = 0.8

			Convey("Can read condition queries from json model", func() {
				ctx.exec()

				So(ctx.condition.QueryParts[0].Query.From, ShouldEqual, "5m")
				So(ctx.condition.QueryParts[0].Query.To, ShouldEqual, "now")
				So(ctx.condition.QueryParts[0].Query.DatasourceId, ShouldEqual, 1)

				So(ctx.condition.QueryParts[1].Query.From, ShouldEqual, "5m")
				So(ctx.condition.QueryParts[1].Query.To, ShouldEqual, "now")
				So(ctx.condition.QueryParts[1].Query.DatasourceId, ShouldEqual, 1)

				Convey("Can read query reducers", func() {
					reducer, ok := ctx.condition.QueryParts[0].Reducer.(*SimpleReducer)
					So(ok, ShouldBeTrue)
					So(reducer.Type, ShouldEqual, "avg")

					reducer, ok = ctx.condition.QueryParts[1].Reducer.(*SimpleReducer)
					So(ok, ShouldBeTrue)
					So(reducer.Type, ShouldEqual, "avg")
				})

				Convey("Can read query evaluators", func() {
					evaluator, ok := ctx.condition.Evaluator.(*QueryComparisonEvaluator)
					So(ok, ShouldBeTrue)
					So(evaluator.Type, ShouldEqual, "gt-query")
				})
			})

			Convey("should fire when avg(A) is above  0.8 * avg(B)", func() {
				pointsA := tsdb.NewTimeSeriesPointsFromArgs(90, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)
				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {tsdb.NewTimeSeries("test1", pointsA)},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("Should not fire when avg(A) is below 0.8 * avg(B)", func() {
				pointsA := tsdb.NewTimeSeriesPointsFromArgs(75, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)

				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {tsdb.NewTimeSeries("test1", pointsA)},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeFalse)
			})

			Convey("Should fire if only first serie matches", func() {

				pointsASerie1 := tsdb.NewTimeSeriesPointsFromArgs(90, 0)
				pointsASerie2 := tsdb.NewTimeSeriesPointsFromArgs(0, 0)
				pointsB := tsdb.NewTimeSeriesPointsFromArgs(100, 100)

				ctx.series = map[string]tsdb.TimeSeriesSlice{
					"A": {
						tsdb.NewTimeSeries("test1", pointsASerie1),
						tsdb.NewTimeSeries("test2", pointsASerie2),
					},
					"B": {tsdb.NewTimeSeries("test1", pointsB)},
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("No series", func() {
				Convey("Should set NoDataFound when condition is gt", func() {
					ctx.series = map[string]tsdb.TimeSeriesSlice{}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.Firing, ShouldBeFalse)
					So(cr.NoDataFound, ShouldBeTrue)
				})
			})

			Convey("Empty series", func() {
				Convey("Should set NoDataFound both series are empty", func() {
					ctx.series = map[string]tsdb.TimeSeriesSlice{
						"A": {
							tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs()),
							tsdb.NewTimeSeries("test2", tsdb.NewTimeSeriesPointsFromArgs()),
						},
						"B": {
							tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs(100, 100)),
						},
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeTrue)
				})

				Convey("Should set NoDataFound both series contains null", func() {
					ctx.series = map[string]tsdb.TimeSeriesSlice{
						"A": {
							tsdb.NewTimeSeries("test1", tsdb.TimeSeriesPoints{tsdb.TimePoint{null.FloatFromPtr(nil), null.FloatFrom(0)}}),
							tsdb.NewTimeSeries("test2", tsdb.TimeSeriesPoints{tsdb.TimePoint{null.FloatFromPtr(nil), null.FloatFrom(0)}}),
						},
						"B": {
							tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs(100, 100)),
						},
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeTrue)
				})

				Convey("Should not set NoDataFound if one serie is empty", func() {
					ctx.series = map[string]tsdb.TimeSeriesSlice{
						"A": {
							tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs()),
							tsdb.NewTimeSeries("test2", tsdb.NewTimeSeriesPointsFromArgs(120, 0)),
						},
						"B": {
							tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs(100, 100)),
						},
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeFalse)
				})
			})
		})
	})
}

type multipartQueryConditionTestContext struct {
	reducer   string
	evaluator string
	series    map[string]tsdb.TimeSeriesSlice
	scalars   map[string]float64
	result    *alerting.EvalContext
	condition *MultipartQueryCondition
}

type multipartQueryConditionScenarioFunc func(c *multipartQueryConditionTestContext)

func (ctx *multipartQueryConditionTestContext) scalar(queryID string) float64 {
	scalar, valid := ctx.scalars[queryID]
	if !valid {
		scalar = 1.0
	}
	return scalar
}

func (ctx *multipartQueryConditionTestContext) exec() (*alerting.ConditionResult, error) {
	jsonModel, err := simplejson.NewJson(
		[]byte(`{
            "type": "multipartQuery",
            "queryParts":  [
                {
					"query": {
						"params": ["A", "5m", "now"],
						"datasourceId": 1,
						"model": {"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
					},
					"scalar":` + fmt.Sprintf("%0.2f", ctx.scalar("A")) + `,
   			        "reducer":` + ctx.reducer + `
				},
                {
					"query": {
						"params": ["B", "5m", "now"],
						"datasourceId": 1,
						"model": {"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
					},
					"scalar":` + fmt.Sprintf("%0.2f", ctx.scalar("B")) + `,
   			        "reducer":` + ctx.reducer + `
				}
			],
			"evaluator":` + ctx.evaluator + `
		}`))
	So(err, ShouldBeNil)

	condition, err := newMultipartQueryCondition(jsonModel, 0)
	So(err, ShouldBeNil)

	ctx.condition = condition

	condition.HandleRequest = func(context context.Context, dsInfo *m.DataSource, req *tsdb.TsdbQuery) (*tsdb.Response, error) {
		queryName := req.Queries[0].RefId
		series := ctx.series[queryName]

		return &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				queryName: {Series: series},
			},
		}, nil
	}

	return condition.Eval(ctx.result)
}

func multipartQueryConditionScenario(desc string, fn multipartQueryConditionScenarioFunc) {
	Convey(desc, func() {

		bus.AddHandler("test", func(query *m.GetDataSourceByIdQuery) error {
			query.Result = &m.DataSource{Id: 1, Type: "graphite"}
			return nil
		})

		ctx := &multipartQueryConditionTestContext{}
		ctx.result = &alerting.EvalContext{
			Rule: &alerting.Rule{},
		}

		ctx.series = make(map[string]tsdb.TimeSeriesSlice)
		ctx.scalars = make(map[string]float64)

		fn(ctx)
	})
}
