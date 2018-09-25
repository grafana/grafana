package stackdriver

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStackdriverAnnotationQuery(t *testing.T) {
	Convey("Stackdriver Annotation Query Executor", t, func() {
		executor := &StackdriverExecutor{}
		Convey("Parse queries from frontend and build Stackdriver API queries", func() {
			fromStart := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC).In(time.Local)
			tsdbQuery := &tsdb.TsdbQuery{
				TimeRange: &tsdb.TimeRange{
					From: fmt.Sprintf("%v", fromStart.Unix()*1000),
					To:   fmt.Sprintf("%v", fromStart.Add(34*time.Minute).Unix()*1000),
				},
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"metricType": "a/metric/type",
							"view":       "FULL",
							"type":       "annotationQuery",
						}),
						RefId: "annotationQuery",
					},
				},
			}
			query, err := executor.buildAnnotationQuery(tsdbQuery)
			So(err, ShouldBeNil)

			So(query, ShouldNotBeNil)
		})
	})
}
