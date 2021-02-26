package librarypanels

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestGetAllLibraryPanels(t *testing.T) {
	testScenario(t, "When an admin tries to get all library panels and none exists, it should return none",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsResult
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 0, len(result.Result))
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels and two exist, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := getCreateCommand(sc.folder.Id, "Text - Library Panel2")
			resp := sc.service.createHandler(sc.reqContext, command)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsResult
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			var expected = libraryPanelsResult{
				Result: []libraryPanel{
					{
						ID:       1,
						OrgID:    1,
						FolderID: 1,
						UID:      result.Result[0].UID,
						Name:     "Text - Library Panel",
						Model: map[string]interface{}{
							"datasource": "${DS_GDEV-TESTDATA}",
							"id":         float64(1),
							"title":      "Text - Library Panel",
							"type":       "text",
						},
						Meta: LibraryPanelDTOMeta{
							CanEdit:             true,
							ConnectedDashboards: 0,
							Created:             result.Result[0].Meta.Created,
							Updated:             result.Result[0].Meta.Updated,
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
						ID:       2,
						OrgID:    1,
						FolderID: 1,
						UID:      result.Result[1].UID,
						Name:     "Text - Library Panel2",
						Model: map[string]interface{}{
							"datasource": "${DS_GDEV-TESTDATA}",
							"id":         float64(1),
							"title":      "Text - Library Panel2",
							"type":       "text",
						},
						Meta: LibraryPanelDTOMeta{
							CanEdit:             true,
							ConnectedDashboards: 0,
							Created:             result.Result[1].Meta.Created,
							Updated:             result.Result[1].Meta.Updated,
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

			var results libraryPanelsResult
			err := json.Unmarshal(resp.Body(), &results)
			require.NoError(t, err)
			require.Equal(t, int64(0), results.Result[0].Meta.ConnectedDashboards)
			require.Equal(t, int64(2), results.Result[1].Meta.ConnectedDashboards)
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get all library panels in a different org, none should be returned",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result libraryPanelsResult
			err := json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.Equal(t, 1, len(result.Result))
			require.Equal(t, int64(1), result.Result[0].FolderID)
			require.Equal(t, "Text - Library Panel", result.Result[0].Name)

			sc.reqContext.SignedInUser.OrgId = 2
			sc.reqContext.SignedInUser.OrgRole = models.ROLE_ADMIN
			resp = sc.service.getAllHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			result = libraryPanelsResult{}
			err = json.Unmarshal(resp.Body(), &result)
			require.NoError(t, err)
			require.NotNil(t, result.Result)
			require.Equal(t, 0, len(result.Result))
		})
}
