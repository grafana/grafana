package sqlstore

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardProvisioningTest(t *testing.T) {
	Convey("Testing Dashboard provisioning", t, func() {
		InitTestDB(t)

		folderCmd := &models.SaveDashboardCommand{
			OrgId:    1,
			FolderId: 0,
			IsFolder: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    nil,
				"title": "test dashboard",
			}),
		}

		err := SaveDashboard(folderCmd)
		So(err, ShouldBeNil)

		saveDashboardCmd := &models.SaveDashboardCommand{
			OrgId:    1,
			IsFolder: false,
			FolderId: folderCmd.Result.Id,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    nil,
				"title": "test dashboard",
			}),
		}

		Convey("Saving dashboards with provisioning meta data", func() {
			now := time.Now()

			cmd := &models.SaveProvisionedDashboardCommand{
				DashboardCmd: saveDashboardCmd,
				DashboardProvisioning: &models.DashboardProvisioning{
					Name:       "default",
					ExternalId: "/var/grafana.json",
					Updated:    now.Unix(),
				},
			}

			err := SaveProvisionedDashboard(cmd)
			So(err, ShouldBeNil)
			So(cmd.Result, ShouldNotBeNil)
			So(cmd.Result.Id, ShouldNotEqual, 0)
			dashId := cmd.Result.Id

			Convey("Deleting orphaned provisioned dashboards", func() {
				anotherCmd := &models.SaveProvisionedDashboardCommand{
					DashboardCmd: &models.SaveDashboardCommand{
						OrgId:    1,
						IsFolder: false,
						FolderId: folderCmd.Result.Id,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    nil,
							"title": "another_dashboard",
						}),
					},
					DashboardProvisioning: &models.DashboardProvisioning{
						Name:       "another_reader",
						ExternalId: "/var/grafana.json",
						Updated:    now.Unix(),
					},
				}

				err := SaveProvisionedDashboard(anotherCmd)
				So(err, ShouldBeNil)

				query := &models.GetDashboardsQuery{DashboardIds: []int64{anotherCmd.Result.Id}}
				err = GetDashboards(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldNotBeNil)

				deleteCmd := &models.DeleteOrphanedProvisionedDashboardsCommand{ReaderNames: []string{"default"}}
				So(DeleteOrphanedProvisionedDashboards(deleteCmd), ShouldBeNil)

				query = &models.GetDashboardsQuery{DashboardIds: []int64{cmd.Result.Id, anotherCmd.Result.Id}}
				err = GetDashboards(query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Id, ShouldEqual, dashId)
			})

			Convey("Can query for provisioned dashboards", func() {
				query := &models.GetProvisionedDashboardDataQuery{Name: "default"}
				err := GetProvisionedDashboardDataQuery(query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].DashboardId, ShouldEqual, dashId)
				So(query.Result[0].Updated, ShouldEqual, now.Unix())
			})

			Convey("Can query for one provisioned dashboard", func() {
				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: cmd.Result.Id}

				err := GetProvisionedDataByDashboardId(query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldNotBeNil)
			})

			Convey("Can query for none provisioned dashboard", func() {
				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: 3000}

				err := GetProvisionedDataByDashboardId(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})

			Convey("Deleting folder should delete provision meta data", func() {
				deleteCmd := &models.DeleteDashboardCommand{
					Id:    folderCmd.Result.Id,
					OrgId: 1,
				}

				So(DeleteDashboard(deleteCmd), ShouldBeNil)

				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: cmd.Result.Id}

				err = GetProvisionedDataByDashboardId(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})

			Convey("UnprovisionDashboard should delete provisioning metadata", func() {
				unprovisionCmd := &models.UnprovisionDashboardCommand{
					Id: dashId,
				}

				So(UnprovisionDashboard(unprovisionCmd), ShouldBeNil)

				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: dashId}

				err = GetProvisionedDataByDashboardId(query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})
		})
	})
}
