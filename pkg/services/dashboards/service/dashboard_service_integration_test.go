package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const testOrgID int64 = 1

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

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
					Dashboard: simplejson.NewFromAny(map[string]any{
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
						Dashboard: simplejson.NewFromAny(map[string]any{
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
						Dashboard: simplejson.NewFromAny(map[string]any{
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
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": "Dash",
						}),
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, "", sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When creating a new dashboard in other folder, it should create dashboard guardian for other folder with correct arguments and rsult in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": "Dash",
						}),
						FolderUID: sc.otherSavedFolder.UID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.otherSavedFolder.ID, sc.dashboardGuardianMock.DashID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When creating a new dashboard by existing title in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					t.Skip()

					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": sc.savedDashInFolder.Title,
						}),
						FolderUID: sc.savedFolder.UID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When creating a new dashboard by existing UID in folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInFolder.UID,
							"title": "New dash",
						}),
						FolderUID: sc.savedFolder.UID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When updating a dashboard by existing id in the General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "Dash",
						}),
						FolderUID: sc.savedDashInGeneralFolder.FolderUID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When updating a dashboard by existing id in other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInFolder.ID,
							"title": "Dash",
						}),
						FolderUID: sc.savedDashInFolder.FolderUID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When moving a dashboard by existing ID to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "Dash",
						}),
						FolderUID: sc.otherSavedFolder.UID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When moving a dashboard by existing id to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInFolder.ID,
							"title": "Dash",
						}),
						FolderUID: "",
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When moving a dashboard by existing uid to other folder from General folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInGeneralFolder.UID,
							"title": "Dash",
						}),
						FolderUID: sc.otherSavedFolder.UID,
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInGeneralFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
				})

			permissionScenario(t, "When moving a dashboard by existing UID to the General folder from other folder, it should create dashboard guardian for dashboard with correct arguments and result in access denied error",
				canSave, func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInFolder.UID,
							"title": "Dash",
						}),
						FolderUID: "",
						UserID:    10000,
						Overwrite: true,
					}

					err := callSaveWithError(t, cmd, sc.sqlStore)
					require.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

					userID, err := identity.IntIdentifier(sc.dashboardGuardianMock.User.GetID())
					require.NoError(t, err)

					assert.Equal(t, sc.savedDashInFolder.UID, sc.dashboardGuardianMock.DashUID)
					assert.Equal(t, cmd.OrgID, sc.dashboardGuardianMock.OrgID)
					assert.Equal(t, cmd.UserID, userID)
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderUID: "",
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderUID: sc.savedFolder.UID,
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"title": "Expect error",
							}),
							FolderUID: "123412321",
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrFolderNotFound, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    sc.savedDashInGeneralFolder.ID,
								"title": "test dash 23",
							}),
							FolderUID: sc.savedFolder.UID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by id with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":      sc.savedDashInGeneralFolder.ID,
								"title":   "Updated title",
								"version": sc.savedDashInGeneralFolder.Version,
							}),
							FolderUID: sc.savedFolder.UID,
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"uid":   sc.savedDashInFolder.UID,
								"title": "test dash 23",
							}),
							FolderUID: "",
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
					})

				permissionScenario(t, "When updating an existing dashboard by uid with current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"uid":     sc.savedDashInFolder.UID,
								"title":   "Updated title",
								"version": sc.savedDashInFolder.Version,
							}),
							FolderUID: "",
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderUID: sc.savedDashInFolder.FolderUID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder",
					canSave, func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderUID: sc.savedDashInGeneralFolder.FolderUID,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						require.NoError(t, err)
					})

				permissionScenario(t, "When creating a folder with same name as existing folder", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						require.NoError(t, err)
					})
			})

			t.Run("and overwrite flag is set to true", func(t *testing.T) {
				const shouldOverwrite = true

				permissionScenario(t, "When updating an existing dashboard by id without current version", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    sc.savedDashInGeneralFolder.ID,
								"title": "Updated title",
							}),
							FolderUID: sc.savedFolder.UID,
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"uid":   sc.savedDashInFolder.UID,
								"title": "Updated title",
							}),
							FolderUID: "",
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
						t.Skip()

						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInFolder.Title,
							}),
							FolderUID: sc.savedDashInFolder.FolderUID,
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
						t.Skip()

						cmd := dashboards.SaveDashboardCommand{
							OrgID: testOrgID,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"id":    nil,
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							FolderUID: sc.savedDashInGeneralFolder.FolderUID,
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
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
							Dashboard: simplejson.NewFromAny(map[string]any{
								"title": sc.savedFolder.Title,
							}),
							IsFolder:  false,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						require.NoError(t, err)
					})

				permissionScenario(t, "When updating existing dashboard to a folder using title", canSave,
					func(t *testing.T, sc *permissionScenarioContext) {
						cmd := dashboards.SaveDashboardCommand{
							OrgID: 1,
							Dashboard: simplejson.NewFromAny(map[string]any{
								"title": sc.savedDashInGeneralFolder.Title,
							}),
							IsFolder:  true,
							Overwrite: shouldOverwrite,
						}

						err := callSaveWithError(t, cmd, sc.sqlStore)
						require.NoError(t, err)
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
		CanViewValue: true,
	}

	t.Run(desc, func(t *testing.T) {
		features := featuremgmt.WithFeatures()
		cfg := setting.NewCfg()
		sqlStore := db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)
		ac := actest.FakeAccessControl{ExpectedEvaluate: true}
		dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
		folderPermissions := accesscontrolmock.NewMockedPermissionsService()
		folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
		tracer := tracing.InitializeTracerForTest()
		publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
		folderStore2 := folderimpl.ProvideStore(sqlStore)
		folderService := folderimpl.ProvideService(
			folderStore2,
			actest.FakeAccessControl{ExpectedEvaluate: true},
			bus.ProvideBus(tracer),
			dashboardStore,
			folderStore,
			nil,
			sqlStore,
			features,
			supportbundlestest.NewFakeBundleService(),
			publicDashboardFakeService,
			cfg,
			nil,
			tracer,
			nil,
			dualwrite.ProvideTestService(),
			sort.ProvideService(),
		)
		dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
		dashboardService, err := ProvideDashboardServiceImpl(
			cfg, dashboardStore, folderStore,
			featuremgmt.WithFeatures(),
			folderPermissions,
			ac,
			folderService,
			folder.NewFakeStore(),
			nil,
			client.MockTestRestConfig{},
			nil,
			quotaService,
			nil,
			nil,
			nil,
			dualwrite.ProvideTestService(),
			sort.ProvideService(),
		)
		dashboardService.RegisterDashboardPermissions(dashboardPermissions)
		require.NoError(t, err)
		guardian.InitAccessControlGuardian(cfg, ac, dashboardService, folderService, log.NewNopLogger())

		savedFolder := saveTestFolder(t, "Saved folder", testOrgID, sqlStore)
		savedDashInFolder := saveTestDashboard(t, "Saved dash in folder", testOrgID, savedFolder.UID, sqlStore)
		saveTestDashboard(t, "Other saved dash in folder", testOrgID, savedFolder.UID, sqlStore)
		savedDashInGeneralFolder := saveTestDashboard(t, "Saved dashboard in general folder", testOrgID, "", sqlStore)
		otherSavedFolder := saveTestFolder(t, "Other saved folder", testOrgID, sqlStore)

		require.Equal(t, "Saved folder", savedFolder.Title)
		require.Equal(t, "saved-folder", savedFolder.Slug)
		require.NotEqual(t, int64(0), savedFolder.ID)
		require.True(t, savedFolder.IsFolder)
		require.NotEmpty(t, savedFolder.UID)

		require.Equal(t, "Saved dash in folder", savedDashInFolder.Title)
		require.Equal(t, "saved-dash-in-folder", savedDashInFolder.Slug)
		require.NotEqual(t, int64(0), savedDashInFolder.ID)
		require.False(t, savedDashInFolder.IsFolder)
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

	features := featuremgmt.WithFeatures()
	dto := toSaveDashboardDto(cmd)
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	tracer := tracing.InitializeTracerForTest()
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	folderStore2 := folderimpl.ProvideStore(sqlStore)
	folderService := folderimpl.ProvideService(
		folderStore2,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		bus.ProvideBus(tracer),
		dashboardStore,
		folderStore,
		nil,
		sqlStore,
		features,
		supportbundlestest.NewFakeBundleService(),
		publicDashboardFakeService,
		cfg,
		nil,
		tracer,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions",
		mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		featuremgmt.WithFeatures(),
		folderPermissions,
		actest.FakeAccessControl{},
		folderService,
		folder.NewFakeStore(),
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	require.NoError(t, err)
	service.RegisterDashboardPermissions(dashboardPermissions)
	res, err := service.SaveDashboard(context.Background(), &dto, false)
	require.NoError(t, err)

	return res
}

func callSaveWithError(t *testing.T, cmd dashboards.SaveDashboardCommand, sqlStore db.DB) error {
	features := featuremgmt.WithFeatures()
	dto := toSaveDashboardDto(cmd)
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	tracer := tracing.InitializeTracerForTest()
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	folderStore2 := folderimpl.ProvideStore(sqlStore)
	folderService := folderimpl.ProvideService(folderStore2,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		bus.ProvideBus(tracer),
		dashboardStore,
		folderStore,
		nil,
		sqlStore,
		features,
		supportbundlestest.NewFakeBundleService(),
		publicDashboardFakeService,
		cfg,
		nil,
		tracer,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		featuremgmt.WithFeatures(),
		accesscontrolmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{},
		folderService,
		folder.NewFakeStore(),
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	require.NoError(t, err)
	service.RegisterDashboardPermissions(accesscontrolmock.NewMockedPermissionsService())
	_, err = service.SaveDashboard(context.Background(), &dto, false)
	return err
}

func saveTestDashboard(t *testing.T, title string, orgID int64, folderUID string, sqlStore db.DB) *dashboards.Dashboard {
	t.Helper()

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: folderUID,
		IsFolder:  false,
		Dashboard: simplejson.NewFromAny(map[string]any{
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
	features := featuremgmt.WithFeatures()
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	tracer := tracing.InitializeTracerForTest()
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	folderStore2 := folderimpl.ProvideStore(sqlStore)
	folderService := folderimpl.ProvideService(folderStore2,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		bus.ProvideBus(tracer),
		dashboardStore,
		folderStore,
		nil,
		sqlStore,
		features,
		supportbundlestest.NewFakeBundleService(),
		publicDashboardFakeService,
		cfg,
		nil,
		tracer,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		features,
		accesscontrolmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{},
		folderService,
		folder.NewFakeStore(),
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	require.NoError(t, err)
	service.RegisterDashboardPermissions(dashboardPermissions)
	res, err := service.SaveDashboard(context.Background(), &dto, false)

	require.NoError(t, err)

	return res
}

func saveTestFolder(t *testing.T, title string, orgID int64, sqlStore db.DB) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: "",
		IsFolder:  true,
		Dashboard: simplejson.NewFromAny(map[string]any{
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

	features := featuremgmt.WithFeatures()
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	folderPermissions := accesscontrolmock.NewMockedPermissionsService()
	tracer := tracing.InitializeTracerForTest()
	publicDashboardFakeService := publicdashboards.NewFakePublicDashboardServiceWrapper(t)
	folderStore2 := folderimpl.ProvideStore(sqlStore)
	folderService := folderimpl.ProvideService(folderStore2,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		bus.ProvideBus(tracer),
		dashboardStore,
		folderStore,
		nil,
		sqlStore,
		features,
		supportbundlestest.NewFakeBundleService(),
		publicDashboardFakeService,
		cfg,
		nil,
		tracer,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		featuremgmt.WithFeatures(),
		folderPermissions,
		actest.FakeAccessControl{},
		folderService,
		folder.NewFakeStore(),
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
	)
	require.NoError(t, err)
	service.RegisterDashboardPermissions(accesscontrolmock.NewMockedPermissionsService())
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
