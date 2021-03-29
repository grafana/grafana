package librarypanels

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestGetLibraryPanel(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to get a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": "unknown"})
			resp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get a library panel that exists, it should succeed and return correct result",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getHandler(sc.reqContext)
			var result = validateAndUnMarshalResponse(t, resp)
			var expected = libraryPanelResult{
				Result: libraryPanel{
					ID:          1,
					OrgID:       1,
					FolderID:    1,
					UID:         result.Result.UID,
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
						Created:             result.Result.Meta.Created,
						Updated:             result.Result.Meta.Updated,
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
			}
			if diff := cmp.Diff(expected, result, getCompareOptions()...); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get a library panel that exists in an other org, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			sc.reqContext.SignedInUser.OrgId = 2
			sc.reqContext.SignedInUser.OrgRole = models.ROLE_ADMIN
			resp := sc.service.getHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get a library panel with 2 connected dashboards, it should succeed and return correct connected dashboards",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "1"})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "2"})
			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp = sc.service.getHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			var result = validateAndUnMarshalResponse(t, resp)
			require.Equal(t, int64(2), result.Result.Meta.ConnectedDashboards)
		})
}
