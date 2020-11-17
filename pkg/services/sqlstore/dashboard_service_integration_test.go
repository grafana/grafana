// +build integration

package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestIntegratedDashboardService(t *testing.T) {
	Convey("Dashboard service integration tests", t, func() {
		InitTestDB(t)
		var testOrgId int64 = 1

		Convey("Given saved folders and dashboards in organization A", func() {
			bus.AddHandler("test", func(cmd *models.ValidateDashboardAlertsCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpdateDashboardAlertsCommand) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.GetProvisionedDashboardDataByIdQuery) error {
				cmd.Result = nil
				return nil
			})

			savedFolder := saveTestFolder("Saved folder", testOrgId)
			savedDashInFolder := saveTestDashboard("Saved dash in folder", testOrgId, savedFolder.Id)
			saveTestDashboard("Other saved dash in folder", testOrgId, savedFolder.Id)
			savedDashInGeneralFolder := saveTestDashboard("Saved dashboard in general folder", testOrgId, 0)
			otherSavedFolder := saveTestFolder("Other saved folder", testOrgId)

			Convey("Should return dashboard model", func() {
				So(savedFolder.Title, ShouldEqual, "Saved folder")
				So(savedFolder.Slug, ShouldEqual, "saved-folder")
				So(savedFolder.Id, ShouldNotEqual, 0)
				So(savedFolder.IsFolder, ShouldBeTrue)
				So(savedFolder.FolderId, ShouldEqual, 0)
				So(len(savedFolder.Uid), ShouldBeGreaterThan, 0)

				So(savedDashInFolder.Title, ShouldEqual, "Saved dash in folder")
				So(savedDashInFolder.Slug, ShouldEqual, "saved-dash-in-folder")
				So(savedDashInFolder.Id, ShouldNotEqual, 0)
				So(savedDashInFolder.IsFolder, ShouldBeFalse)
				So(savedDashInFolder.FolderId, ShouldEqual, savedFolder.Id)
				So(len(savedDashInFolder.Uid), ShouldBeGreaterThan, 0)
			})

			// Basic validation tests

			Convey("When saving a dashboard with non-existing id", func() {
				cmd := models.SaveDashboardCommand{
					OrgId: testOrgId,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    float64(123412321),
						"title": "Expect error",
					}),
				}

				err := callSaveWithError(cmd)

				Convey("It should result in not found error", func() {
					So(err, ShouldNotBeNil)
					So(err, ShouldEqual, models.ErrDashboardNotFound)
				})
			})

			// Given other organization

			Convey("Given organization B", func() {
				var otherOrgId int64 = 2

				Convey("When creating a dashboard with same id as dashboard in organization A", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: otherOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    savedDashInFolder.Id,
							"title": "Expect error",
						}),
						Overwrite: false,
					}

					err := callSaveWithError(cmd)

					Convey("It should result in not found error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardNotFound)
					})
				})

				permissionScenario("Given user has permission to save", true, func(sc *dashboardPermissionScenarioContext) {
					Convey("When creating a dashboard with same uid as dashboard in organization A", func() {
						var otherOrgId int64 = 2
						cmd := models.SaveDashboardCommand{
							OrgId: otherOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   savedDashInFolder.Uid,
								"title": "Dash with existing uid in other org",
							}),
							Overwrite: false,
						}

						res := callSaveWithResult(cmd)

						Convey("It should create a new dashboard in organization B", func() {
							So(res, ShouldNotBeNil)

							query := models.GetDashboardQuery{OrgId: otherOrgId, Uid: savedDashInFolder.Uid}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldNotEqual, savedDashInFolder.Id)
							So(query.Result.Id, ShouldEqual, res.Id)
							So(query.Result.OrgId, ShouldEqual, otherOrgId)
							So(query.Result.Uid, ShouldEqual, savedDashInFolder.Uid)
						})
					})
				})
			})

			// Given user has no permission to save

			permissionScenario("Given user has no permission to save", false, func(sc *dashboardPermissionScenarioContext) {
				Convey("When creating a new dashboard in the General folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for General Folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, 0)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When creating a new dashboard in other folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						FolderId:  otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for other folder with correct arguments and rsult in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, otherSavedFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When creating a new dashboard by existing title in folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": savedDashInFolder.Title,
						}),
						FolderId:  savedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, savedFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When creating a new dashboard by existing uid in folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   savedDashInFolder.Uid,
							"title": "New dash",
						}),
						FolderId:  savedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, savedFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When updating a dashboard by existing id in the General folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    savedDashInGeneralFolder.Id,
							"title": "Dash",
						}),
						FolderId:  savedDashInGeneralFolder.FolderId,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for dashboard with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, savedDashInGeneralFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When updating a dashboard by existing id in other folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    savedDashInFolder.Id,
							"title": "Dash",
						}),
						FolderId:  savedDashInFolder.FolderId,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for dashboard with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, savedDashInFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When moving a dashboard by existing id to other folder from General folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    savedDashInGeneralFolder.Id,
							"title": "Dash",
						}),
						FolderId:  otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for other folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, otherSavedFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When moving a dashboard by existing id to the General folder from other folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    savedDashInFolder.Id,
							"title": "Dash",
						}),
						FolderId:  0,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for General folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, 0)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When moving a dashboard by existing uid to other folder from General folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   savedDashInGeneralFolder.Uid,
							"title": "Dash",
						}),
						FolderId:  otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for other folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, otherSavedFolder.Id)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})

				Convey("When moving a dashboard by existing uid to the General folder from other folder", func() {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   savedDashInFolder.Uid,
							"title": "Dash",
						}),
						FolderId:  0,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd)

					Convey("It should create dashboard guardian for General folder with correct arguments and result in access denied error", func() {
						So(err, ShouldNotBeNil)
						So(err, ShouldEqual, models.ErrDashboardUpdateAccessDenied)

						So(sc.dashboardGuardianMock.DashId, ShouldEqual, 0)
						So(sc.dashboardGuardianMock.OrgId, ShouldEqual, cmd.OrgId)
						So(sc.dashboardGuardianMock.User.UserId, ShouldEqual, cmd.UserId)
					})
				})
			})

			// Given user has permission to save

			permissionScenario("Given user has permission to save", true, func(sc *dashboardPermissionScenarioContext) {
				Convey("and overwrite flag is set to false", func() {
					shouldOverwrite := false

					Convey("When creating a dashboard in General folder with same name as dashboard in other folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInFolder.Title,
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should create a new dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldEqual, res.Id)
							So(query.Result.FolderId, ShouldEqual, 0)
						})
					})

					Convey("When creating a dashboard in other folder with same name as dashboard in General folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInGeneralFolder.Title,
							}),
							FolderId:  savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should create a new dashboard", func() {
							So(res.Id, ShouldNotEqual, savedDashInGeneralFolder.Id)

							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.FolderId, ShouldEqual, savedFolder.Id)
						})
					})

					Convey("When creating a folder with same name as dashboard in other folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should create a new folder", func() {
							So(res.Id, ShouldNotEqual, savedDashInGeneralFolder.Id)
							So(res.IsFolder, ShouldBeTrue)

							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.FolderId, ShouldEqual, 0)
							So(query.Result.IsFolder, ShouldBeTrue)
						})
					})

					Convey("When saving a dashboard without id and uid and unique title in folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Dash without id and uid",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should create a new dashboard", func() {
							So(res.Id, ShouldBeGreaterThan, 0)
							So(len(res.Uid), ShouldBeGreaterThan, 0)
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldEqual, res.Id)
							So(query.Result.Uid, ShouldEqual, res.Uid)
						})
					})

					Convey("When saving a dashboard when dashboard id is zero ", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    0,
								"title": "Dash with zero id",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should create a new dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldEqual, res.Id)
						})
					})

					Convey("When saving a dashboard in non-existing folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Expect error",
							}),
							FolderId:  123412321,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in folder not found error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardFolderNotFound)
						})
					})

					Convey("When updating an existing dashboard by id without current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedDashInGeneralFolder.Id,
								"title": "test dash 23",
							}),
							FolderId:  savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in version mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardVersionMismatch)
						})
					})

					Convey("When updating an existing dashboard by id with current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":      savedDashInGeneralFolder.Id,
								"title":   "Updated title",
								"version": savedDashInGeneralFolder.Version,
							}),
							FolderId:  savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should update dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: savedDashInGeneralFolder.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Title, ShouldEqual, "Updated title")
							So(query.Result.FolderId, ShouldEqual, savedFolder.Id)
							So(query.Result.Version, ShouldBeGreaterThan, savedDashInGeneralFolder.Version)
						})
					})

					Convey("When updating an existing dashboard by uid without current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   savedDashInFolder.Uid,
								"title": "test dash 23",
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in version mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardVersionMismatch)
						})
					})

					Convey("When updating an existing dashboard by uid with current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":     savedDashInFolder.Uid,
								"title":   "Updated title",
								"version": savedDashInFolder.Version,
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should update dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: savedDashInFolder.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Title, ShouldEqual, "Updated title")
							So(query.Result.FolderId, ShouldEqual, 0)
							So(query.Result.Version, ShouldBeGreaterThan, savedDashInFolder.Version)
						})
					})

					Convey("When creating a dashboard with same name as dashboard in other folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInFolder.Title,
							}),
							FolderId:  savedDashInFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in dashboard with same name in folder error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardWithSameNameInFolderExists)
						})
					})

					Convey("When creating a dashboard with same name as dashboard in General folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInGeneralFolder.Title,
							}),
							FolderId:  savedDashInGeneralFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in dashboard with same name in folder error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardWithSameNameInFolderExists)
						})
					})

					Convey("When creating a folder with same name as existing folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in dashboard with same name in folder error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardWithSameNameInFolderExists)
						})
					})
				})

				Convey("and overwrite flag is set to true", func() {
					shouldOverwrite := true

					Convey("When updating an existing dashboard by id without current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedDashInGeneralFolder.Id,
								"title": "Updated title",
							}),
							FolderId:  savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should update dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: savedDashInGeneralFolder.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Title, ShouldEqual, "Updated title")
							So(query.Result.FolderId, ShouldEqual, savedFolder.Id)
							So(query.Result.Version, ShouldBeGreaterThan, savedDashInGeneralFolder.Version)
						})
					})

					Convey("When updating an existing dashboard by uid without current version", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   savedDashInFolder.Uid,
								"title": "Updated title",
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)
						So(res, ShouldNotBeNil)

						Convey("It should update dashboard", func() {
							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: savedDashInFolder.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Title, ShouldEqual, "Updated title")
							So(query.Result.FolderId, ShouldEqual, 0)
							So(query.Result.Version, ShouldBeGreaterThan, savedDashInFolder.Version)
						})
					})

					Convey("When updating uid for existing dashboard using id", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedDashInFolder.Id,
								"uid":   "new-uid",
								"title": savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)

						Convey("It should update dashboard", func() {
							So(res, ShouldNotBeNil)
							So(res.Id, ShouldEqual, savedDashInFolder.Id)
							So(res.Uid, ShouldEqual, "new-uid")

							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: savedDashInFolder.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Uid, ShouldEqual, "new-uid")
							So(query.Result.Version, ShouldBeGreaterThan, savedDashInFolder.Version)
						})
					})

					Convey("When updating uid to an existing uid for existing dashboard using id", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedDashInFolder.Id,
								"uid":   savedDashInGeneralFolder.Uid,
								"title": savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in same uid exists error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardWithSameUIDExists)
						})
					})

					Convey("When creating a dashboard with same name as dashboard in other folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInFolder.Title,
							}),
							FolderId:  savedDashInFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)

						Convey("It should overwrite existing dashboard", func() {
							So(res, ShouldNotBeNil)
							So(res.Id, ShouldEqual, savedDashInFolder.Id)
							So(res.Uid, ShouldEqual, savedDashInFolder.Uid)

							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldEqual, res.Id)
							So(query.Result.Uid, ShouldEqual, res.Uid)
						})
					})

					Convey("When creating a dashboard with same name as dashboard in General folder", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgId,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": savedDashInGeneralFolder.Title,
							}),
							FolderId:  savedDashInGeneralFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(cmd)

						Convey("It should overwrite existing dashboard", func() {
							So(res, ShouldNotBeNil)
							So(res.Id, ShouldEqual, savedDashInGeneralFolder.Id)
							So(res.Uid, ShouldEqual, savedDashInGeneralFolder.Uid)

							query := models.GetDashboardQuery{OrgId: cmd.OrgId, Id: res.Id}

							err := bus.Dispatch(&query)
							So(err, ShouldBeNil)
							So(query.Result.Id, ShouldEqual, res.Id)
							So(query.Result.Uid, ShouldEqual, res.Uid)
						})
					})

					Convey("When updating existing folder to a dashboard using id", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedFolder.Id,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in type mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardTypeMismatch)
						})
					})

					Convey("When updating existing dashboard to a folder using id", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    savedDashInFolder.Id,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in type mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardTypeMismatch)
						})
					})

					Convey("When updating existing folder to a dashboard using uid", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   savedFolder.Uid,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in type mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardTypeMismatch)
						})
					})

					Convey("When updating existing dashboard to a folder using uid", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   savedDashInFolder.Uid,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in type mismatch error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardTypeMismatch)
						})
					})

					Convey("When updating existing folder to a dashboard using title", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": savedFolder.Title,
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in dashboard with same name as folder error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardWithSameNameAsFolder)
						})
					})

					Convey("When updating existing dashboard to a folder using title", func() {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": savedDashInGeneralFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd)

						Convey("It should result in folder with same name as dashboard error", func() {
							So(err, ShouldNotBeNil)
							So(err, ShouldEqual, models.ErrDashboardFolderWithSameNameAsDashboard)
						})
					})
				})
			})
		})
	})
}

