package elasticsearch

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
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

func TestElasticSearchConstructor(t *testing.T) {
	Convey("Test ElasticSearch Constructor ", t, func() {
		ds := &models.DataSource{
			BasicAuth:         true,
			BasicAuthUser:     "test-user",
			BasicAuthPassword: "test-password",
		}

		e, err := NewElasticsearchExecutor(ds)
		So(err, ShouldBeNil)

		var ctx context.Context
		result := e.Execute(ctx, nil, nil)
		So(result.Error, ShouldNotBeNil)

		modelJson, _ := simplejson.NewJson([]byte(`{}`))

		jsonData, _ := simplejson.NewJson([]byte(`{"esVersion":2, "interval": "Daily"}`))
		queryContext := &tsdb.QueryContext{
			Queries: tsdb.QuerySlice{
				{
					RefId: "A",
					DataSource: &models.DataSource{
						Url:               "http://test",
						Database:          "[test-index-]YYYY.MM.DD",
						Id:                1,
						JsonData:          jsonData,
						BasicAuth:         true,
						BasicAuthUser:     "test-user",
						BasicAuthPassword: "test-password",
					},
					Model: modelJson,
				},
			},
			TimeRange: &tsdb.TimeRange{
				From: "5m",
				To:   "now",
				Now:  time.Now(),
			},
		}

		result = e.Execute(ctx, queryContext.Queries, queryContext)
		So(result.Error, ShouldNotBeNil)
	})
}
