package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestStatsDataAccess(t *testing.T) {
	Convey("Testing Stats Data Access", t, func() {
		InitTestDB(t)

		Convey("Get system stats should not results in error", func() {
			query := models.GetSystemStatsQuery{}
			err := GetSystemStats(&query)
			So(err, ShouldBeNil)
		})

		Convey("Get system user count stats should not results in error", func() {
			query := models.GetSystemUserCountStatsQuery{}
			err := GetSystemUserCountStats(context.Background(), &query)
			So(err, ShouldBeNil)
		})

		Convey("Get datasource stats should not results in error", func() {
			query := models.GetDataSourceStatsQuery{}
			err := GetDataSourceStats(&query)
			So(err, ShouldBeNil)
		})

		Convey("Get datasource access stats should not results in error", func() {
			query := models.GetDataSourceAccessStatsQuery{}
			err := GetDataSourceAccessStats(&query)
			So(err, ShouldBeNil)
		})

		Convey("Get alert notifier stats should not results in error", func() {
			query := models.GetAlertNotifierUsageStatsQuery{}
			err := GetAlertNotifiersUsageStats(context.Background(), &query)
			So(err, ShouldBeNil)
		})

		Convey("Get admin stats should not result in error", func() {
			query := models.GetAdminStatsQuery{}
			err := GetAdminStats(&query)
			So(err, ShouldBeNil)
		})
	})
}
