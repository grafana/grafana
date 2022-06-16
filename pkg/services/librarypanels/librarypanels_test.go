package librarypanels

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	busmock "github.com/grafana/grafana/pkg/bus/mock"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

const userInDbName = "user_in_db"
const userInDbAvatar = "/avatar/402d08de060496d6b6874495fe20f5ad"

func TestLoadLibraryPanelsForDashboard(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to load a dashboard with a library panel, it should copy JSON properties from library panel.",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]interface{}{
							"uid":  sc.initialResult.Result.UID,
							"name": sc.initialResult.Result.Name,
						},
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing LoadLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			err := sc.elementService.ConnectElementsToDashboard(sc.ctx, sc.user, []string{sc.initialResult.Result.UID}, dashInDB.Id)
			require.NoError(t, err)

			err = sc.service.LoadLibraryPanelsForDashboard(sc.ctx, dashInDB)
			require.NoError(t, err)
			expectedJSON := map[string]interface{}{
				"title":   "Testing LoadLibraryPanelsForDashboard",
				"uid":     dashInDB.Uid,
				"version": dashInDB.Version,
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource":  "${DS_GDEV-TESTDATA}",
						"description": "A description",
						"libraryPanel": map[string]interface{}{
							"uid":         sc.initialResult.Result.UID,
							"name":        sc.initialResult.Result.Name,
							"type":        sc.initialResult.Result.Type,
							"description": sc.initialResult.Result.Description,
							"version":     sc.initialResult.Result.Version,
							"meta": map[string]interface{}{
								"folderName":          "ScenarioFolder",
								"folderUid":           sc.folder.Uid,
								"connectedDashboards": int64(1),
								"created":             sc.initialResult.Result.Meta.Created,
								"updated":             sc.initialResult.Result.Meta.Updated,
								"createdBy": map[string]interface{}{
									"id":        sc.initialResult.Result.Meta.CreatedBy.ID,
									"name":      userInDbName,
									"avatarUrl": userInDbAvatar,
								},
								"updatedBy": map[string]interface{}{
									"id":        sc.initialResult.Result.Meta.UpdatedBy.ID,
									"name":      userInDbName,
									"avatarUrl": userInDbAvatar,
								},
							},
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			expected := simplejson.NewFromAny(expectedJSON)
			if diff := cmp.Diff(expected.Interface(), dash.Data.Interface(), getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to load a dashboard with library panels inside and outside of rows, it should copy JSON properties from library panels",
		func(t *testing.T, sc scenarioContext) {
			cmd := libraryelements.CreateLibraryElementCommand{
				FolderID: sc.initialResult.Result.FolderID,
				Name:     "Outside row",
				Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A description"
			}
		`),
				Kind: int64(models.PanelElement),
			}
			outsidePanel, err := sc.elementService.CreateElement(sc.ctx, sc.user, cmd)
			require.NoError(t, err)
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							map[string]interface{}{
								"id": int64(4),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 6,
									"y": 13,
								},
								"datasource": "${DS_GDEV-TESTDATA}",
								"libraryPanel": map[string]interface{}{
									"uid": sc.initialResult.Result.UID,
								},
								"title": "Inside row",
								"type":  "text",
							},
						},
					},
					map[string]interface{}{
						"id": int64(5),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 19,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": outsidePanel.UID,
						},
						"title": "Outside row",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing LoadLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			err = sc.elementService.ConnectElementsToDashboard(sc.ctx, sc.user, []string{outsidePanel.UID, sc.initialResult.Result.UID}, dashInDB.Id)
			require.NoError(t, err)

			err = sc.service.LoadLibraryPanelsForDashboard(sc.ctx, dashInDB)
			require.NoError(t, err)
			expectedJSON := map[string]interface{}{
				"title":   "Testing LoadLibraryPanelsForDashboard",
				"uid":     dashInDB.Uid,
				"version": dashInDB.Version,
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							map[string]interface{}{
								"id": int64(4),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 6,
									"y": 13,
								},
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"libraryPanel": map[string]interface{}{
									"uid":         sc.initialResult.Result.UID,
									"name":        sc.initialResult.Result.Name,
									"type":        sc.initialResult.Result.Type,
									"description": sc.initialResult.Result.Description,
									"version":     sc.initialResult.Result.Version,
									"meta": map[string]interface{}{
										"folderName":          "ScenarioFolder",
										"folderUid":           sc.folder.Uid,
										"connectedDashboards": int64(1),
										"created":             sc.initialResult.Result.Meta.Created,
										"updated":             sc.initialResult.Result.Meta.Updated,
										"createdBy": map[string]interface{}{
											"id":        sc.initialResult.Result.Meta.CreatedBy.ID,
											"name":      userInDbName,
											"avatarUrl": userInDbAvatar,
										},
										"updatedBy": map[string]interface{}{
											"id":        sc.initialResult.Result.Meta.UpdatedBy.ID,
											"name":      userInDbName,
											"avatarUrl": userInDbAvatar,
										},
									},
								},
								"title": "Text - Library Panel",
								"type":  "text",
							},
						},
					},
					map[string]interface{}{
						"id": int64(5),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 19,
						},
						"datasource":  "${DS_GDEV-TESTDATA}",
						"description": "A description",
						"libraryPanel": map[string]interface{}{
							"uid":         outsidePanel.UID,
							"name":        outsidePanel.Name,
							"type":        outsidePanel.Type,
							"description": outsidePanel.Description,
							"version":     outsidePanel.Version,
							"meta": map[string]interface{}{
								"folderName":          "ScenarioFolder",
								"folderUid":           sc.folder.Uid,
								"connectedDashboards": int64(1),
								"created":             outsidePanel.Meta.Created,
								"updated":             outsidePanel.Meta.Updated,
								"createdBy": map[string]interface{}{
									"id":        outsidePanel.Meta.CreatedBy.ID,
									"name":      userInDbName,
									"avatarUrl": userInDbAvatar,
								},
								"updatedBy": map[string]interface{}{
									"id":        outsidePanel.Meta.UpdatedBy.ID,
									"name":      userInDbName,
									"avatarUrl": userInDbAvatar,
								},
							},
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			expected := simplejson.NewFromAny(expectedJSON)
			if diff := cmp.Diff(expected.Interface(), dash.Data.Interface(), getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to load a dashboard with a library panel without uid, it should fail",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]interface{}{
							"name": sc.initialResult.Result.Name,
						},
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing LoadLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			err := sc.elementService.ConnectElementsToDashboard(sc.ctx, sc.user, []string{sc.initialResult.Result.UID}, dashInDB.Id)
			require.NoError(t, err)

			err = sc.service.LoadLibraryPanelsForDashboard(sc.ctx, dashInDB)
			require.EqualError(t, err, errLibraryPanelHeaderUIDMissing.Error())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to load a dashboard with a library panel that is not connected, it should set correct JSON and continue",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]interface{}{
							"uid": sc.initialResult.Result.UID,
						},
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing LoadLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err := sc.service.LoadLibraryPanelsForDashboard(sc.ctx, dashInDB)
			require.NoError(t, err)
			expectedJSON := map[string]interface{}{
				"title":   "Testing LoadLibraryPanelsForDashboard",
				"uid":     dashInDB.Uid,
				"version": dashInDB.Version,
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]interface{}{
							"uid": sc.initialResult.Result.UID,
						},
						"type": fmt.Sprintf("Library panel with UID: \"%s\"", sc.initialResult.Result.UID),
					},
				},
			}
			expected := simplejson.NewFromAny(expectedJSON)
			if diff := cmp.Diff(expected.Interface(), dash.Data.Interface(), getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

func TestCleanLibraryPanelsForDashboard(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with a library panel, it should just keep the correct JSON properties in library panel",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": sc.initialResult.Result.UID,
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing CleanLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err := sc.service.CleanLibraryPanelsForDashboard(dashInDB)
			require.NoError(t, err)
			expectedJSON := map[string]interface{}{
				"title":   "Testing CleanLibraryPanelsForDashboard",
				"uid":     dashInDB.Uid,
				"version": dashInDB.Version,
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]interface{}{
							"uid": sc.initialResult.Result.UID,
						},
					},
				},
			}
			expected := simplejson.NewFromAny(expectedJSON)
			if diff := cmp.Diff(expected.Interface(), dash.Data.Interface(), getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with library panels inside and outside of rows, it should just keep the correct JSON properties",
		func(t *testing.T, sc scenarioContext) {
			cmd := libraryelements.CreateLibraryElementCommand{
				FolderID: sc.initialResult.Result.FolderID,
				Name:     "Outside row",
				Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A description"
			}
		`),
				Kind: int64(models.PanelElement),
			}
			outsidePanel, err := sc.elementService.CreateElement(sc.ctx, sc.user, cmd)
			require.NoError(t, err)
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							map[string]interface{}{
								"id": int64(4),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 6,
									"y": 13,
								},
								"datasource": "${DS_GDEV-TESTDATA}",
								"libraryPanel": map[string]interface{}{
									"uid": sc.initialResult.Result.UID,
								},
								"title": "Inside row",
								"type":  "text",
							},
						},
					},
					map[string]interface{}{
						"id": int64(5),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 19,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": outsidePanel.UID,
						},
						"title": "Outside row",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing CleanLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err = sc.service.CleanLibraryPanelsForDashboard(dashInDB)
			require.NoError(t, err)
			expectedJSON := map[string]interface{}{
				"title":   "Testing CleanLibraryPanelsForDashboard",
				"uid":     dashInDB.Uid,
				"version": dashInDB.Version,
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							map[string]interface{}{
								"id": int64(4),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 6,
									"y": 13,
								},
								"libraryPanel": map[string]interface{}{
									"uid": sc.initialResult.Result.UID,
								},
							},
						},
					},
					map[string]interface{}{
						"id": int64(5),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 19,
						},
						"libraryPanel": map[string]interface{}{
							"uid": outsidePanel.UID,
						},
					},
				},
			}
			expected := simplejson.NewFromAny(expectedJSON)
			if diff := cmp.Diff(expected.Interface(), dash.Data.Interface(), getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with a library panel without uid, it should fail",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"name": sc.initialResult.Result.Name,
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing CleanLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err := sc.service.CleanLibraryPanelsForDashboard(dashInDB)
			require.EqualError(t, err, errLibraryPanelHeaderUIDMissing.Error())
		})
}

