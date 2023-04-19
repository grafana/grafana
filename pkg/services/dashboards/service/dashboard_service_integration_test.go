package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
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
				cmd := dashboards.SaveDashboardCommand{
					OrgID: testOrgID,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    float64(123412321),
						"title": "Expect error",
					}),
				}

				err := callSaveWithError(t, cmd, sc.sqlStore)
				assert.Equal(t, dashboards.ErrDashboardNotFound, err)
			})

		// Given other organization

		t.Run("Given organization B", func(t *testing.T) {
			const otherOrgId int64 = 2

			permissionScenario(t, "When creating a dashboard with same id as dashboard in organization A",
				true, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: otherOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.ID,
							"title": "Expect error",
						}),
						Overwrite: false,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardNotFound, err)
				})

			permissionScenario(t, "When creating a dashboard with same uid as dashboard in organization A, it should create a new dashboard in org B",
				true, func(t *testing.T, sc *permissionScenarioContext) {
					const otherOrgId int64 = 2
					cmd := dashboards.SaveDashboardCommand{
						OrgID: otherOrgId,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.UID,
							"title": "Dash with existing uid in other org",
						}),
						Overwrite: false,
					}

					res := callSaveWithResult(t, cmd, sc.sqlStore)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						OrgID: otherOrgId,
						UID:   sc.savedDashInFolder.UID,
					})
					require.NoError(t, err)
				})
		})

		t.Run("Given user has no permission to save", func(t *testing.T) {
			const canSave = false

			permissionScenario(t, "When creating a new dashboard in the General folder", canSave,
				func(t *testing.T, sc *permissionScenarioContext) {
					sqlStore := db.InitTestDB(t)
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, "", sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When creating a new dashboard in other folder, it should create dashboard guardian for other folder with correct arguments and rsult in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": "Dash",
						}),
						FolderID:  sc.otherSavedFolder.ID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.otherSavedFolder.ID, sc.dashboardGuardianMock.DashID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When creating a new dashboard by existing title in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"title": sc.savedDashInFolder.Title,
						}),
						FolderID:  sc.savedFolder.ID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When creating a new dashboard by existing UID in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.UID,
							"title": "New dash",
						}),
						FolderID:  sc.savedFolder.ID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When updating a dashboard by existing id in the General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "Dash",
						}),
						FolderID:  sc.savedDashInGeneralFolder.FolderID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When updating a dashboard by existing id in other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.ID,
							"title": "Dash",
						}),
						FolderID:  sc.savedDashInFolder.FolderID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When moving a dashboard by existing ID to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "Dash",
						}),
						FolderID:  sc.otherSavedFolder.ID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When moving a dashboard by existing id to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"id":    sc.savedDashInFolder.ID,
							"title": "Dash",
						}),
						FolderID:  0,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When moving a dashboard by existing uid to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInGeneralFolder.UID,
							"title": "Dash",
						}),
						FolderID:  sc.otherSavedFolder.ID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})

			permissionScenario(t, "When moving a dashboard by existing UID to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]interface{}{
							"uid":   sc.savedDashInFolder.UID,
							"title": "Dash",
						}),
						FolderID:  0,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, sc.dashboardGuardianMock.User.UserID)
				})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			const canSave = true

			t.Run("and overwrite flag is set to false", func(t *testing.T) {
				const shouldOverwrite = false

				permissionScenario(t, "When creating a dashboard in General folder with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderID:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})

						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard in other folder with same name as dashboard in General folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderID:  sc.savedFolder.ID,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.NotEqual(t, sc.savedDashInGeneralFolder.ID, res.ID)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a folder with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.NotEqual(t, sc.savedDashInGeneralFolder.ID, res.ID)
						assert.True(t, res.IsFolder)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard without id and uid and unique title in folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Dash without id and uid",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						assert.Greater(t, res.ID, int64(0))
						assert.NotEmpty(t, res.UID)
						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard when dashboard id is zero ", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    0,
								"title": "Dash with zero id",
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When saving a dashboard in non-existing folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": "Expect error",
							}),
							FolderID:  123412321,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardFolderNotFound, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInGeneralFolder.ID,
								"title": "test dash 23",
							}),
							FolderID:  sc.savedFolder.ID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":      sc.savedDashInGeneralFolder.ID,
								"title":   "Updated title",
								"version": sc.savedDashInGeneralFolder.Version,
							}),
							FolderID:  sc.savedFolder.ID,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    sc.savedDashInGeneralFolder.ID,
							OrgID: cmd.OrgID,
						})

						require.NoError(t, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.UID,
								"title": "test dash 23",
							}),
							FolderID:  0,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":     sc.savedDashInFolder.UID,
								"title":   "Updated title",
								"version": sc.savedDashInFolder.Version,
							}),
							FolderID:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    sc.savedDashInFolder.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderID:  sc.savedDashInFolder.FolderID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderID:  sc.savedDashInGeneralFolder.FolderID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})

				permissionScenario(t, "When creating a folder with same name as existing folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameInFolderExists, err)
					})
			})

			t.Run("and overwrite flag is set to true", func(t *testing.T) {
				const shouldOverwrite = true

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInGeneralFolder.ID,
								"title": "Updated title",
							}),
							FolderID:  sc.savedFolder.ID,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    sc.savedDashInGeneralFolder.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.UID,
								"title": "Updated title",
							}),
							FolderID:  0,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    sc.savedDashInFolder.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating uid for existing dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.ID,
								"uid":   "new-uid",
								"title": sc.savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInFolder.ID, res.ID)
						assert.Equal(t, "new-uid", res.UID)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    sc.savedDashInFolder.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating uid to an existing uid for existing dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.ID,
								"uid":   sc.savedDashInGeneralFolder.UID,
								"title": sc.savedDashInFolder.Title,
							}),
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameUIDExists, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderID:  sc.savedDashInFolder.FolderID,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInFolder.ID, res.ID)
						assert.Equal(t, sc.savedDashInFolder.UID, res.UID)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderID:  sc.savedDashInGeneralFolder.FolderID,
							Overwrite: shouldOverwrite,
						}

						res := callSaveWithResult(t, cmd, sc.sqlStore)
						require.NotNil(t, res)
						assert.Equal(t, sc.savedDashInGeneralFolder.ID, res.ID)
						assert.Equal(t, sc.savedDashInGeneralFolder.UID, res.UID)

						_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
							ID:    res.ID,
							OrgID: cmd.OrgID,
						})
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedFolder.ID,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using id", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"id":    sc.savedDashInFolder.ID,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using uid", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedFolder.UID,
								"title": "new title",
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using uid", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"uid":   sc.savedDashInFolder.UID,
								"title": "new folder title",
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
					})

				permissionScenario(t, "When updating existing folder to a dashboard using title", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardWithSameNameAsFolder, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using title", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]interface{}{
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardFolderWithSameNameAsDashboard, err)
					})
			})
		})
	})
}

