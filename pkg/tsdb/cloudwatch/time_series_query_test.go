package cloudwatch

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestTimeSeriesQuery(t *testing.T) {
	Convey("TestTimeSeriesQuery", t, func() {
		executor := &CloudWatchExecutor{}

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := executor.executeTimeSeriesQuery(context.TODO(), &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := executor.executeTimeSeriesQuery(context.TODO(), &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})
	})
}
