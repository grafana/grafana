package cloudwatch

import (
	"context"
	"testing"

	// "encoding/json"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"log"

	. "github.com/smartystreets/goconvey/convey"
)

// func prettyPrint(i interface{}) string {
// 	s, _ := json.MarshalIndent(i, "", "\t")
// 	return string(s)
// }

func TestTimeSeriesQuery(t *testing.T) {
	Convey("TestTimeSeriesQuery", t, func() {
		executor := &CloudWatchExecutor{}

		// plog.SetLevel(1)
		// var logger = plog.New("log", {"level"])

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := executor.executeTimeSeriesQuery(context.TODO(), &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")})

				// log.Println("")
				// log.Println("Err")
				// log.Println(prettyPrint(err.Error()))

				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := executor.executeTimeSeriesQuery(context.TODO(), &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")})
				// log.Println("")
				// log.Println("Err")
				// log.Println(prettyPrint(err.Error()))
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("Should correctly return alias when dimensions aren't matched", func() {

				js, err := simplejson.NewJson([]byte(`{
					"Dimensions": {
						"d": ["a", "b", "c"]
					}
				}`))

				query := &tsdb.Query{Model: js}
				queryList := []*tsdb.Query{query}

				response, err := executor.executeTimeSeriesQuery(context.TODO(), &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h"), Queries: queryList})

				log.Println("")
				log.Println("Response")
				log.Println(prettyPrint(response))
				log.Println("Err")
				log.Println(prettyPrint(err))
				// So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})
	})
}