func TestConnectLibraryPanelsForDashboard(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with a library panel, it should connect the two",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": sc.initialResult.Result.UID,
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err := sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.NoError(t, err)

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.Id)
			require.NoError(t, err)
			require.Len(t, elements, 1)
			require.Equal(t, sc.initialResult.Result.UID, elements[sc.initialResult.Result.UID].UID)
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with library panels inside and outside of rows, it should connect all",
		func(t *testing.T, sc scenarioContext) {
			cmd := libraryelements.CreateLibraryElementCommand{
				FolderID: sc.initialResult.Result.FolderID,
				Name:     "Outside row",
				Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A description"
			}
		`),
				Kind: int64(models.PanelElement),
			}
			outsidePanel, err := sc.elementService.CreateElement(sc.ctx, sc.user, cmd)
			require.NoError(t, err)
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							map[string]interface{}{
								"id": int64(4),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 6,
									"y": 13,
								},
								"datasource": "${DS_GDEV-TESTDATA}",
								"libraryPanel": map[string]interface{}{
									"uid": sc.initialResult.Result.UID,
								},
								"title": "Inside row",
								"type":  "text",
							},
						},
					},
					map[string]interface{}{
						"id": int64(5),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 19,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": outsidePanel.UID,
						},
						"title": "Outside row",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err = sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.NoError(t, err)

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.Id)
			require.NoError(t, err)
			require.Len(t, elements, 2)
			require.Equal(t, sc.initialResult.Result.UID, elements[sc.initialResult.Result.UID].UID)
			require.Equal(t, outsidePanel.UID, elements[outsidePanel.UID].UID)
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with a library panel without uid, it should fail",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(2),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"name": sc.initialResult.Result.Name,
						},
						"title": "Text - Library Panel",
						"type":  "text",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)

			err := sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.EqualError(t, err, errLibraryPanelHeaderUIDMissing.Error())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with unused/removed library panels, it should disconnect unused/removed library panels",
		func(t *testing.T, sc scenarioContext) {
			unused, err := sc.elementService.CreateElement(sc.ctx, sc.user, libraryelements.CreateLibraryElementCommand{
				FolderID: sc.folder.Id,
				Name:     "Unused Libray Panel",
				Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 4,
			  "title": "Unused Libray Panel",
			  "type": "text",
			  "description": "Unused description"
			}
		`),
				Kind: int64(models.PanelElement),
			})
			require.NoError(t, err)
			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id": int64(4),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"datasource": "${DS_GDEV-TESTDATA}",
						"libraryPanel": map[string]interface{}{
							"uid": unused.UID,
						},
						"title":       "Unused Libray Panel",
						"description": "Unused description",
					},
				},
			}

			dash := models.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			err = sc.elementService.ConnectElementsToDashboard(sc.ctx, sc.user, []string{sc.initialResult.Result.UID}, dashInDB.Id)
			require.NoError(t, err)

			panelJSON := []interface{}{
				map[string]interface{}{
					"id": int64(1),
					"gridPos": map[string]interface{}{
						"h": 6,
						"w": 6,
						"x": 0,
						"y": 0,
					},
				},
				map[string]interface{}{
					"id": int64(2),
					"gridPos": map[string]interface{}{
						"h": 6,
						"w": 6,
						"x": 6,
						"y": 0,
					},
					"datasource": "${DS_GDEV-TESTDATA}",
					"libraryPanel": map[string]interface{}{
						"uid": sc.initialResult.Result.UID,
					},
					"title": "Text - Library Panel",
					"type":  "text",
				},
			}
			dashInDB.Data.Set("panels", panelJSON)
			err = sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.NoError(t, err)

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.Id)
			require.NoError(t, err)
			require.Len(t, elements, 1)
			require.Equal(t, sc.initialResult.Result.UID, elements[sc.initialResult.Result.UID].UID)
		})
}

