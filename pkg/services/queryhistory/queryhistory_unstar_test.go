package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestIntegrationUnstarQueryInQueryHistory(t *testing.T) {
	// https://github.com/grafana/grafana-enterprise/actions/runs/15013574205/job/42191195390?pr=8583
	// https://github.com/grafana/grafana-enterprise/actions/runs/15019815803/job/42206085291?pr=8603
	t.Skip("Disabled due to flakiness or timeout with MySQL")

	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar query in query history that does not exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar starred query in query history, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.service.starHandler(sc.reqContext)
			resp := sc.service.unstarHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to unstar query in query history that is not starred, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.unstarHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})
}
