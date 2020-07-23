package conditions

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryCondition(t *testing.T) {
	Convey("when evaluating query condition", t, func() {
		queryConditionScenario("Given avg() and > 100", func(ctx *queryConditionTestContext) {
			ctx.reducer = `{"type": "avg"}`
			ctx.evaluator = `{"type": "gt", "params": [100]}`

			Convey("Can read query condition from json model", func() {
				_, err := ctx.exec()
				So(err, ShouldBeNil)

				So(ctx.condition.Query.From, ShouldEqual, "5m")
				So(ctx.condition.Query.To, ShouldEqual, "now")
				So(ctx.condition.Query.DatasourceID, ShouldEqual, 1)

				Convey("Can read query reducer", func() {
					reducer := ctx.condition.Reducer
					So(reducer.Type, ShouldEqual, "avg")
				})

				Convey("Can read evaluator", func() {
					evaluator, ok := ctx.condition.Evaluator.(*thresholdEvaluator)
					So(ok, ShouldBeTrue)
					So(evaluator.Type, ShouldEqual, "gt")
				})
			})

			Convey("should fire when avg is above 100", func() {
				points := tsdb.NewTimeSeriesPointsFromArgs(120, 0)
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", points)}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("should fire when avg is above 100 on dataframe", func() {
				ctx.frame = data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Now(), time.Now()}),
					data.NewField("val", nil, []int64{120, 150}),
				)
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("Should not fire when avg is below 100", func() {
				points := tsdb.NewTimeSeriesPointsFromArgs(90, 0)
				ctx.series = tsdb.TimeSeriesSlice{tsdb.NewTimeSeries("test1", points)}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeFalse)
			})

			Convey("Should not fire when avg is below 100 on dataframe", func() {
				ctx.frame = data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Now(), time.Now()}),
					data.NewField("val", nil, []int64{12, 47}),
				)
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeFalse)
			})

			Convey("Should fire if only first series matches", func() {
				ctx.series = tsdb.TimeSeriesSlice{
					tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs(120, 0)),
					tsdb.NewTimeSeries("test2", tsdb.NewTimeSeriesPointsFromArgs(0, 0)),
				}
				cr, err := ctx.exec()

				So(err, ShouldBeNil)
				So(cr.Firing, ShouldBeTrue)
			})

			Convey("No series", func() {
				Convey("Should set NoDataFound when condition is gt", func() {
					ctx.series = tsdb.TimeSeriesSlice{}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.Firing, ShouldBeFalse)
					So(cr.NoDataFound, ShouldBeTrue)
				})

				Convey("Should be firing when condition is no_value", func() {
					ctx.evaluator = `{"type": "no_value", "params": []}`
					ctx.series = tsdb.TimeSeriesSlice{}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.Firing, ShouldBeTrue)
				})
			})

			Convey("Empty series", func() {
				Convey("Should set Firing if eval match", func() {
					ctx.evaluator = `{"type": "no_value", "params": []}`
					ctx.series = tsdb.TimeSeriesSlice{
						tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs()),
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.Firing, ShouldBeTrue)
				})

				Convey("Should set NoDataFound both series are empty", func() {
					ctx.series = tsdb.TimeSeriesSlice{
						tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs()),
						tsdb.NewTimeSeries("test2", tsdb.NewTimeSeriesPointsFromArgs()),
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeTrue)
				})

				Convey("Should set NoDataFound both series contains null", func() {
					ctx.series = tsdb.TimeSeriesSlice{
						tsdb.NewTimeSeries("test1", tsdb.TimeSeriesPoints{tsdb.TimePoint{null.FloatFromPtr(nil), null.FloatFrom(0)}}),
						tsdb.NewTimeSeries("test2", tsdb.TimeSeriesPoints{tsdb.TimePoint{null.FloatFromPtr(nil), null.FloatFrom(0)}}),
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeTrue)
				})

				Convey("Should not set NoDataFound if one series is empty", func() {
					ctx.series = tsdb.TimeSeriesSlice{
						tsdb.NewTimeSeries("test1", tsdb.NewTimeSeriesPointsFromArgs()),
						tsdb.NewTimeSeries("test2", tsdb.NewTimeSeriesPointsFromArgs(120, 0)),
					}
					cr, err := ctx.exec()

					So(err, ShouldBeNil)
					So(cr.NoDataFound, ShouldBeFalse)
				})
			})
		})
	})
}

type queryConditionTestContext struct {
	reducer   string
	evaluator string
	series    tsdb.TimeSeriesSlice
	frame     *data.Frame
	result    *alerting.EvalContext
	condition *QueryCondition
}

type queryConditionScenarioFunc func(c *queryConditionTestContext)

func (ctx *queryConditionTestContext) exec() (*alerting.ConditionResult, error) {
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

	condition, err := newQueryCondition(jsonModel, 0)
	So(err, ShouldBeNil)

	ctx.condition = condition

	qr := &tsdb.QueryResult{
		Series: ctx.series,
	}

	if ctx.frame != nil {
		qr = &tsdb.QueryResult{
			Dataframes: tsdb.NewDecodedDataFrames(data.Frames{ctx.frame}),
		}
	}

	condition.HandleRequest = func(context context.Context, dsInfo *models.DataSource, req *tsdb.TsdbQuery) (*tsdb.Response, error) {
		return &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				"A": qr,
			},
		}, nil
	}

	return condition.Eval(ctx.result)
}

func queryConditionScenario(desc string, fn queryConditionScenarioFunc) {
	Convey(desc, func() {
		bus.AddHandler("test", func(query *models.GetDataSourceByIdQuery) error {
			query.Result = &models.DataSource{Id: 1, Type: "graphite"}
			return nil
		})

		ctx := &queryConditionTestContext{}
		ctx.result = &alerting.EvalContext{
			Rule: &alerting.Rule{},
		}

		fn(ctx)
	})
}
