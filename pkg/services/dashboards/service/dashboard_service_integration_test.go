package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const testOrgID int64 = 1

func TestIntegrationIntegratedDashboardService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Given saved folders and dashboards in organization A", func(t *testing.T) {
		// Basic validation tests

		permissionScenario(t, "When saving a dashboard with non-existing id", true,
			func(t *testing.T, sc *permissionScenarioContext) {
				cmd := models.SaveDashboardCommand{
					OrgId: testOrgID,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    float64(123412321),
						"title": "Expect error",
					}),
				}

				err := callSaveWithError(cmd, sc.sqlStore)
				assert.Equal(t, dashboards.ErrDashboardNotFound, err)
			})

		// Given other organization

		t.Run("Given organization B", func(t *testing.T) {
			const otherOrgId int64 = 2

			permissionScenario(t, "When creating a dashboard with same id as dashboard in organization A",
				true, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: otherOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.Id,
							"title": "Expect error",
						}),
						Overwrite: false,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardNotFound, err)
				})

			permissionScenario(t, "When creating a dashboard with same uid as dashboard in organization A, it should create a new dashboard in org B",
				true, func(t *testing.T, sc *permissionScenarioContext) {
					const otherOrgId int64 = 2
					cmd := models.SaveDashboardCommand{
						OrgId: otherOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.Uid,
							"title": "Dash with existing uid in other org",
						}),
						Overwrite: false,
					}

					res := callSaveWithResult(t, cmd, sc.sqlStore)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
						OrgId: otherOrgId,
						Uid:   sc.savedDashInFolder.Uid,
					})
					require.NoError(t, err)
				})
		})

		t.Run("Given user has no permission to save", func(t *testing.T) {
			const canSave = false

			permissionScenario(t, "When creating a new dashboard in the General folder", canSave,
				func(t *testing.T, sc *permissionScenarioContext) {
					sqlStore := sqlstore.InitTestDB(t)
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, int64(0), sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When creating a new dashboard in other folder, it should create dashboard guardian for other folder with correct arguments and rsult in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						FolderId:  sc.otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.otherSavedFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When creating a new dashboard by existing title in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": sc.savedDashInFolder.Title,
						}),
						FolderId:  sc.savedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When creating a new dashboard by existing UID in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.Uid,
							"title": "New dash",
						}),
						FolderId:  sc.savedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When updating a dashboard by existing id in the General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInGeneralFolder.Id,
							"title": "Dash",
						}),
						FolderId:  sc.savedDashInGeneralFolder.FolderId,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When updating a dashboard by existing id in other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.Id,
							"title": "Dash",
						}),
						FolderId:  sc.savedDashInFolder.FolderId,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When moving a dashboard by existing ID to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInGeneralFolder.Id,
							"title": "Dash",
						}),
						FolderId:  sc.otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When moving a dashboard by existing id to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.Id,
							"title": "Dash",
						}),
						FolderId:  0,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When moving a dashboard by existing uid to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInGeneralFolder.Uid,
							"title": "Dash",
						}),
						FolderId:  sc.otherSavedFolder.Id,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})

			permissionScenario(t, "When moving a dashboard by existing UID to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := models.SaveDashboardCommand{
						OrgId: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.Uid,
							"title": "Dash",
						}),
						FolderId:  0,
						UserId:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.Id, sc.dashboardGuardianMock.DashId)
					assert.Equal(t, cmd.OrgId, sc.dashboardGuardianMock.OrgId)
					assert.Equal(t, cmd.UserId, sc.dashboardGuardianMock.User.UserId)
				})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			const canSave = true

			t.Run("and overwrite flag is set to false", func(t *testing.T) {
				const shouldOverwrite = false

				permissionScenario(t, "When creating a dashboard in General folder with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})

						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard in other folder with same name as dashboard in General folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderId:  sc.savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.NotEqual(t, sc.savedDashInGeneralFolder.Id, res.Id)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a folder with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.NotEqual(t, sc.savedDashInGeneralFolder.Id, res.Id)
						assert.True(t, res.IsFolder)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard without id and uid and unique title in folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Dash without id and uid",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.Greater(t, res.Id, int64(0))
						assert.NotEmpty(t, res.Uid)
						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard when dashboard id is zero ", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    0,
								"title": "Dash with zero id",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard in non-existing folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Expect error",
							}),
							FolderId:  123412321,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardFolderNotFound, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInGeneralFolder.Id,
								"title": "test dash 23",
							}),
							FolderId:  sc.savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":      sc.savedDashInGeneralFolder.Id,
								"title":   "Updated title",
								"version": sc.savedDashInGeneralFolder.Version,
							}),
							FolderId:  sc.savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    sc.savedDashInGeneralFolder.Id,
							OrgId: cmd.OrgId,
						})

						require.NoError(t, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.Uid,
								"title": "test dash 23",
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":     sc.savedDashInFolder.Uid,
								"title":   "Updated title",
								"version": sc.savedDashInFolder.Version,
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    sc.savedDashInFolder.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderId:  sc.savedDashInFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderId:  sc.savedDashInGeneralFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})

				permissionScenario(t, "When creating a folder with same name as existing folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})
			})

			t.Run("and overwrite flag is set to true", func(t *testing.T) {
				const shouldOverwrite = true

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInGeneralFolder.Id,
								"title": "Updated title",
							}),
							FolderId:  sc.savedFolder.Id,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    sc.savedDashInGeneralFolder.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.Uid,
								"title": "Updated title",
							}),
							FolderId:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    sc.savedDashInFolder.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating uid for existing dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.Id,
								"uid":   "new-uid",
								"title": sc.savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInFolder.Id, res.Id)
						assert.Equal(t, "new-uid", res.Uid)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    sc.savedDashInFolder.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating uid to an existing uid for existing dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.Id,
								"uid":   sc.savedDashInGeneralFolder.Uid,
								"title": sc.savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameUIDExists, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderId:  sc.savedDashInFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInFolder.Id, res.Id)
						assert.Equal(t, sc.savedDashInFolder.Uid, res.Uid)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderId:  sc.savedDashInGeneralFolder.FolderId,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInGeneralFolder.Id, res.Id)
						assert.Equal(t, sc.savedDashInGeneralFolder.Uid, res.Uid)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &models.GetDashboardQuery{
							Id:    res.Id,
							OrgId: cmd.OrgId,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedFolder.Id,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.Id,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using uid", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedFolder.Uid,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using uid", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.Uid,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using title", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameAsFolder, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using title", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := models.SaveDashboardCommand{
							OrgId: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardFolderWithSameNameAsDashboard, err)
					})
			})
		})
	})
}

