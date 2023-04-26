package queryhistory

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestIntegrationMigrateQueriesToQueryHistory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testScenario(t, "When users tries to migrate 1 query in query history it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := MigrateQueriesToQueryHistoryCommand{
				Queries: []QueryToMigrate{
					{
						DatasourceUID: "NCzh67i",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test",
						}),
						Comment:   "",
						Starred:   false,
						CreatedAt: sc.service.now().Unix(),
					},
				},
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.migrateHandler(sc.reqContext)
			var response QueryHistoryMigrationResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, "Query history successfully migrated", response.Message)
			require.Equal(t, 1, response.TotalCount)
			require.Equal(t, 0, response.StarredCount)
		})

	testScenario(t, "When users tries to migrate multiple queries in query history it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := MigrateQueriesToQueryHistoryCommand{
				Queries: []QueryToMigrate{
					{
						DatasourceUID: "NCzh67i",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test1",
						}),
						Comment:   "",
						Starred:   false,
						CreatedAt: sc.service.now().Unix(),
					},
					{
						DatasourceUID: "NCzh67i",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test2",
						}),
						Comment:   "",
						Starred:   false,
						CreatedAt: sc.service.now().Unix() - int64(100),
					},
					{
						DatasourceUID: "ABch68f",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test3",
						}),
						Comment:   "",
						Starred:   false,
						CreatedAt: sc.service.now().Unix() - int64(1000),
					},
				},
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.migrateHandler(sc.reqContext)
			var response QueryHistoryMigrationResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, "Query history successfully migrated", response.Message)
			require.Equal(t, 3, response.TotalCount)
			require.Equal(t, 0, response.StarredCount)
		})

	testScenario(t, "When users tries to migrate starred and not starred query in query history it should succeed",
		func(t *testing.T, sc scenarioContext) {
			command := MigrateQueriesToQueryHistoryCommand{
				Queries: []QueryToMigrate{
					{
						DatasourceUID: "NCzh67i",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test1",
						}),
						Comment:   "",
						Starred:   true,
						CreatedAt: sc.service.now().Unix(),
					},
					{
						DatasourceUID: "NCzh67i",
						Queries: simplejson.NewFromAny(map[string]interface{}{
							"expr": "test2",
						}),
						Comment:   "",
						Starred:   false,
						CreatedAt: sc.service.now().Unix() - int64(100),
					},
				},
			}
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.migrateHandler(sc.reqContext)
			var response QueryHistoryMigrationResponse
			err := json.Unmarshal(resp.Body(), &response)
			require.NoError(t, err)
			require.Equal(t, 200, resp.Status())
			require.Equal(t, "Query history successfully migrated", response.Message)
			require.Equal(t, 2, response.TotalCount)
			require.Equal(t, 1, response.StarredCount)
		})
}
