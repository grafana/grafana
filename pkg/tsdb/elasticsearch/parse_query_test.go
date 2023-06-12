package elasticsearch

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseQuery(t *testing.T) {
	t.Run("Test parse query", func(t *testing.T) {
		t.Run("Should be able to parse query", func(t *testing.T) {
			body := `{
				"query": "@metric:cpu",
				"alias": "{{@hostname}} {{metric}}",
        		"interval": "10m",
				"metrics": [
					{
						"field": "@value",
						"id": "1",
						"meta": {},
						"settings": {
							"percents": [
								"90"
							]
						},
						"type": "percentiles"
					},
					{
						"type": "count",
						"field": "select field",
						"id": "4",
						"settings": {},
						"meta": {}
					}
				],
				"bucketAggs": [
					{
						"fake": true,
						"field": "@hostname",
						"id": "3",
						"settings": {
							"min_doc_count": 1,
							"order": "desc",
							"orderBy": "_term",
							"size": "10"
						},
						"type": "terms"
					},
					{
						"field": "@timestamp",
						"id": "2",
						"settings": {
							"interval": "5m",
							"min_doc_count": 0,
							"trimEdges": 0
						},
						"type": "date_histogram"
					}
				]
			}`
			dataQuery, err := newDataQuery(body)
			require.NoError(t, err)
			queries, err := parseQuery(dataQuery.Queries)
			require.NoError(t, err)
			require.Len(t, queries, 1)

			q := queries[0]

			require.Equal(t, q.RawQuery, "@metric:cpu")
			require.Equal(t, q.Alias, "{{@hostname}} {{metric}}")
			require.Equal(t, q.Interval.String(), "10s")

			require.Len(t, q.Metrics, 2)
			require.Equal(t, q.Metrics[0].Field, "@value")
			require.Equal(t, q.Metrics[0].ID, "1")
			require.Equal(t, q.Metrics[0].Type, "percentiles")
			require.False(t, q.Metrics[0].Hide)
			require.Equal(t, q.Metrics[0].PipelineAggregate, "")
			require.Equal(t, q.Metrics[0].Settings.Get("percents").MustStringArray()[0], "90")

			require.Equal(t, q.Metrics[1].Field, "select field")
			require.Equal(t, q.Metrics[1].ID, "4")
			require.Equal(t, q.Metrics[1].Type, "count")
			require.False(t, q.Metrics[1].Hide)
			require.Equal(t, q.Metrics[1].PipelineAggregate, "")
			require.Empty(t, q.Metrics[1].Settings.MustMap())

			require.Len(t, q.BucketAggs, 2)
			require.Equal(t, q.BucketAggs[0].Field, "@hostname")
			require.Equal(t, q.BucketAggs[0].ID, "3")
			require.Equal(t, q.BucketAggs[0].Type, "terms")
			require.Equal(t, q.BucketAggs[0].Settings.Get("min_doc_count").MustInt(), 1)
			require.Equal(t, q.BucketAggs[0].Settings.Get("order").MustString(), "desc")
			require.Equal(t, q.BucketAggs[0].Settings.Get("orderBy").MustString(), "_term")
			require.Equal(t, q.BucketAggs[0].Settings.Get("size").MustString(), "10")

			require.Equal(t, q.BucketAggs[1].Field, "@timestamp")
			require.Equal(t, q.BucketAggs[1].ID, "2")
			require.Equal(t, q.BucketAggs[1].Type, "date_histogram")
			require.Equal(t, q.BucketAggs[1].Settings.Get("interval").MustString(), "5m")
			require.Equal(t, q.BucketAggs[1].Settings.Get("min_doc_count").MustInt(), 0)
			require.Equal(t, q.BucketAggs[1].Settings.Get("trimEdges").MustInt(), 0)
		})
	})
}
