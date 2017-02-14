package elasticsearch

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestElasticGetPreferredNamesForQuery(t *testing.T) {
	Convey("Test Elasticsearch getPreferredNamesForQueries", t, func() {
		Convey("Get Name with No Alias", func() {
			testModelJSON := `
		{
					"metrics": [
						{
							"field": "value",
							"id": "1",
							"type": "avg"
						},
						{
							"field": "1",
							"id": "3",
							"pipelineAgg": "1",
							"type": "moving_avg"
						}
					]
		}`
			queries := &tsdb.Query{}
			var err error
			queries.Model, err = simplejson.NewJson([]byte(testModelJSON))
			So(err, ShouldBeNil)

			names := getPreferredNamesForQueries(queries)
			So(len(names), ShouldEqual, 2)
			So(names.GetName("3"), ShouldEqual, "Moving Average Average value")
			So(names.GetName("1"), ShouldEqual, "Average value")
			So(names.GetName("???"), ShouldEqual, "???")

		})

		Convey("Get Name with Alias", func() {
			testModelJSON := `
		{
		      "metrics": [
		        {
		          "field": "value",
		          "id": "1",
		          "type": "avg"
		        },
		        {
		          "field": "1",
		          "id": "3",
		          "pipelineAgg": "1",
		          "type": "moving_avg"
		        }
		      ],
					"alias": "overridden by alias"
		}`
			queries := &tsdb.Query{}
			var err error
			queries.Model, err = simplejson.NewJson([]byte(testModelJSON))
			So(err, ShouldBeNil)

			names := getPreferredNamesForQueries(queries)
			So(len(names), ShouldEqual, 2)
			So(names.GetName("3"), ShouldEqual, "overridden by alias")
			So(names.GetName("1"), ShouldEqual, "overridden by alias")
			So(names.GetName("???"), ShouldEqual, "???")
		})
	})
}

func TestElasticsearchGetIndexList(t *testing.T) {
	Convey("Test Elasticsearch getIndex ", t, func() {

		Convey("Single Day", func() {
			index := getIndex("[logstash-]YYYY.MM.DD", "Daily")
			So(index, ShouldEqual, "logstash-*")
		})

		Convey("No Interval", func() {
			index := getIndex("logstash-*", "")
			So(index, ShouldEqual, "logstash-*")
		})
	})
}
