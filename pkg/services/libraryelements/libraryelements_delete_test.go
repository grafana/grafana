package libraryelements

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestIntegration_DeleteLibraryElement(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	scenarioWithPanel(t, "When an admin tries to delete a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithPanel(t, "When an admin tries to delete a library panel that exists, it should succeed and return correct ID",
		func(t *testing.T, sc scenarioContext) {
			sc.dashboardSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, mock.Anything, mock.Anything).Return([]*dashboards.DashboardRef{}, nil)
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
			sc.defaultGetDashByLP.Unset()
			sc.dashboardSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, mock.Anything, mock.Anything).Return([]*dashboards.DashboardRef{
				{
					UID: "dash-1",
					ID:  1,
				},
			}, nil)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 403, resp.Status())
		})

	scenarioWithPanel(t, "When a non-admin user cannot see a connected dashboard, deletion should still be blocked",
		func(t *testing.T, sc scenarioContext) {
			sc.defaultGetDashByLP.Unset()
			// Downgrade user to Editor, so they can delete library panels but cannot see all folders/dashboards
			sc.reqContext.OrgRole = org.RoleEditor

			sc.dashboardSvc.On("GetDashboardsByLibraryPanelUID",
				mock.MatchedBy(func(ctx context.Context) bool {
					return identity.IsServiceIdentity(ctx)
				}),
				mock.Anything, mock.Anything,
			).Return([]*dashboards.DashboardRef{
				{UID: "hidden-dash", ID: 42},
			}, nil)

			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 403, resp.Status())
		})
}
