package testdata

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTestdataScenarios(t *testing.T) {
	Convey("random walk ", t, func() {
		if scenario, exist := ScenarioRegistry["random_walk"]; exist {

			Convey("Should start at the requested value", func() {
				req := &tsdb.TsdbQuery{
					TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
					Queries: []*tsdb.Query{
						{RefId: "A", IntervalMs: 100, MaxDataPoints: 10, Model: simplejson.New()},
					},
				}
				query := req.Queries[0]
				query.Model.Set("startValue", 1.234)

				result := scenario.Handler(req.Queries[0], req)
				points := result.Series[0].Points

				So(result.Series, ShouldNotBeNil)
				So(points[0][0].Float64, ShouldEqual, 1.234)
			})

		} else {
			t.Fail()
		}
	})
}
