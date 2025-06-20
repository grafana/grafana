package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/kinds/librarypanel"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/sort"
)

func TestIntegration_GetAllLibraryElements(t *testing.T) {
	testScenario(t, "When an admin tries to get all library panels and none exists, it should return none",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Elements:   []libraryElement{},
					Page:       1,
					PerPage:    100,
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[1].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[1].Meta.Created,
								Updated:             result.Result.Elements[1].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and sort desc is set, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("sortDirection", sort.SortAlphaDesc.Name)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[1].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[1].Meta.Created,
								Updated:             result.Result.Elements[1].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and typeFilter is set to existing types, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreateCommandWithModel(sc.folder.ID, sc.folder.UID, "Gauge - Library Panel", model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Gauge - Library Panel",
			  "type": "gauge",
			  "description": "Gauge description"
			}
		`))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// nolint:staticcheck
			command = getCreateCommandWithModel(sc.folder.ID, sc.folder.UID, "BarGauge - Library Panel", model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "BarGauge - Library Panel",
			  "type": "bargauge",
			  "description": "BarGauge description"
			}
		`))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp = sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("typeFilter", "bargauge,gauge")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          3,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "BarGauge - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "bargauge",
							Description: "BarGauge description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "BarGauge description",
								"id":          float64(1),
								"title":       "BarGauge - Library Panel",
								"type":        "bargauge",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[1].UID,
							Name:        "Gauge - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "gauge",
							Description: "Gauge description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"id":          float64(1),
								"title":       "Gauge - Library Panel",
								"type":        "gauge",
								"description": "Gauge description",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[1].Meta.Created,
								Updated:             result.Result.Elements[1].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and typeFilter is set to a nonexistent type, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreateCommandWithModel(sc.folder.ID, sc.folder.UID, "Gauge - Library Panel", model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Gauge - Library Panel",
			  "type": "gauge",
			  "description": "Gauge description"
			}
		`))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("typeFilter", "unknown1,unknown2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Page:       1,
					PerPage:    100,
					Elements:   []libraryElement{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and folderFilterUIDs is set to existing folders, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolder(t, sc, "NewFolder", nil)
			// nolint:staticcheck
			command := getCreatePanelCommand(newFolder.ID, newFolder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			folderFilterUID := newFolder.UID
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("folderFilterUIDs", folderFilterUID)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)

			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    newFolder.ID, // nolint:staticcheck
							FolderUID:   newFolder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "NewFolder",
								FolderUID:           newFolder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and folderFilter is set to a nonexistent folders, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			newFolder := createFolder(t, sc, "NewFolder", nil)
			// nolint:staticcheck
			command := getCreatePanelCommand(newFolder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			folderFilterUIDs := "2020,2021"

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("folderFilterUIDs", folderFilterUIDs)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Page:       1,
					PerPage:    100,
					Elements:   []libraryElement{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and folderFilter is set to General folder, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			folderFilter := "0"

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("folderFilter", folderFilter)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[1].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[1].Meta.Created,
								Updated:             result.Result.Elements[1].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and excludeUID is set, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("excludeUid", sc.initialResult.Result.UID)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    1,
					Elements: []libraryElement{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 2, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       2,
					PerPage:    1,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and searchString exists in the description, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreateCommandWithModel(sc.folder.ID, sc.folder.UID, "Text - Library Panel2", model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "Some other d e s c r i p t i o n"
			}
		`))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "1")
			sc.reqContext.Req.Form.Add("searchString", "DeScRiPtIoN") // mixed case to test case-insensitive search.
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, int64(1), result.Result.TotalCount)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    1,
					Elements: []libraryElement{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and searchString exists in both name and description, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreateCommandWithModel(sc.folder.ID, sc.folder.UID, "Some Other", model.PanelElement, []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A Library Panel"
			}
		`))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "library PANEL") // mixed-case to test case-insensitive search.
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, int64(2), result.Result.TotalCount)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Some Other",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A Library Panel",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A Library Panel",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[1].UID,
							Name:        "Text - Library Panel",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[1].Meta.Created,
								Updated:             result.Result.Elements[1].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 1 and searchString is panel2, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "1")
			sc.reqContext.Req.Form.Add("searchString", "panel2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    1,
					Elements: []libraryElement{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1, // nolint:staticcheck
							FolderUID:   sc.folder.UID,
							UID:         result.Result.Elements[0].UID,
							Name:        "Text - Library Panel2",
							Kind:        int64(model.PanelElement),
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel",
								"type":        "text",
							},
							Version: 1,
							Meta: model.LibraryElementDTOMeta{
								FolderName:          "ScenarioFolder",
								FolderUID:           sc.folder.UID,
								ConnectedDashboards: 0,
								Created:             result.Result.Elements[0].Meta.Created,
								Updated:             result.Result.Elements[0].Meta.Updated,
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
						},
					},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 3 and searchString is panel, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "3")
			sc.reqContext.Req.Form.Add("searchString", "panel")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 2,
					Page:       3,
					PerPage:    1,
					Elements:   []libraryElement{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 3 and searchString does not exist, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Text - Library Panel2")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "3")
			sc.reqContext.Req.Form.Add("searchString", "monkey")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Page:       3,
					PerPage:    1,
					Elements:   []libraryElement{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithPanel(t, "When an admin tries to get all library panels in a different org, none should be returned",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, 1, len(result.Result.Elements))
			// nolint:staticcheck
			require.Equal(t, int64(1), result.Result.Elements[0].FolderID)
			require.Equal(t, "Text - Library Panel", result.Result.Elements[0].Name)

			sc.reqContext.OrgID = 2
			sc.reqContext.OrgRole = org.RoleAdmin
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			result = libraryElementsSearch{}
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryElementsSearch{
				Result: libraryElementsSearchResult{
					TotalCount: 0,
					Elements:   []libraryElement{},
					Page:       1,
					PerPage:    100,
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	// Folder name search integration tests
	scenarioWithPanel(t, "When searching by folder name, it should return panels in that folder",
		func(t *testing.T, sc scenarioContext) {
			// Create a panel in the existing folder
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Panel in ScenarioFolder")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// Search by folder name
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "ScenarioFolder")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)

			// Should find panels in the "ScenarioFolder" folder
			require.Greater(t, len(result.Result.Elements), 0, "Should find panels when searching by folder name")

			// All returned panels should be in the ScenarioFolder
			for _, element := range result.Result.Elements {
				require.Equal(t, "ScenarioFolder", element.Meta.FolderName, "All panels should be in ScenarioFolder")
			}
		})

	scenarioWithPanel(t, "When searching by folder name that doesn't exist, it should return no results",
		func(t *testing.T, sc scenarioContext) {
			// Search by non-existent folder name
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "NonExistentFolder")
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)

			// Should return no results for non-existent folder
			require.Equal(t, int64(0), result.Result.TotalCount, "Should return no results for non-existent folder")
			require.Equal(t, 0, len(result.Result.Elements), "Should return empty elements array")
		})

	scenarioWithPanel(t, "When searching with folder filter applied, folder name search should be disabled",
		func(t *testing.T, sc scenarioContext) {
			// Create a panel in the existing folder
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Panel for folder filter test")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// Search with both searchString and folderFilterUIDs
			// This should NOT search folder names, only panel names/descriptions within the specified folder
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "ScenarioFolder")
			sc.reqContext.Req.Form.Add("folderFilterUIDs", sc.folder.UID)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)

			// Should not find panels by folder name when folder filter is applied
			// Only panels with "ScenarioFolder" in their name/description should be found
			for _, element := range result.Result.Elements {
				nameOrDescriptionMatch := element.Name == "ScenarioFolder" || element.Description == "ScenarioFolder"
				require.True(t, nameOrDescriptionMatch, "With folder filter, should only match panel name/description, not folder name")
			}
		})

	scenarioWithPanel(t, "When searching by partial folder name, it should return panels in matching folders",
		func(t *testing.T, sc scenarioContext) {
			// Create a panel in the existing folder
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Test Panel")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// Search by partial folder name
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "Scenario")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)

			// Should find panels in folders with names containing "Scenario"
			found := false
			for _, element := range result.Result.Elements {
				if element.Meta.FolderName == "ScenarioFolder" {
					found = true
					break
				}
			}
			require.True(t, found, "Should find panels in folders matching partial name")
		})

	scenarioWithPanel(t, "When searching combines panel name and folder name matches, it should return both",
		func(t *testing.T, sc scenarioContext) {
			// Create a panel with a specific name
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Marketing Report Panel")
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			// Search for "Marketing" which could match both panel name and folder name
			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "Marketing")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryElementsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)

			// Should find the panel we just created with "Marketing" in its name
			found := false
			for _, element := range result.Result.Elements {
				if element.Name == "Marketing Report Panel" {
					found = true
					break
				}
			}
			require.True(t, found, "Should find panel with matching name")
		})
}
