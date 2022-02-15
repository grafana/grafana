package queryhistory

import (
	"testing"

	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestDeleteQueryFromQueryHistory(t *testing.T) {
	testScenarioWithQueryInQueryHistory(t, "When users tries to delete query in query history that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When users tries to delete query in query history that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			resp := sc.service.deleteHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}
