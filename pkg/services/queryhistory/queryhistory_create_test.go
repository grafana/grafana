//go:build integration
// +build integration

package queryhistory

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

func TestIntegrationCreateQueryInQueryHistory(t *testing.T) {
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
