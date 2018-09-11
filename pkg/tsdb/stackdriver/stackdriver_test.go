package stackdriver

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStackdriver(t *testing.T) {
	Convey("Stackdriver", t, func() {
		Convey("Parse query from frontend", func() {
			executor := &StackdriverExecutor{}
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"target":     "target",
							"metricType": "time_series",
						}),
						RefId: "A",
					},
				},
			}
			queries, err := executor.parseQueries(tsdbQuery)
			So(err, ShouldBeNil)

			So(len(queries), ShouldEqual, 1)
			So(queries[0].RefID, ShouldEqual, "A")
			So(queries[0].Target, ShouldEqual, "target")
			So(len(queries[0].Params), ShouldEqual, 4)
			So(queries[0].Params["interval.startTime"][0], ShouldEqual, "2018-03-15T13:00:00Z")
			So(queries[0].Params["interval.endTime"][0], ShouldEqual, "2018-03-15T13:34:00Z")
			So(queries[0].Params["aggregation.perSeriesAligner"][0], ShouldEqual, "ALIGN_NONE")
			So(queries[0].Params["filter"][0], ShouldEqual, "time_series")
		})
	})
}
