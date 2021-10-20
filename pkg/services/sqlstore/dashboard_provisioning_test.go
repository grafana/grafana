//go:build integration
// +build integration

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
		sqlStore := InitTestDB(t)

		folderCmd := models.SaveDashboardCommand{
			OrgId:    1,
			FolderId: 0,
			IsFolder: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    nil,
				"title": "test dashboard",
			}),
		}

		dash, err := sqlStore.SaveDashboard(folderCmd)
		So(err, ShouldBeNil)

		saveDashboardCmd := models.SaveDashboardCommand{
			OrgId:    1,
			IsFolder: false,
			FolderId: dash.Id,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    nil,
				"title": "test dashboard",
			}),
		}

		Convey("Saving dashboards with provisioning meta data", func() {
			now := time.Now()

			provisioning := &models.DashboardProvisioning{
				Name:       "default",
				ExternalId: "/var/grafana.json",
				Updated:    now.Unix(),
			}

			dash, err := sqlStore.SaveProvisionedDashboard(saveDashboardCmd, provisioning)
			So(err, ShouldBeNil)
			So(dash, ShouldNotBeNil)
			So(dash.Id, ShouldNotEqual, 0)
			dashId := dash.Id

			Convey("Deleting orphaned provisioned dashboards", func() {
				saveCmd := models.SaveDashboardCommand{
					OrgId:    1,
					IsFolder: false,
					FolderId: dash.Id,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "another_dashboard",
					}),
				}
				provisioning := &models.DashboardProvisioning{
					Name:       "another_reader",
					ExternalId: "/var/grafana.json",
					Updated:    now.Unix(),
				}

				anotherDash, err := sqlStore.SaveProvisionedDashboard(saveCmd, provisioning)
				So(err, ShouldBeNil)

				query := &models.GetDashboardsQuery{DashboardIds: []int64{anotherDash.Id}}
				err = GetDashboards(context.Background(), query)
				So(err, ShouldBeNil)
				So(query.Result, ShouldNotBeNil)

				deleteCmd := &models.DeleteOrphanedProvisionedDashboardsCommand{ReaderNames: []string{"default"}}
				So(DeleteOrphanedProvisionedDashboards(context.Background(), deleteCmd), ShouldBeNil)

				query = &models.GetDashboardsQuery{DashboardIds: []int64{dash.Id, anotherDash.Id}}
				err = GetDashboards(context.Background(), query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Id, ShouldEqual, dashId)
			})

			Convey("Can query for provisioned dashboards", func() {
				rslt, err := sqlStore.GetProvisionedDashboardData("default")
				So(err, ShouldBeNil)

				So(len(rslt), ShouldEqual, 1)
				So(rslt[0].DashboardId, ShouldEqual, dashId)
				So(rslt[0].Updated, ShouldEqual, now.Unix())
			})

			Convey("Can query for one provisioned dashboard", func() {
				data, err := sqlStore.GetProvisionedDataByDashboardID(dash.Id)
				So(err, ShouldBeNil)

				So(data, ShouldNotBeNil)
			})

			Convey("Can query for none provisioned dashboard", func() {
				data, err := sqlStore.GetProvisionedDataByDashboardID(3000)
				So(err, ShouldBeNil)
				So(data, ShouldBeNil)
			})

			Convey("Deleting folder should delete provision meta data", func() {
				deleteCmd := &models.DeleteDashboardCommand{
					Id:    dash.Id,
					OrgId: 1,
				}

				So(DeleteDashboard(context.Background(), deleteCmd), ShouldBeNil)

				data, err := sqlStore.GetProvisionedDataByDashboardID(dash.Id)
				So(err, ShouldBeNil)
				So(data, ShouldBeNil)
			})

			Convey("UnprovisionDashboard should delete provisioning metadata", func() {
				unprovisionCmd := &models.UnprovisionDashboardCommand{
					Id: dashId,
				}

				So(UnprovisionDashboard(context.Background(), unprovisionCmd), ShouldBeNil)

				data, err := sqlStore.GetProvisionedDataByDashboardID(dashId)
				So(err, ShouldBeNil)
				So(data, ShouldBeNil)
			})
		})
	})
}
