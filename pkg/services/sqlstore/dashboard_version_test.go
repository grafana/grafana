package sqlstore

import (
	"reflect"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

func updateTestDashboard(dashboard *m.Dashboard, data map[string]interface{}) {
	data["title"] = dashboard.Title

	saveCmd := m.SaveDashboardCommand{
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
			savedDash := insertTestDashboard("test dash 26", 1, "diff")

			cmd := m.GetDashboardVersionCommand{
				DashboardId: savedDash.Id,
				Version:     savedDash.Version,
			}

			err := GetDashboardVersion(&cmd)
			So(err, ShouldBeNil)
			So(savedDash.Id, ShouldEqual, cmd.DashboardId)
			So(savedDash.Version, ShouldEqual, cmd.Version)

			dashCmd := m.GetDashboardQuery{
				OrgId: savedDash.OrgId,
				Slug:  savedDash.Slug,
			}
			err = GetDashboard(&dashCmd)
			So(err, ShouldBeNil)
			eq := reflect.DeepEqual(dashCmd.Result.Data, cmd.Result.Data)
			So(eq, ShouldEqual, true)
		})

		Convey("Attempt to get a version that doesn't exist", func() {
			cmd := m.GetDashboardVersionCommand{
				DashboardId: int64(999),
				Version:     123,
			}

			err := GetDashboardVersion(&cmd)
			So(err, ShouldNotBeNil)
			So(err, ShouldEqual, m.ErrDashboardVersionNotFound)
		})
	})
}

func TestGetDashboardVersions(t *testing.T) {
	Convey("Testing dashboard versions retrieval", t, func() {
		InitTestDB(t)
		savedDash := insertTestDashboard("test dash 43", 1, "diff-all")

		Convey("Get all versions for a given Dashboard ID", func() {
			cmd := m.GetDashboardVersionsCommand{
				DashboardId: savedDash.Id,
			}

			err := GetDashboardVersions(&cmd)
			So(err, ShouldBeNil)
			So(len(cmd.Result), ShouldEqual, 1)
		})

		Convey("Attempt to get the versions for a non-existent Dashboard ID", func() {
			cmd := m.GetDashboardVersionsCommand{
				DashboardId: int64(999),
			}

			err := GetDashboardVersions(&cmd)
			So(err, ShouldNotBeNil)
			So(err, ShouldEqual, m.ErrNoVersionsForDashboardId)
			So(len(cmd.Result), ShouldEqual, 0)
		})

		Convey("Get all versions for an updated dashboard", func() {
			updateTestDashboard(savedDash, map[string]interface{}{
				"tags": "different-tag",
			})

			cmd := m.GetDashboardVersionsCommand{
				DashboardId: savedDash.Id,
			}
			err := GetDashboardVersions(&cmd)
			So(err, ShouldBeNil)
			So(len(cmd.Result), ShouldEqual, 2)
		})
	})
}

func TestCompareDashboardVersions(t *testing.T) {
	Convey("Testing dashboard version comparison", t, func() {
		InitTestDB(t)

		savedDash := insertTestDashboard("test dash 43", 1, "x")
		updateTestDashboard(savedDash, map[string]interface{}{
			"tags": "y",
		})

		Convey("Compare two versions that are different", func() {
			getVersionCmd := m.GetDashboardVersionsCommand{
				DashboardId: savedDash.Id,
			}
			err := GetDashboardVersions(&getVersionCmd)
			So(err, ShouldBeNil)
			So(len(getVersionCmd.Result), ShouldEqual, 2)

			cmd := m.CompareDashboardVersionsCommand{
				DashboardId: savedDash.Id,
				Original:    getVersionCmd.Result[0].Version,
				New:         getVersionCmd.Result[1].Version,
				DiffType:    m.DiffDelta,
			}
			err = CompareDashboardVersionsCommand(&cmd)
			So(err, ShouldBeNil)
			So(cmd.Delta, ShouldNotBeNil)
		})

		Convey("Compare two versions that are the same", func() {
			cmd := m.CompareDashboardVersionsCommand{
				DashboardId: savedDash.Id,
				Original:    savedDash.Version,
				New:         savedDash.Version,
				DiffType:    m.DiffDelta,
			}

			err := CompareDashboardVersionsCommand(&cmd)
			So(err, ShouldNotBeNil)
			So(cmd.Delta, ShouldBeNil)
		})

		Convey("Compare two versions that don't exist", func() {
			cmd := m.CompareDashboardVersionsCommand{
				DashboardId: savedDash.Id,
				Original:    123,
				New:         456,
				DiffType:    m.DiffDelta,
			}

			err := CompareDashboardVersionsCommand(&cmd)
			So(err, ShouldNotBeNil)
			So(cmd.Delta, ShouldBeNil)
		})
	})
}

func TestRestoreDashboardVersion(t *testing.T) {
	Convey("Testing dashboard version restoration", t, func() {
		InitTestDB(t)
		savedDash := insertTestDashboard("test dash 26", 1, "restore")
		updateTestDashboard(savedDash, map[string]interface{}{
			"tags": "not restore",
		})

		Convey("Restore dashboard to a previous version", func() {
			versionsCmd := m.GetDashboardVersionsCommand{
				DashboardId: savedDash.Id,
			}
			err := GetDashboardVersions(&versionsCmd)
			So(err, ShouldBeNil)

			cmd := m.RestoreDashboardVersionCommand{
				DashboardId: savedDash.Id,
				Version:     savedDash.Version,
				UserId:      0,
			}

			err = RestoreDashboardVersion(&cmd)
			So(err, ShouldBeNil)
		})
	})
}
