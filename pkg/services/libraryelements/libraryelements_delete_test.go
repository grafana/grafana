package libraryelements

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

func TestIntegration_DeleteLibraryElement(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	scenarioWithPanel(t, "When an admin tries to delete a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that exists, it should succeed and return correct ID",
		func(t *testing.T, sc scenarioContext) {
			sc.dashboardSvc.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil)
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
			sc.reqContext.OrgID = 2
			sc.reqContext.OrgRole = org.RoleAdmin
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that is connected, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.dashboardSvc.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{
				{
					ID:  1,
					UID: "test",
				},
			}, nil)
			// nolint:staticcheck
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, 1)
			require.NoError(t, err)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 403, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that is connected to a non-existent dashboard, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.dashboardSvc.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{}, nil)
			err := sc.service.ConnectElementsToDashboard(sc.reqContext.Req.Context(), sc.reqContext.SignedInUser, []string{sc.initialResult.Result.UID}, 9999999)
			require.NoError(t, err)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}
