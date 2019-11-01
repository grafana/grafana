package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMetricDataInputBuilder(t *testing.T) {
	Convey("TestMetricDataInputBuilder", t, func() {
		executor := &CloudWatchExecutor{}
		query := make(map[string]*cloudWatchQuery)

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := executor.buildMetricDataInput(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")}, query)
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := executor.buildMetricDataInput(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")}, query)
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})
	})
}
