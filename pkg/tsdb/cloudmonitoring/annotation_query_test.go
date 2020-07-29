package cloudmonitoring

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudMonitoringAnnotationQuery(t *testing.T) {
	Convey("CloudMonitoring Annotation Query Executor", t, func() {
		executor := &CloudMonitoringExecutor{}
		Convey("When parsing the cloud monitoring api response", func() {
			data, err := loadTestFile("./test-data/2-series-response-no-agg.json")
			So(err, ShouldBeNil)
			So(len(data.TimeSeries), ShouldEqual, 3)

			res := &tsdb.QueryResult{Meta: simplejson.New(), RefId: "annotationQuery"}
			query := &cloudMonitoringQuery{}
			err = executor.parseToAnnotations(res, data, query, "atitle {{metric.label.instance_name}} {{metric.value}}", "atext {{resource.label.zone}}", "atag")
			So(err, ShouldBeNil)

			Convey("Should return annotations table", func() {
				So(len(res.Tables), ShouldEqual, 1)
				So(len(res.Tables[0].Rows), ShouldEqual, 9)
				So(res.Tables[0].Rows[0][1], ShouldEqual, "atitle collector-asia-east-1 9.856650")
				So(res.Tables[0].Rows[0][3], ShouldEqual, "atext asia-east1-a")
			})
		})
	})
}