func TestImportLibraryPanelsForDashboard(t *testing.T) {
	testScenario(t, "When an admin tries to import a dashboard with a library panel that does not exist, it should import the library panel",
		func(t *testing.T, sc scenarioContext) {
			var missingUID = "jL6MrxCMz"
			var missingName = "Missing Library Panel"
			var missingModel = map[string]interface{}{
				"id": int64(2),
				"gridPos": map[string]interface{}{
					"h": int64(6),
					"w": int64(6),
					"x": int64(0),
					"y": int64(0),
				},
				"description": "",
				"datasource":  "${DS_GDEV-TESTDATA}",
				"libraryPanel": map[string]interface{}{
					"uid":  missingUID,
					"name": missingName,
				},
				"title": "Text - Library Panel",
				"type":  "text",
			}

			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					missingModel,
				},
			}
			dash := models.Dashboard{
				Title: "Testing ImportLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			_, err := sc.elementService.GetElement(sc.ctx, sc.user, missingUID)
			require.EqualError(t, err, libraryelements.ErrLibraryElementNotFound.Error())

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB, 0)
			require.NoError(t, err)

			element, err := sc.elementService.GetElement(sc.ctx, sc.user, missingUID)
			require.NoError(t, err)
			var expected = getExpected(t, element, missingUID, missingName, missingModel)
			var result = toLibraryElement(t, element)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to import a dashboard with a library panel that already exist, it should not import the library panel and existing library panel should be unchanged",
		func(t *testing.T, sc scenarioContext) {
			var existingUID = sc.initialResult.Result.UID
			var existingName = sc.initialResult.Result.Name

			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"id":          int64(1),
						"description": "Updated description",
						"datasource":  "Updated datasource",
						"libraryPanel": map[string]interface{}{
							"uid":  sc.initialResult.Result.UID,
							"name": sc.initialResult.Result.Name,
						},
						"title": "Updated Title",
						"type":  "stat",
					},
				},
			}
			dash := models.Dashboard{
				Title: "Testing ImportLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			_, err := sc.elementService.GetElement(sc.ctx, sc.user, existingUID)
			require.NoError(t, err)

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB, sc.folder.Id)
			require.NoError(t, err)

			element, err := sc.elementService.GetElement(sc.ctx, sc.user, existingUID)
			require.NoError(t, err)
			var expected = getExpected(t, element, existingUID, existingName, sc.initialResult.Result.Model)
			expected.FolderID = sc.initialResult.Result.FolderID
			expected.Description = sc.initialResult.Result.Description
			expected.Meta.FolderUID = sc.folder.Uid
			expected.Meta.FolderName = sc.folder.Title
			var result = toLibraryElement(t, element)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	testScenario(t, "When an admin tries to import a dashboard with library panels inside and outside of rows, it should import all that do not exist",
		func(t *testing.T, sc scenarioContext) {
			var outsideUID = "jL6MrxCMz"
			var outsideName = "Outside Library Panel"
			var outsideModel = map[string]interface{}{
				"id": int64(5),
				"gridPos": map[string]interface{}{
					"h": 6,
					"w": 6,
					"x": 0,
					"y": 19,
				},
				"datasource": "${DS_GDEV-TESTDATA}",
				"libraryPanel": map[string]interface{}{
					"uid":  outsideUID,
					"name": outsideName,
				},
				"title": "Outside row",
				"type":  "text",
			}
			var insideUID = "iK7NsyDNz"
			var insideName = "Inside Library Panel"
			var insideModel = map[string]interface{}{
				"id": int64(4),
				"gridPos": map[string]interface{}{
					"h": 6,
					"w": 6,
					"x": 6,
					"y": 13,
				},
				"datasource": "${DS_GDEV-TESTDATA}",
				"libraryPanel": map[string]interface{}{
					"uid":  insideUID,
					"name": insideName,
				},
				"title": "Inside row",
				"type":  "text",
			}

			dashJSON := map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id": int64(1),
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]interface{}{
						"collapsed": true,
						"gridPos": map[string]interface{}{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 6,
						},
						"id":   int64(2),
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id": int64(3),
								"gridPos": map[string]interface{}{
									"h": 6,
									"w": 6,
									"x": 0,
									"y": 7,
								},
							},
							insideModel,
						},
					},
					outsideModel,
				},
			}
			dash := models.Dashboard{
				Title: "Testing ImportLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.Id)
			_, err := sc.elementService.GetElement(sc.ctx, sc.user, outsideUID)
			require.EqualError(t, err, libraryelements.ErrLibraryElementNotFound.Error())
			_, err = sc.elementService.GetElement(sc.ctx, sc.user, insideUID)
			require.EqualError(t, err, libraryelements.ErrLibraryElementNotFound.Error())

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB, 0)
			require.NoError(t, err)

			element, err := sc.elementService.GetElement(sc.ctx, sc.user, outsideUID)
			require.NoError(t, err)
			expected := getExpected(t, element, outsideUID, outsideName, outsideModel)
			result := toLibraryElement(t, element)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}

			element, err = sc.elementService.GetElement(sc.ctx, sc.user, insideUID)
			require.NoError(t, err)
			expected = getExpected(t, element, insideUID, insideName, insideModel)
			result = toLibraryElement(t, element)
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}

