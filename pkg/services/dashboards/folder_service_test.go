package dashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/guardian"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFolderService(t *testing.T) {
	Convey("Folder service tests", t, func() {
		service := dashboardServiceImpl{
			orgId:          1,
			user:           &models.SignedInUser{UserId: 1},
			dashboardStore: &fakeDashboardStore{},
		}

		Convey("Given user has no permissions", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{})

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = models.NewDashboardFolder("Folder")
				return nil
			})

			origStore := service.dashboardStore
			t.Cleanup(func() {
				service.dashboardStore = origStore
			})
			service.dashboardStore = &fakeDashboardStore{
				validationError: models.ErrDashboardUpdateAccessDenied,
			}

			Convey("When get folder by id should return access denied error", func() {
				_, err := service.GetFolderByID(1)
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When get folder by uid should return access denied error", func() {
				_, err := service.GetFolderByUID("uid")
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When creating folder should return access denied error", func() {
				_, err := service.CreateFolder("Folder", "")
				So(err, ShouldEqual, models.ErrFolderAccessDenied)
			})

			Convey("When updating folder should return access denied error", func() {
				err := service.UpdateFolder("uid", &models.UpdateFolderCommand{
					Uid:   "uid",
					Title: "Folder",
				})
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
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanSaveValue: true})

			dash := models.NewDashboardFolder("Folder")
			dash.Id = 1

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dash
				return nil
			})

			origUpdateAlerting := UpdateAlerting
			t.Cleanup(func() {
				UpdateAlerting = origUpdateAlerting
			})
			UpdateAlerting = func(store dashboards.Store, orgID int64, dashboard *models.Dashboard,
				user *models.SignedInUser) error {
				return nil
			}

			bus.AddHandler("test", func(cmd *models.SaveDashboardCommand) error {
				cmd.Result = dash
				return nil
			})

			bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
				return nil
			})

			Convey("When creating folder should not return access denied error", func() {
				_, err := service.CreateFolder("Folder", "")
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
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true})

			dashFolder := models.NewDashboardFolder("Folder")
			dashFolder.Id = 1
			dashFolder.Uid = "uid-abc"

			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = dashFolder
				return nil
			})

			Convey("When get folder by id should return folder", func() {
				f, _ := service.GetFolderByID(1)
				So(f.Id, ShouldEqual, dashFolder.Id)
				So(f.Uid, ShouldEqual, dashFolder.Uid)
				So(f.Title, ShouldEqual, dashFolder.Title)
			})

			Convey("When get folder by uid should return folder", func() {
				f, _ := service.GetFolderByUID("uid")
				So(f.Id, ShouldEqual, dashFolder.Id)
				So(f.Uid, ShouldEqual, dashFolder.Uid)
				So(f.Title, ShouldEqual, dashFolder.Title)
			})

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("Should map errors correct", func() {
			testCases := []struct {
				ActualError   error
				ExpectedError error
			}{
				{ActualError: models.ErrDashboardTitleEmpty, ExpectedError: models.ErrFolderTitleEmpty},
				{ActualError: models.ErrDashboardUpdateAccessDenied, ExpectedError: models.ErrFolderAccessDenied},
				{ActualError: models.ErrDashboardWithSameNameInFolderExists, ExpectedError: models.ErrFolderSameNameExists},
				{ActualError: models.ErrDashboardWithSameUIDExists, ExpectedError: models.ErrFolderWithSameUIDExists},
				{ActualError: models.ErrDashboardVersionMismatch, ExpectedError: models.ErrFolderVersionMismatch},
				{ActualError: models.ErrDashboardNotFound, ExpectedError: models.ErrFolderNotFound},
				{ActualError: models.ErrDashboardFailedGenerateUniqueUid, ExpectedError: models.ErrFolderFailedGenerateUniqueUid},
				{ActualError: models.ErrDashboardInvalidUid, ExpectedError: models.ErrDashboardInvalidUid},
			}

			for _, tc := range testCases {
				actualError := toFolderError(tc.ActualError)
				assert.EqualErrorf(t, actualError, tc.ExpectedError.Error(),
					"For error '%s' expected error '%s', actual '%s'", tc.ActualError, tc.ExpectedError, actualError)
			}
		})
	})
}
