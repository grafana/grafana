package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/guardian"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFolderService(t *testing.T) {
	Convey("Folder service tests", t, func() {
		service := dashboardServiceImpl{
			orgId: 1,
			user:  &models.SignedInUser{UserId: 1},
		}

		Convey("Given user has no permissions", func() {
			origNewGuardian := guardian.New
			mockDashboardGuardian(&fakeDashboardGuardian{})

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = models.NewDashboardFolder("Folder")
				return nil
			})

			bus.AddHandler("test", func(cmd *models.ValidateDashboardAlertsCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.ValidateDashboardBeforeSaveCommand) error {
				return models.ErrDashboardUpdateAccessDenied
			})

			Convey("When get folder by id should return access denied error", func() {
				_, err := service.GetFolderById(1)
				So(err, ShouldNotBeNil)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When get folder by uid should return access denied error", func() {
				_, err := service.GetFolderByUid("uid")
				So(err, ShouldNotBeNil)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When creating folder should return access denied error", func() {
				err := service.CreateFolder(&models.CreateFolderCommand{
					Title: "Folder",
				})
				So(err, ShouldNotBeNil)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When updating folder should return access denied error", func() {
				err := service.UpdateFolder("uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				So(err, ShouldNotBeNil)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When deleting folder by uid should return access denied error", func() {
				_, err := service.DeleteFolder("uid")
				So(err, ShouldNotBeNil)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("Given user has permission to save", func() {
			origNewGuardian := guardian.New
			mockDashboardGuardian(&fakeDashboardGuardian{canSave: true})

			dash := models.NewDashboardFolder("Folder")
			dash.Id = 1

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dash
				return nil
			})

			bus.AddHandler("test", func(cmd *models.ValidateDashboardAlertsCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.ValidateDashboardBeforeSaveCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpdateDashboardAlertsCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.SaveDashboardCommand) error {
				cmd.Result = dash
				return nil
			})

			bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
				return nil
			})

			Convey("When creating folder should not return access denied error", func() {
				err := service.CreateFolder(&models.CreateFolderCommand{
					Title: "Folder",
				})
				So(err, ShouldBeNil)
			})

			Convey("When updating folder should not return access denied error", func() {
				err := service.UpdateFolder("uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
				So(err, ShouldBeNil)
			})

			Convey("When deleting folder by uid should not return access denied error", func() {
				_, err := service.DeleteFolder("uid")
				So(err, ShouldBeNil)
			})

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("Given user has permission to view", func() {
			origNewGuardian := guardian.New
			mockDashboardGuardian(&fakeDashboardGuardian{canView: true})

			dashFolder := models.NewDashboardFolder("Folder")
			dashFolder.Id = 1
			dashFolder.Uid = "uid-abc"

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dashFolder
				return nil
			})

			Convey("When get folder by id should return folder", func() {
				f, _ := service.GetFolderById(1)
				So(f.Id, ShouldEqual, dashFolder.Id)
				So(f.Uid, ShouldEqual, dashFolder.Uid)
				So(f.Title, ShouldEqual, dashFolder.Title)
			})

			Convey("When get folder by uid should not return access denied error", func() {
				f, _ := service.GetFolderByUid("uid")
				So(f.Id, ShouldEqual, dashFolder.Id)
				So(f.Uid, ShouldEqual, dashFolder.Uid)
				So(f.Title, ShouldEqual, dashFolder.Title)
			})

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})
	})
}