type libraryPanel struct {
	ID          int64
	OrgID       int64
	FolderID    int64
	UID         string
	Name        string
	Type        string
	Description string
	Model       map[string]interface{}
	Version     int64
	Meta        libraryelements.LibraryElementDTOMeta
}

type libraryElementGridPos struct {
	H int64 `json:"h"`
	W int64 `json:"w"`
	X int64 `json:"x"`
	Y int64 `json:"y"`
}

type libraryElementLibraryPanel struct {
	UID  string `json:"uid"`
	Name string `json:"name"`
}

type libraryElementModel struct {
	ID           int64                      `json:"id"`
	Datasource   string                     `json:"datasource"`
	Description  string                     `json:"description"`
	Title        string                     `json:"title"`
	Type         string                     `json:"type"`
	GridPos      libraryElementGridPos      `json:"gridPos"`
	LibraryPanel libraryElementLibraryPanel `json:"libraryPanel"`
}

type libraryElement struct {
	ID          int64                                 `json:"id"`
	OrgID       int64                                 `json:"orgId"`
	FolderID    int64                                 `json:"folderId"`
	UID         string                                `json:"uid"`
	Name        string                                `json:"name"`
	Kind        int64                                 `json:"kind"`
	Type        string                                `json:"type"`
	Description string                                `json:"description"`
	Model       libraryElementModel                   `json:"model"`
	Version     int64                                 `json:"version"`
	Meta        libraryelements.LibraryElementDTOMeta `json:"meta"`
}

