package librarypanels

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/search"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestGetAllLibraryPanels(t *testing.T) {
	testScenario(t, "When an admin tries to get all library panels and none exists, it should return none",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount:    0,
					LibraryPanels: []libraryPanel{},
					Page:          1,
					PerPage:       100,
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					LibraryPanels: []libraryPanel{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
							},
						},
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[1].UID,
							Name:        "Text - Library Panel2",
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel2",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[1].Meta.Created,
								Updated:             result.Result.LibraryPanels[1].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and sort desc is set, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("sortDirection", search.SortAlphaDesc.Name)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					LibraryPanels: []libraryPanel{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel2",
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel2",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
							},
						},
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[1].UID,
							Name:        "Text - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[1].Meta.Created,
								Updated:             result.Result.LibraryPanels[1].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and panelFilter is set to existing types, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommandWithModel(sc.folder.Id, "Gauge - Library Panel", []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Gauge - Library Panel",
			  "type": "gauge",
			  "description": "Gauge description"
			}
		`))
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			command = getCreateCommandWithModel(sc.folder.Id, "BarGauge - Library Panel", []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "BarGauge - Library Panel",
			  "type": "bargauge",
			  "description": "BarGauge description"
			}
		`))
			resp = sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("panelFilter", "bargauge,gauge")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					LibraryPanels: []libraryPanel{
						{
							ID:          3,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "BarGauge - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
							},
						},
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[1].UID,
							Name:        "Gauge - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[1].Meta.Created,
								Updated:             result.Result.LibraryPanels[1].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and panelFilter is set to non existing type, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommandWithModel(sc.folder.Id, "Gauge - Library Panel", []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Gauge - Library Panel",
			  "type": "gauge",
			  "description": "Gauge description"
			}
		`))
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("panelFilter", "unknown1,unknown2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount:    0,
					Page:          1,
					PerPage:       100,
					LibraryPanels: []libraryPanel{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and excludeUID is set, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("excludeUid", sc.initialResult.Result.UID)
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    100,
					LibraryPanels: []libraryPanel{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel2",
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel2",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    1,
					LibraryPanels: []libraryPanel{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 2, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       2,
					PerPage:    1,
					LibraryPanels: []libraryPanel{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel2",
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel2",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and searchString exists in the description, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommandWithModel(sc.folder.Id, "Text - Library Panel2", []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "Some other d e s c r i p t i o n"
			}
		`))
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "1")
			sc.reqContext.Req.Form.Add("searchString", "description")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    1,
					LibraryPanels: []libraryPanel{
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and searchString exists in both name and description, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommandWithModel(sc.folder.Id, "Some Other", []byte(`
			{
			  "datasource": "${DS_GDEV-TESTDATA}",
			  "id": 1,
			  "title": "Text - Library Panel",
			  "type": "text",
			  "description": "A Library Panel"
			}
		`))
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("searchString", "Library Panel")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 2,
					Page:       1,
					PerPage:    100,
					LibraryPanels: []libraryPanel{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Some Other",
							Type:        "text",
							Description: "A Library Panel",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A Library Panel",
								"id":          float64(1),
								"title":       "Some Other",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
							},
						},
						{
							ID:          1,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[1].UID,
							Name:        "Text - Library Panel",
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
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[1].Meta.Created,
								Updated:             result.Result.LibraryPanels[1].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 1 and searchString is panel2, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "1")
			sc.reqContext.Req.Form.Add("searchString", "panel2")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount: 1,
					Page:       1,
					PerPage:    1,
					LibraryPanels: []libraryPanel{
						{
							ID:          2,
							OrgID:       1,
							FolderID:    1,
							UID:         result.Result.LibraryPanels[0].UID,
							Name:        "Text - Library Panel2",
							Type:        "text",
							Description: "A description",
							Model: map[string]interface{}{
								"datasource":  "${DS_GDEV-TESTDATA}",
								"description": "A description",
								"id":          float64(1),
								"title":       "Text - Library Panel2",
								"type":        "text",
							},
							Version: 1,
							Meta: LibraryPanelDTOMeta{
								CanEdit:             true,
								ConnectedDashboards: 0,
								Created:             result.Result.LibraryPanels[0].Meta.Created,
								Updated:             result.Result.LibraryPanels[0].Meta.Updated,
								CreatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
								},
								UpdatedBy: LibraryPanelDTOMetaUser{
									ID:        1,
									Name:      UserInDbName,
									AvatarUrl: UserInDbAvatar,
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

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 3 and searchString is panel, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "3")
			sc.reqContext.Req.Form.Add("searchString", "panel")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount:    2,
					Page:          3,
					PerPage:       1,
					LibraryPanels: []libraryPanel{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist and perPage is 1 and page is 3 and searchString does not exist, it should succeed and the result should be correct",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			err := sc.reqContext.Req.ParseForm()
			require.NoError(t, err)
			sc.reqContext.Req.Form.Add("perPage", "1")
			sc.reqContext.Req.Form.Add("page", "3")
			sc.reqContext.Req.Form.Add("searchString", "monkey")
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount:    0,
					Page:          3,
					PerPage:       1,
					LibraryPanels: []libraryPanel{},
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist but only one is connected, it should succeed and return correct connected dashboards",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)

			sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": "1"})
			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": result.Result.UID, ":dashboardId": "2"})
			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var results libraryPanelsSearch
			err := json.Unmarshal(resp.Body(), &results)
			require.NoError(t, err)
			require.Equal(t, int64(0), results.Result.LibraryPanels[0].Meta.ConnectedDashboards)
			require.Equal(t, int64(2), results.Result.LibraryPanels[1].Meta.ConnectedDashboards)
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels in a different org, none should be returned",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsSearch
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, 1, len(result.Result.LibraryPanels))
			require.Equal(t, int64(1), result.Result.LibraryPanels[0].FolderID)
			require.Equal(t, "Text - Library Panel", result.Result.LibraryPanels[0].Name)

			sc.reqContext.SignedInUser.OrgId = 2
			sc.reqContext.SignedInUser.OrgRole = models.ROLE_ADMIN
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			result = libraryPanelsSearch{}
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsSearch{
				Result: libraryPanelsSearchResult{
					TotalCount:    0,
					LibraryPanels: []libraryPanel{},
					Page:          1,
					PerPage:       100,
				},
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
}
