package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
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

		permissionScenario(t, "When saving a dashboard with non-existing id", func(t *testing.T, sc *permissionScenarioContext) {
			cmd := dashboards.SaveDashboardCommand{
				OrgID: testOrgID,
				Dashboard: simplejson.NewFromAny(map[string]any{
					"id":    float64(123412321),
					"title": "Expect error",
				}),
			}

			_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
			assert.Equal(t, dashboards.ErrDashboardNotFound, err)
		})

		// Given other organization

		t.Run("Given organization B", func(t *testing.T) {
			const otherOrgId int64 = 2

			permissionScenario(t, "When creating a dashboard with same id as dashboard in organization A", func(t *testing.T, sc *permissionScenarioContext) {
				cmd := dashboards.SaveDashboardCommand{
					OrgID: otherOrgId,
					Dashboard: simplejson.NewFromAny(map[string]any{
						"id":    sc.savedDashInFolder.ID,
						"title": "Expect error",
					}),
					Overwrite: false,
				}

				_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
				assert.Equal(t, dashboards.ErrDashboardNotFound, err)
			})

			permissionScenario(t, "When creating a dashboard with same uid as dashboard in organization A, it should create a new dashboard in org B", func(t *testing.T, sc *permissionScenarioContext) {
				const otherOrgId int64 = 2
				cmd := dashboards.SaveDashboardCommand{
					OrgID: otherOrgId,
					Dashboard: simplejson.NewFromAny(map[string]any{
						"uid":   sc.savedDashInFolder.UID,
						"title": "Dash with existing uid in other org",
					}),
					Overwrite: false,
				}

				res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
				require.NotNil(t, res)

				_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
					OrgID: otherOrgId,
					UID:   sc.savedDashInFolder.UID,
				})
				require.NoError(t, err)
			})
		})

		t.Run("Given user has permission to save", func(t *testing.T) {
			t.Run("and overwrite flag is set to false", func(t *testing.T) {
				const shouldOverwrite = false

				permissionScenario(t, "When creating a dashboard in General folder with same name as dashboard in other folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedDashInFolder.Title,
						}),
						FolderUID: "",
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})

					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a dashboard in other folder with same name as dashboard in General folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedDashInGeneralFolder.Title,
						}),
						FolderUID: sc.savedFolder.UID,
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					assert.NotEqual(t, sc.savedDashInGeneralFolder.ID, res.ID)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a folder with same name as dashboard in other folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedDashInFolder.Title,
						}),
						IsFolder:  true,
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					assert.NotEqual(t, sc.savedDashInGeneralFolder.ID, res.ID)
					assert.True(t, res.IsFolder)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When saving a dashboard without id and uid and unique title in folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": "Dash without id and uid",
						}),
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					assert.Greater(t, res.ID, int64(0))
					assert.NotEmpty(t, res.UID)
					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When saving a dashboard when dashboard id is zero ", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    0,
							"title": "Dash with zero id",
						}),
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When saving a dashboard in non-existing folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": "Expect error",
						}),
						FolderUID: "123412321",
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrFolderNotFound, err)
				})

				permissionScenario(t, "When updating an existing dashboard by id without current version", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "test dash 23",
						}),
						FolderUID: sc.savedFolder.UID,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
				})

				permissionScenario(t, "When updating an existing dashboard by id with current version", func(t *testing.T, sc *permissionScenarioContext) {
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

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    sc.savedDashInGeneralFolder.ID,
						OrgID: cmd.OrgID,
					})

					require.NoError(t, err)
				})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInFolder.UID,
							"title": "test dash 23",
						}),
						FolderUID: "",
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardVersionMismatch, err)
				})

				permissionScenario(t, "When updating an existing dashboard by uid with current version", func(t *testing.T, sc *permissionScenarioContext) {
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

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    sc.savedDashInFolder.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedDashInFolder.Title,
						}),
						FolderUID: sc.savedDashInFolder.FolderUID,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedDashInGeneralFolder.Title,
						}),
						FolderUID: sc.savedDashInGeneralFolder.FolderUID,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a folder with same name as existing folder", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: testOrgID,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    nil,
							"title": sc.savedFolder.Title,
						}),
						IsFolder:  true,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NoError(t, err)
				})
			})

			t.Run("and overwrite flag is set to true", func(t *testing.T) {
				const shouldOverwrite = true

				permissionScenario(t, "When updating an existing dashboard by id without current version", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInGeneralFolder.ID,
							"title": "Updated title",
						}),
						FolderUID: sc.savedFolder.UID,
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    sc.savedDashInGeneralFolder.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When updating an existing dashboard by uid without current version", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInFolder.UID,
							"title": "Updated title",
						}),
						FolderUID: "",
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    sc.savedDashInFolder.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When updating uid for existing dashboard using id", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInFolder.ID,
							"uid":   "new-uid",
							"title": sc.savedDashInFolder.Title,
						}),
						Overwrite: shouldOverwrite,
					}

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)
					assert.Equal(t, sc.savedDashInFolder.ID, res.ID)
					assert.Equal(t, "new-uid", res.UID)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    sc.savedDashInFolder.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When updating uid to an existing uid for existing dashboard using id", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInFolder.ID,
							"uid":   sc.savedDashInGeneralFolder.UID,
							"title": sc.savedDashInFolder.Title,
						}),
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardWithSameUIDExists, err)
				})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in other folder", func(t *testing.T, sc *permissionScenarioContext) {
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

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)
					assert.Equal(t, sc.savedDashInFolder.ID, res.ID)
					assert.Equal(t, sc.savedDashInFolder.UID, res.UID)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When creating a dashboard with same name as dashboard in General folder", func(t *testing.T, sc *permissionScenarioContext) {
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

					res, _ := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NotNil(t, res)
					assert.Equal(t, sc.savedDashInGeneralFolder.ID, res.ID)
					assert.Equal(t, sc.savedDashInGeneralFolder.UID, res.UID)

					_, err := sc.dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{
						ID:    res.ID,
						OrgID: cmd.OrgID,
					})
					require.NoError(t, err)
				})

				permissionScenario(t, "When updating existing folder to a dashboard using id", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedFolder.ID,
							"title": "new title",
						}),
						IsFolder:  false,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
				})

				permissionScenario(t, "When updating existing dashboard to a folder using id", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"id":    sc.savedDashInFolder.ID,
							"title": "new folder title",
						}),
						IsFolder:  true,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
				})

				permissionScenario(t, "When updating existing folder to a dashboard using uid", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedFolder.UID,
							"title": "new title",
						}),
						IsFolder:  false,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
				})

				permissionScenario(t, "When updating existing dashboard to a folder using uid", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"uid":   sc.savedDashInFolder.UID,
							"title": "new folder title",
						}),
						IsFolder:  true,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					assert.Equal(t, dashboards.ErrDashboardTypeMismatch, err)
				})

				permissionScenario(t, "When updating existing folder to a dashboard using title", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": sc.savedFolder.Title,
						}),
						IsFolder:  false,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NoError(t, err)
				})

				permissionScenario(t, "When updating existing dashboard to a folder using title", func(t *testing.T, sc *permissionScenarioContext) {
					cmd := dashboards.SaveDashboardCommand{
						OrgID: 1,
						Dashboard: simplejson.NewFromAny(map[string]any{
							"title": sc.savedDashInGeneralFolder.Title,
						}),
						IsFolder:  true,
						Overwrite: shouldOverwrite,
					}

					_, err := callSaveWithResult(t, cmd, sc.sqlStore, nil)
					require.NoError(t, err)
				})
			})
		})
	})
}

func TestIntegrationDashboardServicePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Given saved folders and dashboards in organization A", func(t *testing.T) {
		permissionScenario(t, "When creating a new dashboard in the General folder, requires create permissions scoped to the general folder",
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

				permissions := map[int64]map[string][]string{
					testOrgID: {
						dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsAll},
					},
				}
				_, err := callSaveWithResult(t, cmd, sqlStore, permissions)
				assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

				permissions = map[int64]map[string][]string{
					testOrgID: {
						dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)},
					},
				}
				_, err = callSaveWithResult(t, cmd, sqlStore, permissions)
				assert.Nil(t, err)
			})

		permissionScenario(t, "When creating a new dashboard in other folder, requires create permissions scoped to the other folder", func(t *testing.T, sc *permissionScenarioContext) {
			cmd := dashboards.SaveDashboardCommand{
				OrgID: testOrgID,
				Dashboard: simplejson.NewFromAny(map[string]any{
					"title": "Dash",
				}),
				FolderUID: sc.otherSavedFolder.UID,
				UserID:    10000,
				Overwrite: true,
			}

			permissions := map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID("different_folder_uid")},
				},
			}
			_, err := callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(sc.otherSavedFolder.UID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Nil(t, err)
		})

		permissionScenario(t, "When creating a new dashboard by existing UID in folder, requires write permissions on the existing dashboard", func(t *testing.T, sc *permissionScenarioContext) {
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

			permissions := map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID("different_dash_uid")},
				},
			}
			_, err := callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(sc.savedDashInFolder.UID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Nil(t, err)
		})

		permissionScenario(t, "When moving a dashboard by existing uid to other folder from General folder, requires dashboard creation permissions on the destination folder and write access to the dashboard", func(t *testing.T, sc *permissionScenarioContext) {
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

			// Perms to write dashboard but not create dashboards in the destination folder
			permissions := map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(sc.savedDashInGeneralFolder.UID)},
				},
			}
			_, err := callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			// Perms to create dashboards in the destination folder but not write the dashboard
			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(sc.otherSavedFolder.UID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			// Perms to write dashboard and create dashboards in the destination folder
			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite:  {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(sc.savedDashInGeneralFolder.UID)},
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(sc.otherSavedFolder.UID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Nil(t, err)
		})

		permissionScenario(t, "When moving a dashboard by existing uid to the General folder from other folder, requires dashboard creation permissions on the general folder and write access to the dashboard", func(t *testing.T, sc *permissionScenarioContext) {
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

			// Perms to write dashboard but not create dashboards in the destination folder
			permissions := map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(sc.savedDashInFolder.UID)},
				},
			}
			_, err := callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			// Perms to create dashboards in the destination folder but not write the dashboard
			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.Equal(t, dashboards.ErrDashboardUpdateAccessDenied, err)

			// Perms to write dashboard and create dashboards in the destination folder
			permissions = map[int64]map[string][]string{
				testOrgID: {
					dashboards.ActionDashboardsWrite:  {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(sc.savedDashInFolder.UID)},
					dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)},
				},
			}
			_, err = callSaveWithResult(t, cmd, sc.sqlStore, permissions)
			assert.NoError(t, err)
		})
	})
}

