package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestIntegrationPatchQueryCommentInQueryHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
