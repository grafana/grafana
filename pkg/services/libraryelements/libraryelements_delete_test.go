package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestDeleteLibraryElement(t *testing.T) {
	scenarioWithPanel(t, "When an admin tries to delete a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that exists, it should succeed and return correct ID",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var result model.DeleteLibraryElementResponse
			err := json.Unmarshal(resp.Body(), &result)

			require.NoError(t, err)
			require.Equal(t, sc.initialResult.Result.ID, result.ID)
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel in another org, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.reqContext.SignedInUser.OrgID = 2
			sc.reqContext.SignedInUser.OrgRole = org.RoleAdmin
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that is connected, it should fail",
		func(t *testing.T, sc scenarioContext) {
			dashJSON := map[string]any{
				"panels": []any{
					map[string]any{
						"id": int64(1),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 0,
							"y": 0,
						},
					},
					map[string]any{
						"id": int64(2),
						"gridPos": map[string]any{
							"h": 6,
							"w": 6,
							"x": 6,
							"y": 0,
						},
						"libraryPanel": map[string]any{
							"uid":  sc.initialResult.Result.UID,
							"name": sc.initialResult.Result.Name,
						},
					},
				},
			}
			dash := dashboards.Dashboard{
				Title: "Testing deleteHandler ",
				Data:  simplejson.NewFromAny(dashJSON),
			}
			// nolint:staticcheck
			dashInDB := createDashboard(t, sc.sqlStore, sc.user, &dash, sc.folder.ID, sc.folder.UID)
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, dashInDB.ID)
			require.NoError(t, err)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 403, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that is connected to a non-existent dashboard, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, 9999999)
			require.NoError(t, err)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}
