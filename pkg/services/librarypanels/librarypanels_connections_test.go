package librarypanels

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConnectLibraryPanel(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to create a connection for a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": "unknown", ":dashboardId": "1"})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to create a connection that already exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "1"})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}

func TestDisconnectLibraryPanel(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to remove a connection with a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": "unknown", ":dashboardId": "1"})
			resp := sc.service.disconnectHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to remove a connection that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "1"})
			resp := sc.service.disconnectHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to remove a connection that does exist, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": "1"})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			resp = sc.service.disconnectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}

func TestGetConnectedDashboards(t *testing.T) {
	scenarioWithLibraryPanel(t, "When an admin tries to get connected dashboards for a library panel that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": "unknown"})
			resp := sc.service.getConnectedDashboardsHandler(sc.reqContext)
			require.Equal(t, 404, resp.Status())
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get connected dashboards for a library panel that exists, but has no connections, it should return none",
		func(t *testing.T, sc scenarioContext) {
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.getConnectedDashboardsHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var dashResult libraryPanelDashboardsResult
			err := json.Unmarshal(resp.Body(), &dashResult)
			require.NoError(t, err)
			require.Equal(t, 0, len(dashResult.Result))
		})

	scenarioWithLibraryPanel(t, "When an admin tries to get connected dashboards for a library panel that exists and has connections, it should return connected dashboard IDs",
		func(t *testing.T, sc scenarioContext) {
			firstDash := createDashboard(t, sc.user, "Dash 1", 0)
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": strconv.FormatInt(firstDash.Id, 10)})
			resp := sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
			secondDash := createDashboard(t, sc.user, "Dash 2", 0)
			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID, ":dashboardId": strconv.FormatInt(secondDash.Id, 10)})
			resp = sc.service.connectHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			sc.reqContext.ReplaceAllParams(map[string]string{":uid": sc.initialResult.Result.UID})
			resp = sc.service.getConnectedDashboardsHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())

			var dashResult libraryPanelDashboardsResult
			err := json.Unmarshal(resp.Body(), &dashResult)
			require.NoError(t, err)
			require.Equal(t, 2, len(dashResult.Result))
			require.Equal(t, firstDash.Id, dashResult.Result[0])
			require.Equal(t, secondDash.Id, dashResult.Result[1])
		})
}
