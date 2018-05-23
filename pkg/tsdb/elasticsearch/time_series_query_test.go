package elasticsearch

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTimeSeriesQueryParser(t *testing.T) {
	Convey("Test time series query parser", t, func() {
		ds := &models.DataSource{}
		p := newTimeSeriesQueryParser(ds)

		Convey("Should be able to parse query", func() {
			json, err := simplejson.NewJson([]byte(`{
				"timeField": "@timestamp",
				"query": "@metric:cpu",
				"alias": "{{@hostname}} {{metric}}",
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
			}`))
			So(err, ShouldBeNil)
			tsdbQuery := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						DataSource: ds,
						Model:      json,
					},
				},
			}
			tsQuery, err := p.parse(tsdbQuery)
			So(err, ShouldBeNil)
			So(tsQuery.queries, ShouldHaveLength, 1)

			q := tsQuery.queries[0]

			So(q.TimeField, ShouldEqual, "@timestamp")
			So(q.RawQuery, ShouldEqual, "@metric:cpu")
			So(q.Alias, ShouldEqual, "{{@hostname}} {{metric}}")

			So(q.Metrics, ShouldHaveLength, 2)
			So(q.Metrics[0].Field, ShouldEqual, "@value")
			So(q.Metrics[0].ID, ShouldEqual, "1")
			So(q.Metrics[0].Type, ShouldEqual, "percentiles")
			So(q.Metrics[0].Hide, ShouldBeFalse)
			So(q.Metrics[0].PipelineAggregate, ShouldEqual, "")
			So(q.Metrics[0].Settings.Get("percents").MustStringArray()[0], ShouldEqual, "90")

			So(q.Metrics[1].Field, ShouldEqual, "select field")
			So(q.Metrics[1].ID, ShouldEqual, "4")
			So(q.Metrics[1].Type, ShouldEqual, "count")
			So(q.Metrics[1].Hide, ShouldBeFalse)
			So(q.Metrics[1].PipelineAggregate, ShouldEqual, "")
			So(q.Metrics[1].Settings.MustMap(), ShouldBeEmpty)

			So(q.BucketAggs, ShouldHaveLength, 2)
			So(q.BucketAggs[0].Field, ShouldEqual, "@hostname")
			So(q.BucketAggs[0].ID, ShouldEqual, "3")
			So(q.BucketAggs[0].Type, ShouldEqual, "terms")
			So(q.BucketAggs[0].Settings.Get("min_doc_count").MustInt64(), ShouldEqual, 1)
			So(q.BucketAggs[0].Settings.Get("order").MustString(), ShouldEqual, "desc")
			So(q.BucketAggs[0].Settings.Get("orderBy").MustString(), ShouldEqual, "_term")
			So(q.BucketAggs[0].Settings.Get("size").MustString(), ShouldEqual, "10")

			So(q.BucketAggs[1].Field, ShouldEqual, "@timestamp")
			So(q.BucketAggs[1].ID, ShouldEqual, "2")
			So(q.BucketAggs[1].Type, ShouldEqual, "date_histogram")
			So(q.BucketAggs[1].Settings.Get("interval").MustString(), ShouldEqual, "5m")
			So(q.BucketAggs[1].Settings.Get("min_doc_count").MustInt64(), ShouldEqual, 0)
			So(q.BucketAggs[1].Settings.Get("trimEdges").MustInt64(), ShouldEqual, 0)
		})
	})
}
