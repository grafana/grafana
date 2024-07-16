package queryhistory

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

var mixedQuery []byte = []byte(`[{"alias":"","bucketAggs":[{"field":"@timestamp","id":"2","settings":{"interval":"auto"},"type":"date_histogram"}],"datasource":{"type":"elasticsearch","uid":"gdev-elasticsearch"},"key":"Q-15d3139f-a942-491c-8fb6-46982475ab07-0","metrics":[{"id":"1","type":"count"}],"query":"test","refId":"A","timeField":"@timestamp"},{"datasource":{"type":"loki","uid":"gdev-loki"},"editorMode":"code","expr":"test","key":"Q-67b4a119-37dd-4276-beac-4ec76b089f10-0","queryType":"range","refId":"B"}]`)
var mixedQueryWithDuplicates = []byte(`[{"alias":"","bucketAggs":[{"field":"@timestamp","id":"2","settings":{"interval":"auto"},"type":"date_histogram"}],"datasource":{"type":"elasticsearch","uid":"gdev-elasticsearch"},"key":"Q-15d3139f-a942-491c-8fb6-46982475ab07-0","metrics":[{"id":"1","type":"count"}],"query":"test","refId":"A","timeField":"@timestamp"},{"datasource":{"type":"loki","uid":"gdev-loki"},"editorMode":"code","expr":"test","key":"Q-67b4a119-37dd-4276-beac-4ec76b089f10-0","queryType":"range","refId":"B"},{"datasource":{"type":"loki","uid":"gdev-loki"},"editorMode":"code","expr":"test2","key":"Q-28825351-32c3-4c46-98b4-b8cfffae0b42-2","queryType":"range","refId":"C"}]`)
var nonMixedQuery = []byte(`[{"datasource":{"type":"loki","uid":"gdev-loki"},"editorMode":"code","expr":"test","key":"Q-95a6d6ef-7a5e-4e2a-a212-f1f2df4a349a-0","queryType":"range","refId":"A"},{"datasource":{"type":"loki","uid":"gdev-loki"},"editorMode":"code","expr":"test 2","key":"Q-b838fc6b-bcd7-4538-962a-d35209a8783f-1","queryType":"range","refId":"B"}]`)
var mixedQueryMissingDatasource = []byte(`[{"alias":"","bucketAggs":[{"field":"@timestamp","id":"2","settings":{"interval":"auto"},"type":"date_histogram"}],"key":"Q-15d3139f-a942-491c-8fb6-46982475ab07-0","metrics":[{"id":"1","type":"count"}],"query":"test","refId":"A","timeField":"@timestamp"},{"datasource":{"type":"loki","uid":"PDDA8E780A17E7EF1"},"editorMode":"code","expr":"test","key":"Q-67b4a119-37dd-4276-beac-4ec76b089f10-0","queryType":"range","refId":"B"}]`)
var mixedQueryMissingUID = []byte(`[{"alias":"","bucketAggs":[{"field":"@timestamp","id":"2","settings":{"interval":"auto"},"type":"date_histogram"}],"datasource":{"type":"elasticsearch"},"key":"Q-15d3139f-a942-491c-8fb6-46982475ab07-0","metrics":[{"id":"1","type":"count"}],"query":"test","refId":"A","timeField":"@timestamp"},{"datasource":{"type":"loki","uid":"PDDA8E780A17E7EF1"},"editorMode":"code","expr":"test","key":"Q-67b4a119-37dd-4276-beac-4ec76b089f10-0","queryType":"range","refId":"B"}]`)
var invalidJSON = []byte(`{`)

func TestQueryHistoryDetails(t *testing.T) {
	t.Run("should return error when json is invalid", func(t *testing.T) {
		json, _ := simplejson.NewJson(invalidJSON)
		_, err := FindDataSourceUIDs(json)
		require.Error(t, err)
	})

	t.Run("should return no error when data source uid is missing", func(t *testing.T) {
		json, _ := simplejson.NewJson(mixedQueryMissingUID)
		_, err := FindDataSourceUIDs(json)
		require.NoError(t, err)
	})

	t.Run("should return no error when data source property is missing", func(t *testing.T) {
		json, _ := simplejson.NewJson(mixedQueryMissingDatasource)
		_, err := FindDataSourceUIDs(json)
		require.NoError(t, err)
	})

	t.Run("should find data source uids in mixed queries", func(t *testing.T) {
		json, _ := simplejson.NewJson(mixedQuery)
		uids, err := FindDataSourceUIDs(json)
		require.NoError(t, err)
		require.Len(t, uids, 2)
		require.Equal(t, uids[0], "gdev-elasticsearch")
		require.Equal(t, uids[1], "gdev-loki")
	})

	t.Run("should find data source uids in non-mixed queries", func(t *testing.T) {
		json, _ := simplejson.NewJson(nonMixedQuery)
		uids, err := FindDataSourceUIDs(json)
		require.NoError(t, err)
		require.Len(t, uids, 1)
		require.Equal(t, uids[0], "gdev-loki")
	})

	t.Run("should remove duplicated uids", func(t *testing.T) {
		json, _ := simplejson.NewJson(mixedQueryWithDuplicates)
		uids, err := FindDataSourceUIDs(json)
		require.NoError(t, err)
		require.Len(t, uids, 2)
		require.Equal(t, uids[0], "gdev-elasticsearch")
		require.Equal(t, uids[1], "gdev-loki")
	})
}
