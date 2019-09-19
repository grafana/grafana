package sqlstore

import (
	"context"
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

		err := SaveDashboard(context.Background(), folderCmd)
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

			err := SaveProvisionedDashboard(context.Background(), cmd)
			So(err, ShouldBeNil)
			So(cmd.Result, ShouldNotBeNil)
			So(cmd.Result.Id, ShouldNotEqual, 0)
			dashId := cmd.Result.Id

			Convey("Can query for provisioned dashboards", func() {
				query := &models.GetProvisionedDashboardDataQuery{Name: "default"}
				err := GetProvisionedDashboardDataQuery(context.Background(), query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].DashboardId, ShouldEqual, dashId)
				So(query.Result[0].Updated, ShouldEqual, now.Unix())
			})

			Convey("Can query for one provisioned dashboard", func() {
				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: cmd.Result.Id}

				err := GetProvisionedDataByDashboardId(context.Background(), query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldNotBeNil)
			})

			Convey("Can query for none provisioned dashboard", func() {
				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: 3000}

				err := GetProvisionedDataByDashboardId(context.Background(), query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})

			Convey("Deleting folder should delete provision meta data", func() {
				deleteCmd := &models.DeleteDashboardCommand{
					Id:    folderCmd.Result.Id,
					OrgId: 1,
				}

				So(DeleteDashboard(context.Background(), deleteCmd), ShouldBeNil)

				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: cmd.Result.Id}

				err = GetProvisionedDataByDashboardId(context.Background(), query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})

			Convey("UnprovisionDashboard should delete provisioning metadata", func() {
				unprovisionCmd := &models.UnprovisionDashboardCommand{
					Id: dashId,
				}

				So(UnprovisionDashboard(context.Background(), unprovisionCmd), ShouldBeNil)

				query := &models.GetProvisionedDashboardDataByIdQuery{DashboardId: dashId}

				err = GetProvisionedDataByDashboardId(context.Background(), query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldBeNil)
			})
		})
	})
}