type libraryPanelResult struct {
	Result libraryPanel `json:"result"`
}

type scenarioContext struct {
	ctx            context.Context
	service        Service
	elementService libraryelements.Service
	user           *models.SignedInUser
	folder         *models.Folder
	initialResult  libraryPanelResult
	sqlStore       *sqlstore.SQLStore
}

type folderACLItem struct {
	roleType   models.RoleType
	permission models.PermissionType
}

func toLibraryElement(t *testing.T, res libraryelements.LibraryElementDTO) libraryElement {
	var model = libraryElementModel{}
	err := json.Unmarshal(res.Model, &model)
	require.NoError(t, err)

	return libraryElement{
		ID:          res.ID,
		OrgID:       res.OrgID,
		FolderID:    res.FolderID,
		UID:         res.UID,
		Name:        res.Name,
		Type:        res.Type,
		Description: res.Description,
		Kind:        res.Kind,
		Model:       model,
		Version:     res.Version,
		Meta: libraryelements.LibraryElementDTOMeta{
			FolderName:          res.Meta.FolderName,
			FolderUID:           res.Meta.FolderUID,
			ConnectedDashboards: res.Meta.ConnectedDashboards,
			Created:             res.Meta.Created,
			Updated:             res.Meta.Updated,
			CreatedBy: libraryelements.LibraryElementDTOMetaUser{
				ID:        res.Meta.CreatedBy.ID,
				Name:      res.Meta.CreatedBy.Name,
				AvatarURL: res.Meta.CreatedBy.AvatarURL,
			},
			UpdatedBy: libraryelements.LibraryElementDTOMetaUser{
				ID:        res.Meta.UpdatedBy.ID,
				Name:      res.Meta.UpdatedBy.Name,
				AvatarURL: res.Meta.UpdatedBy.AvatarURL,
			},
		},
	}
}

