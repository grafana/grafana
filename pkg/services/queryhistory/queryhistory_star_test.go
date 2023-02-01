package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestIntegrationStarQueryInQueryHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testScenarioWithQueryInQueryHistory(t, "When users tries to star query in query history that does not exists, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to star query in query history that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to star query that is already starred, it should fail",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.service.starHandler(sc.reqContext)
			resp := sc.service.starHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})
}
