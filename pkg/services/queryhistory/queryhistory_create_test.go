package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationCreateQueryInQueryHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testScenario(t, "When users tries to create query in query history it should succeed", true, true,
		func(t *testing.T, sc scenarioContext) {
			command := CreateQueryInQueryHistoryCommand{
				DatasourceUID: "NCzh67i",
				Queries: simplejson.NewFromAny(map[string]any{
					"expr": "test",
				}),
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			permissionsMiddlewareCallback := sc.service.permissionsMiddleware(sc.service.createHandler, "Failed to create query history")

			resp := permissionsMiddlewareCallback(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})

	testScenario(t, "When users tries to create query in query history without permissions it should fail", true, false,
		func(t *testing.T, sc scenarioContext) {
			command := CreateQueryInQueryHistoryCommand{
				DatasourceUID: "NCzh67i",
				Queries: simplejson.NewFromAny(map[string]any{
					"expr": "test",
				}),
			}

			sc.reqContext.Req.Body = mockRequestBody(command)
			permissionsMiddlewareCallback := sc.service.permissionsMiddleware(sc.service.createHandler, "Failed to create query history")

			resp := permissionsMiddlewareCallback(sc.reqContext)
			require.Equal(t, 401, resp.Status())
		})
}