type permissionScenarioContext struct {
	dashboardGuardianMock    *guardian.FakeDashboardGuardian
	sqlStore                 *sqlstore.SQLStore
	dashboardStore           dashboards.Store
	savedFolder              *models.Dashboard
	savedDashInFolder        *models.Dashboard
	otherSavedFolder         *models.Dashboard
	savedDashInGeneralFolder *models.Dashboard
}

type permissionScenarioFunc func(t *testing.T, sc *permissionScenarioContext)

func permissionScenario(t *testing.T, desc string, canSave bool, fn permissionScenarioFunc) {
	t.Helper()

	mock := &guardian.FakeDashboardGuardian{
		CanSaveValue: canSave,
	}

	t.Run(desc, func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)
		service := ProvideDashboardService(
			&setting.Cfg{}, dashboardStore, &dummyDashAlertExtractor{},
			featuremgmt.WithFeatures(),
			accesscontrolmock.NewMockedPermissionsService(),
			accesscontrolmock.NewMockedPermissionsService(),
			accesscontrolmock.New(),
		)
		guardian.InitLegacyGuardian(sqlStore, service)

		savedFolder := saveTestFolder(t, "Saved folder", testOrgID, sqlStore)
		savedDashInFolder := saveTestDashboard(t, "Saved dash in folder", testOrgID, savedFolder.Id, sqlStore)
		saveTestDashboard(t, "Other saved dash in folder", testOrgID, savedFolder.Id, sqlStore)
		savedDashInGeneralFolder := saveTestDashboard(t, "Saved dashboard in general folder", testOrgID, 0, sqlStore)
		otherSavedFolder := saveTestFolder(t, "Other saved folder", testOrgID, sqlStore)

		require.Equal(t, "Saved folder", savedFolder.Title)
		require.Equal(t, "saved-folder", savedFolder.Slug)
		require.NotEqual(t, int64(0), savedFolder.Id)
		require.True(t, savedFolder.IsFolder)
		require.Equal(t, int64(0), savedFolder.FolderId)
		require.NotEmpty(t, savedFolder.Uid)

		require.Equal(t, "Saved dash in folder", savedDashInFolder.Title)
		require.Equal(t, "saved-dash-in-folder", savedDashInFolder.Slug)
		require.NotEqual(t, int64(0), savedDashInFolder.Id)
		require.False(t, savedDashInFolder.IsFolder)
		require.Equal(t, savedFolder.Id, savedDashInFolder.FolderId)
		require.NotEmpty(t, savedDashInFolder.Uid)

		origNewDashboardGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewDashboardGuardian
		})
		guardian.MockDashboardGuardian(mock)

		sc := &permissionScenarioContext{
			dashboardGuardianMock:    mock,
			sqlStore:                 sqlStore,
			savedDashInFolder:        savedDashInFolder,
			otherSavedFolder:         otherSavedFolder,
			savedDashInGeneralFolder: savedDashInGeneralFolder,
			savedFolder:              savedFolder,
			dashboardStore:           dashboardStore,
		}

		fn(t, sc)
	})
}