type permissionScenarioContext struct {
	sqlStore                 db.DB
	dashboardStore           dashboards.Store
	savedFolder              *dashboards.Dashboard
	savedDashInFolder        *dashboards.Dashboard
	otherSavedFolder         *dashboards.Dashboard
	savedDashInGeneralFolder *dashboards.Dashboard
}

type permissionScenarioFunc func(t *testing.T, sc *permissionScenarioContext)

func permissionScenario(t *testing.T, desc string, fn permissionScenarioFunc) {
	t.Helper()

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
			apiserver.WithoutRestConfig,
		)
		dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
		dashboardService, err := ProvideDashboardServiceImpl(
			cfg, dashboardStore, folderStore,
			featuremgmt.WithFeatures(),
			folderPermissions,
			ac,
			actest.FakeService{},
			folderService,
			nil,
			client.MockTestRestConfig{},
			nil,
			quotaService,
			nil,
			nil,
			nil,
			dualwrite.ProvideTestService(),
			sort.ProvideService(),
			serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
			kvstore.NewFakeKVStore(),
		)
		dashboardService.RegisterDashboardPermissions(dashboardPermissions)
		require.NoError(t, err)

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

		sc := &permissionScenarioContext{
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

func callSaveWithResult(t *testing.T, cmd dashboards.SaveDashboardCommand, sqlStore db.DB, permissions map[int64]map[string][]string) (*dashboards.Dashboard, error) {
	t.Helper()

	features := featuremgmt.WithFeatures()
	dto := toSaveDashboardDto(cmd)
	var ac accesscontrol.AccessControl
	ac = actest.FakeAccessControl{ExpectedEvaluate: true}
	if permissions != nil {
		dto.User = &user.SignedInUser{UserID: cmd.UserID, OrgID: testOrgID, Permissions: permissions}
		ac = acimpl.ProvideAccessControl(features)
	}
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
		apiserver.WithoutRestConfig,
	)
	dashboardPermissions := accesscontrolmock.NewMockedPermissionsService()
	dashboardPermissions.On("SetPermissions",
		mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		featuremgmt.WithFeatures(),
		folderPermissions,
		ac,
		actest.FakeService{},
		folderService,
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
	)
	require.NoError(t, err)
	service.RegisterDashboardPermissions(dashboardPermissions)
	return service.SaveDashboard(context.Background(), &dto, false)
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
		apiserver.WithoutRestConfig,
	)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		features,
		accesscontrolmock.NewMockedPermissionsService(),
		actest.FakeAccessControl{ExpectedEvaluate: true},
		actest.FakeService{},
		folderService,
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
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
		apiserver.WithoutRestConfig,
	)
	folderPermissions.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore,
		featuremgmt.WithFeatures(),
		folderPermissions,
		actest.FakeAccessControl{ExpectedEvaluate: true},
		actest.FakeService{},
		folderService,
		nil,
		client.MockTestRestConfig{},
		nil,
		quotaService,
		nil,
		nil,
		nil,
		dualwrite.ProvideTestService(),
		sort.ProvideService(),
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		kvstore.NewFakeKVStore(),
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
