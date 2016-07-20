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

		bus.AddHandler("test", func(query *m.GetDataSourceByIdQuery) error {
			query.Result = &m.DataSource{Id: 1, Type: "graphite"}
			return nil
		})

		Convey("Given avg() and > 100", func() {

			jsonModel, err := simplejson.NewJson([]byte(`{
            "type": "query",
            "query":  {
              "params": ["A", "5m", "now"],
              "datasourceId": 1,
              "model": {"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
            },
            "reducer": {"type": "avg", "params": []},
            "evaluator": {"type": ">", "params": [100]}
          }`))
			So(err, ShouldBeNil)

			condition, err := NewQueryCondition(jsonModel)
			So(err, ShouldBeNil)

			Convey("Should set result to triggered when avg is above 100", func() {
				context := &AlertResultContext{
					Rule: &AlertRule{},
				}

				condition.HandleRequest = func(req *tsdb.Request) (*tsdb.Response, error) {
					return &tsdb.Response{
						Results: map[string]*tsdb.QueryResult{
							"A": &tsdb.QueryResult{
								Series: tsdb.TimeSeriesSlice{
									tsdb.NewTimeSeries("test1", [][2]float64{{120, 0}}),
								},
							},
						},
					}, nil
				}

				condition.Eval(context)

				So(context.Error, ShouldBeNil)
				So(context.Triggered, ShouldBeTrue)
			})
		})

	})
}