func callSaveWithResult(t *testing.T, cmd models.SaveDashboardCommand, sqlStore *sqlstore.SQLStore) *models.Dashboard {
	t.Helper()

	dto := toSaveDashboardDto(cmd)
	dashboardStore := database.ProvideDashboardStore(sqlStore)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	service := ProvideDashboardService(
		cfg, dashboardStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.New(),
	)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

	return res
}

func callSaveWithError(cmd models.SaveDashboardCommand, sqlStore *sqlstore.SQLStore) error {
	dto := toSaveDashboardDto(cmd)
	dashboardStore := database.ProvideDashboardStore(sqlStore)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	service := ProvideDashboardService(
		cfg, dashboardStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.New(),
	)
	_, err := service.SaveDashboard(context.Background(), &dto, false)
	return err
}

func saveTestDashboard(t *testing.T, title string, orgID, folderID int64, sqlStore *sqlstore.SQLStore) *models.Dashboard {
	t.Helper()

	cmd := models.SaveDashboardCommand{
		OrgId:    orgID,
		FolderId: folderID,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgId:     orgID,
		Dashboard: cmd.GetDashboardModel(),
		User: &models.SignedInUser{
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
		},
	}

	dashboardStore := database.ProvideDashboardStore(sqlStore)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	service := ProvideDashboardService(
		cfg, dashboardStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.New(),
	)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

	return res
}

func saveTestFolder(t *testing.T, title string, orgID int64, sqlStore *sqlstore.SQLStore) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgID,
		FolderId: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgId:     orgID,
		Dashboard: cmd.GetDashboardModel(),
		User: &models.SignedInUser{
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
		},
	}

	dashboardStore := database.ProvideDashboardStore(sqlStore)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	service := ProvideDashboardService(
		cfg, dashboardStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.New(),
	)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

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

type dummyDashAlertExtractor struct {
}

func (d *dummyDashAlertExtractor) GetAlerts(ctx context.Context, dashAlertInfo alerting.DashAlertInfo) ([]*models.Alert, error) {
	return nil, nil
}

func (d *dummyDashAlertExtractor) ValidateAlerts(ctx context.Context, dashAlertInfo alerting.DashAlertInfo) error {
	return nil
}