type dashboardPermissionScenarioContext struct {
	dashboardGuardianMock *guardian.FakeDashboardGuardian
}

type dashboardPermissionScenarioFunc func(sc *dashboardPermissionScenarioContext)

func dashboardPermissionScenario(desc string, mock *guardian.FakeDashboardGuardian, fn dashboardPermissionScenarioFunc) {
	Convey(desc, func() {
		origNewDashboardGuardian := guardian.New
		guardian.MockDashboardGuardian(mock)

		sc := &dashboardPermissionScenarioContext{
			dashboardGuardianMock: mock,
		}

		defer func() {
			guardian.New = origNewDashboardGuardian
		}()

		fn(sc)
	})
}

func permissionScenario(desc string, canSave bool, fn dashboardPermissionScenarioFunc) {
	mock := &guardian.FakeDashboardGuardian{
		CanSaveValue: canSave,
	}
	dashboardPermissionScenario(desc, mock, fn)
}

func callSaveWithResult(cmd models.SaveDashboardCommand) *models.Dashboard {
	dto := toSaveDashboardDto(cmd)
	res, _ := dashboards.NewService().SaveDashboard(&dto, false)
	return res
}

func callSaveWithError(cmd models.SaveDashboardCommand) error {
	dto := toSaveDashboardDto(cmd)
	_, err := dashboards.NewService().SaveDashboard(&dto, false)
	return err
}

func saveTestDashboard(title string, orgId int64, folderId int64) *models.Dashboard {
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgId:     orgId,
		Dashboard: cmd.GetDashboardModel(),
		User: &models.SignedInUser{
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
		},
	}

	res, err := dashboards.NewService().SaveDashboard(&dto, false)
	So(err, ShouldBeNil)

	return res
}

func saveTestFolder(title string, orgId int64) *models.Dashboard {
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgId:     orgId,
		Dashboard: cmd.GetDashboardModel(),
		User: &models.SignedInUser{
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
		},
	}

	res, err := dashboards.NewService().SaveDashboard(&dto, false)
	So(err, ShouldBeNil)

	return res
}

func toSaveDashboardDto(cmd models.SaveDashboardCommand) dashboards.SaveDashboardDTO {
	dash := (&cmd).GetDashboardModel()

	return dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   cmd.Message,
		OrgId:     cmd.OrgId,
		User:      &models.SignedInUser{UserId: cmd.UserId},
		Overwrite: cmd.Overwrite,
	}
}