type permissionScenarioContext struct {
	dashboardGuardianMock    *guardian.FakeDashboardGuardian
	sqlStore                 db.DB
	dashboardStore           dashboards.Store
	savedFolder              *dashboards.Dashboard
	savedDashInFolder        *dashboards.Dashboard
	otherSavedFolder         *dashboards.Dashboard
	savedDashInGeneralFolder *dashboards.Dashboard
}

type permissionScenarioFunc func(t *testing.T, sc *permissionScenarioContext)

func permissionScenario(t *testing.T, desc string, canSave bool, fn permissionScenarioFunc) {
	t.Helper()

	guardianMock := &guardian.FakeDashboardGuardian{
		CanSaveValue: canSave,
	}

	t.Run(desc, func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		// TODO: is this needed for the testing of RBAC?
		// ac := acimpl.ProvideAccessControl(sqlStore.Cfg)
		ac := actest.FakeAccessControl{ExpectedEvaluate: true}
		dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
		folderPermissions := accesscontrolmock.NewMockedPermissionsService()
		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
		dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
		dashboardService, err := ProvideDashboardServiceImpl(
			cfg, dashboardStore, folderStore, &dummyDashAlertExtractor{},
			featuremgmt.WithFeatures(),
			folderPermissions,
			dashboardPermissions,
			ac,
			foldertest.NewFakeService(),
		)
		require.NoError(t, err)
		guardian.InitAccessControlGuardian(cfg, sqlStore, ac, folderPermissions, dashboardPermissions, dashboardService)

		savedFolder := saveTestFolder(t, "Saved folder", testOrgID, sqlStore)
		savedDashInFolder := saveTestDashboard(t, "Saved dash in folder", testOrgID, savedFolder.ID, sqlStore)
		saveTestDashboard(t, "Other saved dash in folder", testOrgID, savedFolder.ID, sqlStore)
		savedDashInGeneralFolder := saveTestDashboard(t, "Saved dashboard in general folder", testOrgID, 0, sqlStore)
		otherSavedFolder := saveTestFolder(t, "Other saved folder", testOrgID, sqlStore)

		require.Equal(t, "Saved folder", savedFolder.Title)
		require.Equal(t, "saved-folder", savedFolder.Slug)
		require.NotEqual(t, int64(0), savedFolder.ID)
		require.True(t, savedFolder.IsFolder)
		require.Equal(t, int64(0), savedFolder.FolderID)
		require.NotEmpty(t, savedFolder.UID)

		require.Equal(t, "Saved dash in folder", savedDashInFolder.Title)
		require.Equal(t, "saved-dash-in-folder", savedDashInFolder.Slug)
		require.NotEqual(t, int64(0), savedDashInFolder.ID)
		require.False(t, savedDashInFolder.IsFolder)
		require.Equal(t, savedFolder.ID, savedDashInFolder.FolderID)
		require.NotEmpty(t, savedDashInFolder.UID)

		origNewDashboardGuardian := guardian.New
		t.Cleanup(func() {
			guardian.New = origNewDashboardGuardian
		})
		guardian.MockDashboardGuardian(guardianMock)

		sc := &permissionScenarioContext{
			dashboardGuardianMock:    guardianMock,
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

func callSaveWithResult(t *testing.T, cmd dashboards.SaveDashboardCommand, sqlStore db.DB) *dashboards.Dashboard {
	t.Helper()

	dto := toSaveDashboardDto(cmd)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		folderPermissions,
		dashboardPermissions,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		foldertest.NewFakeService(),
	)
	require.NoError(t, err)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

	return res
}

func callSaveWithError(t *testing.T, cmd dashboards.SaveDashboardCommand, sqlStore db.DB) error {
	dto := toSaveDashboardDto(cmd)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		accesscontrolmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{ExpectedEvaluate: true},
		foldertest.NewFakeService(),
	)
	require.NoError(t, err)
	_, err = service.SaveDashboard(context.Background(), &dto, false)
	return err
}

func saveTestDashboard(t *testing.T, title string, orgID, folderID int64, sqlStore db.DB) *dashboards.Dashboard {
	t.Helper()

	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgID,
		FolderID: folderID,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgID:     orgID,
		Dashboard: cmd.GetDashboardModel(),
		User: &user.SignedInUser{
			UserID:  1,
			OrgRole: org.RoleAdmin,
		},
	}
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		dashboardPermissions,
		actest.FakeAccessControl{},
		foldertest.NewFakeService(),
	)
	require.NoError(t, err)
	res, err := service.SaveDashboard(context.Background(), &dto, false)

	require.NoError(t, err)

	return res
}

func saveTestFolder(t *testing.T, title string, orgID int64, sqlStore db.DB) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:    orgID,
		FolderID: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
	}

	dto := dashboards.SaveDashboardDTO{
		OrgID:     orgID,
		Dashboard: cmd.GetDashboardModel(),
		User: &user.SignedInUser{
			OrgID:   orgID,
			UserID:  1,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{
				orgID: {dashboards.ActionFoldersWrite: {dashboards.ScopeFoldersAll}, dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsAll}},
			},
		},
	}

	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, &dummyDashAlertExtractor{},
		featuremgmt.WithFeatures(),
		folderPermissions,
		accesscontrolmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{ExpectedEvaluate: true},
		foldertest.NewFakeService(),
	)
	require.NoError(t, err)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

	return res
}

func toSaveDashboardDto(cmd dashboards.SaveDashboardCommand) dashboards.SaveDashboardDTO {
	dash := (&cmd).GetDashboardModel()

	return dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   cmd.Message,
		OrgID:     cmd.OrgID,
		User:      &user.SignedInUser{UserID: cmd.UserID},
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
