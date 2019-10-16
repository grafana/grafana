package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchGMDRequestComposer(t *testing.T) {
	Convey("TestCloudWatchGMDRequestComposer", t, func() {
		e := &CloudWatchExecutor{
			DataSource: &models.DataSource{
				JsonData: simplejson.New(),
			},
		}

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := e.buildGetMetricDataQueries(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")}, []*CloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := e.buildGetMetricDataQueries(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")}, []*CloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})
	})

}
