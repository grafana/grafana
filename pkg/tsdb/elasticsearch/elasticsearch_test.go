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

		timeRange := &tsdb.TimeRange{
			From: "48h",
			To:   "now",
			Now:  time.Date(2017, time.February, 18, 12, 0, 0, 0, time.Local),
		}

		Convey("Parse Interval Formats", func() {
			So(getIndex("[logstash-]YYYY.MM.DD", "Daily", timeRange),
				ShouldEqual, "logstash-2017.02.16,logstash-2017.02.17,logstash-2017.02.18")

			timeRange.From = "3h"
			So(getIndex("[logstash-]YYYY.MM.DD.HH", "Hourly", timeRange),
				ShouldEqual, "logstash-2017.02.18.09,logstash-2017.02.18.10,logstash-2017.02.18.11,logstash-2017.02.18.12")

			timeRange.From = "200h"
			So(getIndex("[logstash-]YYYY.W", "Weekly", timeRange),
				ShouldEqual, "logstash-2017.6,logstash-2017.7")

			timeRange.From = "700h"
			So(getIndex("[logstash-]YYYY.MM", "Monthly", timeRange),
				ShouldEqual, "logstash-2017.01,logstash-2017.02")

			timeRange.From = "10000h"
			So(getIndex("[logstash-]YYYY", "Yearly", timeRange),
				ShouldEqual, "logstash-2015,logstash-2016,logstash-2017")

		})

		Convey("No Interval", func() {
			index := getIndex("logstash-test", "", timeRange)
			So(index, ShouldEqual, "logstash-test")
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
				now:  time.Now(),
			},
		}

		result = e.Execute(ctx, queryContext.Queries, queryContext)
		So(result.Error, ShouldNotBeNil)
	})
}
