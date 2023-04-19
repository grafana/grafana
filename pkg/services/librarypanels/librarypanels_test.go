package librarypanels

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

const userInDbName = "user_in_db"
const userInDbAvatar = "/avatar/402d08de060496d6b6874495fe20f5ad"

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
			dash := dashboards.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID)

			err := sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.NoError(t, err)

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.ID)
			require.NoError(t, err)
			require.Len(t, elements, 1)
			require.Equal(t, sc.initialResult.Result.UID, elements[sc.initialResult.Result.UID].UID)
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with library panels inside and outside of rows, it should connect all",
		func(t *testing.T, sc scenarioContext) {
			cmd := model.CreateLibraryElementCommand{
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
				Kind: int64(model.PanelElement),
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
			dash := dashboards.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID)

			err = sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.NoError(t, err)

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.ID)
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
			dash := dashboards.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID)

			err := sc.service.ConnectLibraryPanelsForDashboard(sc.ctx, sc.user, dashInDB)
			require.EqualError(t, err, errLibraryPanelHeaderUIDMissing.Error())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to store a dashboard with unused/removed library panels, it should disconnect unused/removed library panels",
		func(t *testing.T, sc scenarioContext) {
			unused, err := sc.elementService.CreateElement(sc.ctx, sc.user, model.CreateLibraryElementCommand{
				FolderID: sc.folder.ID,
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
				Kind: int64(model.PanelElement),
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

			dash := dashboards.Dashboard{
				Title: "Testing ConnectLibraryPanelsForDashboard",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID)
			err = sc.elementService.ConnectElementsToDashboard(sc.ctx, sc.user, []string{sc.initialResult.Result.UID}, dashInDB.ID)
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

			elements, err := sc.elementService.GetElementsForDashboard(sc.ctx, dashInDB.ID)
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
			var libraryElements = map[string]interface{}{
				missingUID: map[string]interface{}{
					"model": missingModel,
				},
			}

			panels := []interface{}{
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
					"libraryPanel": map[string]interface{}{
						"uid":  missingUID,
						"name": missingName,
					},
				},
			}

			_, err := sc.elementService.GetElement(sc.ctx, sc.user, missingUID)

			require.EqualError(t, err, model.ErrLibraryElementNotFound.Error())

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, simplejson.NewFromAny(libraryElements), panels, 0)
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

			panels := []interface{}{
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
					"libraryPanel": map[string]interface{}{
						"uid":  sc.initialResult.Result.UID,
						"name": sc.initialResult.Result.Name,
					},
				},
			}

			_, err := sc.elementService.GetElement(sc.ctx, sc.user, existingUID)
			require.NoError(t, err)

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, simplejson.New(), panels, sc.folder.ID)
			require.NoError(t, err)

			element, err := sc.elementService.GetElement(sc.ctx, sc.user, existingUID)
			require.NoError(t, err)
			var expected = getExpected(t, element, existingUID, existingName, sc.initialResult.Result.Model)
			expected.FolderID = sc.initialResult.Result.FolderID
			expected.Description = sc.initialResult.Result.Description
			expected.Meta.FolderUID = sc.folder.UID
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

			var libraryElements = map[string]interface{}{
				outsideUID: map[string]interface{}{
					"model": outsideModel,
				},
				insideUID: map[string]interface{}{
					"model": insideModel,
				},
			}

			panels := []interface{}{
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
					"libraryPanel": map[string]interface{}{
						"uid":  outsideUID,
						"name": outsideName,
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
							"libraryPanel": map[string]interface{}{
								"uid":  insideUID,
								"name": insideName,
							},
						},
					},
				},
			}

			_, err := sc.elementService.GetElement(sc.ctx, sc.user, outsideUID)
			require.EqualError(t, err, model.ErrLibraryElementNotFound.Error())
			_, err = sc.elementService.GetElement(sc.ctx, sc.user, insideUID)
			require.EqualError(t, err, model.ErrLibraryElementNotFound.Error())

			err = sc.service.ImportLibraryPanelsForDashboard(sc.ctx, sc.user, simplejson.NewFromAny(libraryElements), panels, 0)
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
	Meta        model.LibraryElementDTOMeta
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
	ID          int64                       `json:"id"`
	OrgID       int64                       `json:"orgId"`
	FolderID    int64                       `json:"folderId"`
	UID         string                      `json:"uid"`
	Name        string                      `json:"name"`
	Kind        int64                       `json:"kind"`
	Type        string                      `json:"type"`
	Description string                      `json:"description"`
	Model       libraryElementModel         `json:"model"`
	Version     int64                       `json:"version"`
	Meta        model.LibraryElementDTOMeta `json:"meta"`
}