func getExpected(t *testing.T, res libraryelements.LibraryElementDTO, UID string, name string, model map[string]interface{}) libraryElement {
	marshalled, err := json.Marshal(model)
	require.NoError(t, err)
	var libModel libraryElementModel
	err = json.Unmarshal(marshalled, &libModel)
	require.NoError(t, err)

	return libraryElement{
		ID:          res.ID,
		OrgID:       1,
		FolderID:    0,
		UID:         UID,
		Name:        name,
		Type:        "text",
		Description: "",
		Kind:        1,
		Model:       libModel,
		Version:     1,
		Meta: libraryelements.LibraryElementDTOMeta{
			FolderName:          "General",
			FolderUID:           "",
			ConnectedDashboards: 0,
			Created:             res.Meta.Created,
			Updated:             res.Meta.Updated,
			CreatedBy: libraryelements.LibraryElementDTOMetaUser{
				ID:        1,
				Name:      userInDbName,
				AvatarURL: userInDbAvatar,
			},
			UpdatedBy: libraryelements.LibraryElementDTOMetaUser{
				ID:        1,
				Name:      userInDbName,
				AvatarURL: userInDbAvatar,
			},
		},
	}
}

func createDashboard(t *testing.T, sqlStore *sqlstore.SQLStore, user *models.SignedInUser, dash *models.Dashboard, folderID int64) *models.Dashboard {
	dash.FolderId = folderID
	dashItem := &dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   "",
		OrgId:     user.OrgId,
		User:      user,
		Overwrite: false,
	}

	dashboardStore := database.ProvideDashboardStore(sqlStore)
	dashAlertService := alerting.ProvideDashAlertExtractorService(nil, nil, nil)
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	ac := acmock.New()
	service := dashboardservice.ProvideDashboardService(
		cfg, dashboardStore, dashAlertService,
		featuremgmt.WithFeatures(), acmock.NewMockedPermissionsService(), acmock.NewMockedPermissionsService(), ac,
	)
	dashboard, err := service.SaveDashboard(context.Background(), dashItem, true)
	require.NoError(t, err)

	return dashboard
}

func createFolderWithACL(t *testing.T, sqlStore *sqlstore.SQLStore, title string, user *models.SignedInUser,
	items []folderACLItem) *models.Folder {
	t.Helper()

	ac := acmock.New()
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	features := featuremgmt.WithFeatures()
	folderPermissions := acmock.NewMockedPermissionsService()
	dashboardPermissions := acmock.NewMockedPermissionsService()
	dashboardStore := database.ProvideDashboardStore(sqlStore)
	d := dashboardservice.ProvideDashboardService(cfg, dashboardStore, nil, features, folderPermissions, dashboardPermissions, ac)
	s := dashboardservice.ProvideFolderService(cfg, d, dashboardStore, nil, features, folderPermissions, ac, busmock.New())

	t.Logf("Creating folder with title and UID %q", title)
	folder, err := s.CreateFolder(context.Background(), user, user.OrgId, title, title)
	require.NoError(t, err)

	updateFolderACL(t, dashboardStore, folder.Id, items)

	return folder
}

