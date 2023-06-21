package queryhistory

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestIntegrationCreateQueryInQueryHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testScenario(t, "When users tries to create query in query history it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := CreateQueryInQueryHistoryCommand{
				DatasourceUID: "NCzh67i",
				Queries: simplejson.NewFromAny(map[string]interface{}{
					"expr": "test",
				}),
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		})
}
