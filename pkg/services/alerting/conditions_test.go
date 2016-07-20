package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryCondition(t *testing.T) {

	Convey("when evaluating query condition", t, func() {

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
				context := &AlertResultContext{}
				condition.Eval(context)

				So(context.Triggered, ShouldBeTrue)
			})
		})

	})
}
