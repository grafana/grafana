// +build integration

package sqlstore

import (
	"reflect"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func updateTestDashboard(dashboard *models.Dashboard, data map[string]interface{}) {
	data["id"] = dashboard.Id

	saveCmd := models.SaveDashboardCommand{
		OrgId:     dashboard.OrgId,
		Overwrite: true,
		Dashboard: simplejson.NewFromAny(data),
	}

	err := SaveDashboard(&saveCmd)
	So(err, ShouldBeNil)
}

func TestGetDashboardVersion(t *testing.T) {
	Convey("Testing dashboard version retrieval", t, func() {
		InitTestDB(t)

		Convey("Get a Dashboard ID and version ID", func() {
			savedDash := insertTestDashboard("test dash 26", 1, 0, false, "diff")

			query := models.GetDashboardVersionQuery{
				DashboardId: savedDash.Id,
				Version:     savedDash.Version,
				OrgId:       1,
			}

			err := GetDashboardVersion(&query)
			So(err, ShouldBeNil)
			So(savedDash.Id, ShouldEqual, query.DashboardId)
			So(savedDash.Version, ShouldEqual, query.Version)

			dashCmd := models.GetDashboardQuery{
				OrgId: savedDash.OrgId,
				Uid:   savedDash.Uid,
			}

			err = GetDashboard(&dashCmd)
			So(err, ShouldBeNil)
			eq := reflect.DeepEqual(dashCmd.Result.Data, query.Result.Data)
			So(eq, ShouldEqual, true)
		})

		Convey("Attempt to get a version that doesn't exist", func() {
			query := models.GetDashboardVersionQuery{
				DashboardId: int64(999),
				Version:     123,
				OrgId:       1,
			}

			err := GetDashboardVersion(&query)
			So(err, ShouldNotBeNil)
			So(err, ShouldEqual, models.ErrDashboardVersionNotFound)
		})
	})
}

func TestGetDashboardVersions(t *testing.T) {
	Convey("Testing dashboard versions retrieval", t, func() {
		InitTestDB(t)
		savedDash := insertTestDashboard("test dash 43", 1, 0, false, "diff-all")

		Convey("Get all versions for a given Dashboard ID", func() {
			query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}

			err := GetDashboardVersions(&query)
			So(err, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 1)
		})

		Convey("Attempt to get the versions for a non-existent Dashboard ID", func() {
			query := models.GetDashboardVersionsQuery{DashboardId: int64(999), OrgId: 1}

			err := GetDashboardVersions(&query)
			So(err, ShouldNotBeNil)
			So(err, ShouldEqual, models.ErrNoVersionsForDashboardId)
			So(len(query.Result), ShouldEqual, 0)
		})

		Convey("Get all versions for an updated dashboard", func() {
			updateTestDashboard(savedDash, map[string]interface{}{
				"tags": "different-tag",
			})

			query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}
			err := GetDashboardVersions(&query)

			So(err, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 2)
		})
	})
}

func TestDeleteExpiredVersions(t *testing.T) {
	Convey("Testing dashboard versions clean up", t, func() {
		InitTestDB(t)
		versionsToKeep := 5
		versionsToWrite := 10
		setting.DashboardVersionsToKeep = versionsToKeep

		savedDash := insertTestDashboard("test dash 53", 1, 0, false, "diff-all")
		for i := 0; i < versionsToWrite-1; i++ {
			updateTestDashboard(savedDash, map[string]interface{}{
				"tags": "different-tag",
			})
		}

		Convey("Clean up old dashboard versions", func() {
			err := DeleteExpiredVersions(&models.DeleteExpiredVersionsCommand{})
			So(err, ShouldBeNil)

			query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1}
			err = GetDashboardVersions(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, versionsToKeep)
			// Ensure latest versions were kept
			So(query.Result[versionsToKeep-1].Version, ShouldEqual, versionsToWrite-versionsToKeep+1)
			So(query.Result[0].Version, ShouldEqual, versionsToWrite)
		})

		Convey("Don't delete anything if there are no expired versions", func() {
			setting.DashboardVersionsToKeep = versionsToWrite

			err := DeleteExpiredVersions(&models.DeleteExpiredVersionsCommand{})
			So(err, ShouldBeNil)

			query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1, Limit: versionsToWrite}
			err = GetDashboardVersions(&query)
			So(err, ShouldBeNil)

			So(len(query.Result), ShouldEqual, versionsToWrite)
		})

		Convey("Don't delete more than MAX_VERSIONS_TO_DELETE_PER_BATCH * MAX_VERSION_DELETION_BATCHES per iteration", func() {
			perBatch := 10
			maxBatches := 10

			versionsToWriteBigNumber := perBatch*maxBatches + versionsToWrite
			for i := 0; i < versionsToWriteBigNumber-versionsToWrite; i++ {
				updateTestDashboard(savedDash, map[string]interface{}{
					"tags": "different-tag",
				})
			}

			err := deleteExpiredVersions(&models.DeleteExpiredVersionsCommand{}, perBatch, maxBatches)
			So(err, ShouldBeNil)

			query := models.GetDashboardVersionsQuery{DashboardId: savedDash.Id, OrgId: 1, Limit: versionsToWriteBigNumber}
			err = GetDashboardVersions(&query)
			So(err, ShouldBeNil)

			// Ensure we have at least versionsToKeep versions
			So(len(query.Result), ShouldBeGreaterThanOrEqualTo, versionsToKeep)
			// Ensure we haven't deleted more than perBatch * maxBatches rows
			So(versionsToWriteBigNumber-len(query.Result), ShouldBeLessThanOrEqualTo, perBatch*maxBatches)
		})
	})
}
