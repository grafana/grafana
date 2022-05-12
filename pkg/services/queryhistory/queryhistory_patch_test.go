//go:build integration
// +build integration

package queryhistory

import (
	"testing"

	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestIntegrationPatchQueryCommentInQueryHistory(t *testing.T) {
	testScenarioWithQueryInQueryHistory(t, "When user tries to patch comment of query in query history that does not exist, it should fail",
		func(t *testing.T, sc scenarioContext) {
			resp := sc.service.patchCommentHandler(sc.reqContext)
			require.Equal(t, 500, resp.Status())
		})

	testScenarioWithQueryInQueryHistory(t, "When user tries to patch comment of query in query history that exists, it should succeed",
		func(t *testing.T, sc scenarioContext) {
			cmd := PatchQueryCommentInQueryHistoryCommand{Comment: "test comment"}
			sc.ctx.Req = web.SetURLParams(sc.ctx.Req, map[string]string{":uid": sc.initialResult.Result.UID})
			sc.reqContext.Req.Body = mockRequestBody(cmd)
			resp := sc.service.patchCommentHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}