type libraryPanelResult struct {
	Result libraryPanel `json:"result"`
}

type scenarioContext struct {
	ctx            context.Context
	service        Service
	elementService libraryelements.Service
	user           *user.SignedInUser
	folder         *folder.Folder
	initialResult  libraryPanelResult
	sqlStore       db.DB
}

type folderACLItem struct {
	roleType   org.RoleType
	permission dashboards.PermissionType
}

func toLibraryElement(t *testing.T, res model.LibraryElementDTO) libraryElement {
	var libraryElementModel = libraryElementModel{}
	err := json.Unmarshal(res.Model, &libraryElementModel)
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
		Model:       libraryElementModel,
		Version:     res.Version,
		Meta: model.LibraryElementDTOMeta{
			FolderName:          res.Meta.FolderName,
			FolderUID:           res.Meta.FolderUID,
			ConnectedDashboards: res.Meta.ConnectedDashboards,
			Created:             res.Meta.Created,
			Updated:             res.Meta.Updated,
			CreatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id:        res.Meta.CreatedBy.Id,
				Name:      res.Meta.CreatedBy.Name,
				AvatarUrl: res.Meta.CreatedBy.AvatarUrl,
			},
			UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id:        res.Meta.UpdatedBy.Id,
				Name:      res.Meta.UpdatedBy.Name,
				AvatarUrl: res.Meta.UpdatedBy.AvatarUrl,
			},
		},
	}
}

func getExpected(t *testing.T, res model.LibraryElementDTO, UID string, name string, lEModel map[string]interface{}) libraryElement {
	marshalled, err := json.Marshal(lEModel)
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
		Meta: model.LibraryElementDTOMeta{
			FolderName:          "General",
			FolderUID:           "",
			ConnectedDashboards: 0,
			Created:             res.Meta.Created,
			Updated:             res.Meta.Updated,
			CreatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id:        1,
				Name:      userInDbName,
				AvatarUrl: userInDbAvatar,
			},
			UpdatedBy: librarypanel.LibraryElementDTOMetaUser{
				Id:        1,
				Name:      userInDbName,
				AvatarUrl: userInDbAvatar,
			},
		},
	}
}

func createDashboard(t *testing.T, sqlStore db.DB, user *user.SignedInUser, dash *dashboards.Dashboard, folderID int64) *dashboards.Dashboard {
	dash.FolderID = folderID
	dashItem := &dashboards.SaveDashboardDTO{
		Dashboard: dash,
		Message:   "",
		OrgID:     user.OrgID,
		User:      user,
		Overwrite: false,
	}

	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	dashAlertService := alerting.ProvideDashAlertExtractorService(nil, nil, nil)
	ac := actest.FakeAccessControl{ExpectedEvaluate: true}
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashPermissionService := acmock.NewMockedPermissionsService()
	dashPermissionService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)
	service, err := dashboardservice.ProvideDashboardServiceImpl(
		cfg, dashboardStore, folderStore, dashAlertService,
		featuremgmt.WithFeatures(), acmock.NewMockedPermissionsService(), dashPermissionService, ac,
		foldertest.NewFakeService(),
	)
	require.NoError(t, err)
	dashboard, err := service.SaveDashboard(context.Background(), dashItem, true)
	require.NoError(t, err)

	return dashboard
}