func updateFolderACL(t *testing.T, dashboardStore *database.DashboardStore, folderID int64, items []folderACLItem) {
	t.Helper()

	if len(items) == 0 {
		return
	}

	var aclItems []*models.DashboardAcl
	for _, item := range items {
		role := item.roleType
		permission := item.permission
		aclItems = append(aclItems, &models.DashboardAcl{
			DashboardID: folderID,
			Role:        &role,
			Permission:  permission,
			Created:     time.Now(),
			Updated:     time.Now(),
		})
	}

	err := dashboardStore.UpdateDashboardACL(context.Background(), folderID, aclItems)
	require.NoError(t, err)
}

func scenarioWithLibraryPanel(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	store := mockstore.NewSQLStoreMock()
	guardian.InitLegacyGuardian(store, &dashboards.FakeDashboardService{})
	t.Helper()

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		command := libraryelements.CreateLibraryElementCommand{
			FolderID: sc.folder.Id,
			Name:     "Text - Library Panel",
			Model: []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A description"
			}
		`),
			Kind: int64(models.PanelElement),
		}
		resp, err := sc.elementService.CreateElement(sc.ctx, sc.user, command)
		require.NoError(t, err)
		var model map[string]interface{}
		err = json.Unmarshal(resp.Model, &model)
		require.NoError(t, err)

		sc.initialResult = libraryPanelResult{
			Result: libraryPanel{
				ID:          resp.ID,
				OrgID:       resp.OrgID,
				FolderID:    resp.FolderID,
				UID:         resp.UID,
				Name:        resp.Name,
				Type:        resp.Type,
				Description: resp.Description,
				Model:       model,
				Version:     resp.Version,
				Meta:        resp.Meta,
			},
		}

		fn(t, sc)
	})
}

// testScenario is a wrapper around t.Run performing common setup for library panel tests.
// It takes your real test function as a callback.
func testScenario(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		cfg := setting.NewCfg()
		orgID := int64(1)
		role := models.ROLE_ADMIN
		sqlStore := sqlstore.InitTestDB(t)
		dashboardStore := database.ProvideDashboardStore(sqlStore)

		features := featuremgmt.WithFeatures()
		ac := acmock.New()
		folderPermissions := acmock.NewMockedPermissionsService()
		dashboardPermissions := acmock.NewMockedPermissionsService()

		dashboardService := dashboardservice.ProvideDashboardService(
			cfg, dashboardStore, &alerting.DashAlertExtractorService{},
			features, folderPermissions, dashboardPermissions, ac,
		)
		folderService := dashboardservice.ProvideFolderService(
			cfg, dashboardService, dashboardStore, nil,
			features, folderPermissions, ac, busmock.New(),
		)

		elementService := libraryelements.ProvideService(cfg, sqlStore, routing.NewRouteRegister(), folderService)
		service := LibraryPanelService{
			Cfg:                   cfg,
			SQLStore:              sqlStore,
			LibraryElementService: elementService,
		}

		user := &models.SignedInUser{
			UserId:     1,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgId:      orgID,
			OrgRole:    role,
			LastSeenAt: time.Now(),
		}

		// deliberate difference between signed in user and user in db to make it crystal clear
		// what to expect in the tests
		// In the real world these are identical
		cmd := models.CreateUserCommand{
			Email: "user.in.db@test.com",
			Name:  "User In DB",
			Login: userInDbName,
		}

		_, err := sqlStore.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		sc := scenarioContext{
			user:           user,
			ctx:            context.Background(),
			service:        &service,
			elementService: elementService,
			sqlStore:       sqlStore,
		}

		sc.folder = createFolderWithACL(t, sc.sqlStore, "ScenarioFolder", sc.user, []folderACLItem{})

		fn(t, sc)
	})
}

func getCompareOptions() []cmp.Option {
	return []cmp.Option{
		cmp.Transformer("Time", func(in time.Time) int64 {
			return in.UTC().Unix()
		}),
	}
}