func createFolder(t *testing.T, sqlStore db.DB, title string, user *user.SignedInUser) *folder.Folder {
	t.Helper()

	ac := actest.FakeAccessControl{ExpectedEvaluate: true}
	cfg := setting.NewCfg()
	cfg.IsFeatureToggleEnabled = featuremgmt.WithFeatures().IsEnabled
	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	s := folderimpl.ProvideService(ac, bus.ProvideBus(tracing.InitializeTracerForTest()), cfg, dashboardStore, folderStore, nil, features)

	t.Logf("Creating folder with title and UID %q", title)
	ctx := appcontext.WithUser(context.Background(), user)
	folder, err := s.Create(ctx, &folder.CreateFolderCommand{OrgID: user.OrgID, Title: title, UID: title, SignedInUser: user})
	require.NoError(t, err)

	return folder
}

func scenarioWithLibraryPanel(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	t.Helper()

	testScenario(t, desc, func(t *testing.T, sc scenarioContext) {
		command := model.CreateLibraryElementCommand{
			FolderID: sc.folder.ID,
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
			Kind: int64(model.PanelElement),
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
		role := org.RoleAdmin
		sqlStore, cfg := db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)

		ac := actest.FakeAccessControl{ExpectedEvaluate: true}
		dashStore := &dashboards.FakeDashboardStore{}
		dashStore.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{ID: 1}, nil)
		folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
		dashAlertService := alerting.ProvideDashAlertExtractorService(nil, nil, nil)
		dashPermissionService := acmock.NewMockedPermissionsService()
		dashService, err := dashboardservice.ProvideDashboardServiceImpl(
			setting.NewCfg(), dashStore, folderStore, dashAlertService,
			featuremgmt.WithFeatures(), acmock.NewMockedPermissionsService(), dashPermissionService, ac,
			foldertest.NewFakeService(),
		)
		require.NoError(t, err)
		guardian.InitAccessControlGuardian(setting.NewCfg(), sqlStore, ac, acmock.NewMockedPermissionsService(), acmock.NewMockedPermissionsService(), dashService)

		dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)
		features := featuremgmt.WithFeatures()
		folderService := folderimpl.ProvideService(ac, bus.ProvideBus(tracing.InitializeTracerForTest()), cfg, dashboardStore, folderStore, nil, features)

		elementService := libraryelements.ProvideService(cfg, sqlStore, routing.NewRouteRegister(), folderService, featuremgmt.WithFeatures())
		service := LibraryPanelService{
			Cfg:                   cfg,
			SQLStore:              sqlStore,
			LibraryElementService: elementService,
		}

		usr := &user.SignedInUser{
			UserID:     1,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgID:      orgID,
			OrgRole:    role,
			LastSeenAt: time.Now(),
			Permissions: map[int64]map[string][]string{
				orgID: {
					dashboards.ActionFoldersRead: {dashboards.ScopeFoldersAll},
				},
			},
		}

		// deliberate difference between signed in user and user in db to make it crystal clear
		// what to expect in the tests
		// In the real world these are identical
		cmd := user.CreateUserCommand{
			Email: "user.in.db@test.com",
			Name:  "User In DB",
			Login: userInDbName,
		}
		ctx := appcontext.WithUser(context.Background(), usr)
		orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)
		_, err = usrSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)
		sc := scenarioContext{
			user:           usr,
			ctx:            ctx,
			service:        &service,
			elementService: elementService,
			sqlStore:       sqlStore,
		}

		foldr := createFolder(t, sc.sqlStore, "ScenarioFolder", sc.user)
		sc.folder = &folder.Folder{
			ID:        foldr.ID,
			UID:       foldr.UID,
			Title:     foldr.Title,
			URL:       dashboards.GetFolderURL(foldr.UID, slugify.Slugify(foldr.Title)),
			Version:   0,
			Created:   foldr.Created,
			Updated:   foldr.Updated,
			UpdatedBy: 0,
			CreatedBy: 0,
			HasACL:    false,
		}
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
