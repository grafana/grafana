package elasticsearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestExecuteAnnotationQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))

	Convey("Test execute annotation query", t, func() {
		var queryModel *annotationQueryModel
		origResponseTransformer := newAnnotationQueryResponseTransformer
		newAnnotationQueryResponseTransformer = func(response *es.SearchResponse, m *annotationQueryModel) responseTransformer {
			queryModel = m
			return &fakeResponseTransformer{}
		}

		Convey("With defaults es v2", func() {
			c := newFakeClient(2)
			_, err := executeAnnotationQuery(c, `{}`, from, to, "A")
			So(err, ShouldBeNil)
			So(queryModel.timeField, ShouldEqual, c.timeField)
			So(queryModel.tagsField, ShouldEqual, "tags")
			So(queryModel.textField, ShouldEqual, "")
			So(queryModel.titleField, ShouldEqual, "")
			So(queryModel.queryString, ShouldEqual, "")
			So(queryModel.refID, ShouldEqual, "A")

			sr := c.searchRequests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			So(rangeFilter.Key, ShouldEqual, c.timeField)
			So(rangeFilter.Lte, ShouldEqual, toStr)
			So(rangeFilter.Gte, ShouldEqual, fromStr)
			So(rangeFilter.Format, ShouldEqual, es.DateFormatEpochMS)
			So(sr.Size, ShouldEqual, 10000)
			So(sr.CustomProps["fields"].([]string)[0], ShouldEqual, c.timeField)
			So(sr.CustomProps["fields"].([]string)[1], ShouldEqual, "_source")
		})

		Convey("With defaults es v5", func() {
			c := newFakeClient(5)
			_, err := executeAnnotationQuery(c, `{}`, from, to, "A")
			So(err, ShouldBeNil)

			sr := c.searchRequests[0]
			_, fieldsSet := sr.CustomProps["fields"]
			So(fieldsSet, ShouldBeFalse)
		})

		Convey("With fields and querystring", func() {
			c := newFakeClient(2)
			_, err := executeAnnotationQuery(c, `{
				"timeField": "@time",
				"tagsField": "@tags",
				"textField": "@text",
				"titleField": "title",
				"query": "@metric:cpu"
			}`, from, to, "A")
			So(err, ShouldBeNil)
			So(queryModel.timeField, ShouldEqual, "@time")
			So(queryModel.tagsField, ShouldEqual, "@tags")
			So(queryModel.textField, ShouldEqual, "@text")
			So(queryModel.titleField, ShouldEqual, "title")
			So(queryModel.queryString, ShouldEqual, "@metric:cpu")
			So(queryModel.refID, ShouldEqual, "A")

			sr := c.searchRequests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			So(rangeFilter.Key, ShouldEqual, "@time")
			So(rangeFilter.Lte, ShouldEqual, toStr)
			So(rangeFilter.Gte, ShouldEqual, fromStr)
			So(rangeFilter.Format, ShouldEqual, es.DateFormatEpochMS)
			queryStringFilter := sr.Query.Bool.Filters[1].(*es.QueryStringFilter)
			So(queryStringFilter.Query, ShouldEqual, "@metric:cpu")
			So(queryStringFilter.AnalyzeWildcard, ShouldEqual, true)
			So(sr.Size, ShouldEqual, 10000)
		})

		Reset(func() {
			newAnnotationQueryResponseTransformer = origResponseTransformer
		})
	})
}

func TestAnnotationQueryResponseTransformer(t *testing.T) {
	Convey("Given es 2.x response", t, func() {
		response := `{
      "took": 18,
      "timed_out": false,
      "_shards": { "total": 5, "successful": 5, "failed": 0 },
      "hits": {
        "total": 8,
        "max_score": 0.0,
        "hits": [
          {
            "_index": "logs-2018.07.25",
            "_type": "log",
            "_id": "AWTSS6_dUEmWW2PzvaNX",
            "_score": 0.0,
            "_source": {
							"@timestamp": 1532536710159,
              "@message": "Deployed website",
              "tags": ["deploy", "website-01"],
              "description": "Torkel deployed website",
              "coordinates": { "latitude": 12, "longitude": 121, "level": { "depth": 3, "coolnes": "very" } },
              "long":
                "asdsaa asdas dasdas dasdasdas asdaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa asdasdasdasdasdasdas asd",
							"unescaped-content": "breaking <br /> the <br /> row",
							"@tags": "1,2,3"
            },
            "fields": { "@timestamp": [1532536532824] }
          }
        ]
      }
		}`

		Convey("Should transform to annotation with default query", func() {
			rt, err := newAnnotationQueryResponseTransformerForTest(response, &annotationQueryModel{
				timeField: "@timestamp",
				textField: "description",
				tagsField: "tags",
				refID:     "A",
			})
			So(err, ShouldBeNil)
			result, err := rt.transform()
			So(err, ShouldBeNil)

			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			cols := queryRes.Tables[0].Columns
			So(cols, ShouldHaveLength, 3)
			So(cols[0].Text, ShouldEqual, "time")
			So(cols[1].Text, ShouldEqual, "text")
			So(cols[2].Text, ShouldEqual, "tags")

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 1)
			So(rows[0][0], ShouldEqual, 1532536710159)
			So(rows[0][1], ShouldEqual, "Torkel deployed website")
			So(rows[0][2].([]interface{})[0].(string), ShouldEqual, "deploy")
			So(rows[0][2].([]interface{})[1].(string), ShouldEqual, "website-01")
		})
	})

	Convey("Given es 5.x and above response", t, func() {
		response := `{
      "took": 7,
      "timed_out": false,
      "_shards": { "total": 5, "successful": 5, "skipped": 0, "failed": 0 },
      "hits": {
        "total": 3,
        "max_score": 0.0,
        "hits": [
          {
            "_index": "logs-2018.07.25",
            "_type": "log",
            "_id": "AWTSTmQSq9oabbYnPB-A",
            "_score": 0.0,
            "_source": {
              "@message": "Deployed website",
							"@timestamp": 1532536710159,
							"time": "2006-01-02T15:04:05Z",
              "tags": ["deploy", "website-01"],
              "description": "Torkel deployed website",
              "coordinates": { "latitude": 12, "longitude": 121, "level": { "depth": 3, "coolnes": "very" } },
              "long":
                "asdsaa asdas dasdas dasdasdas asdaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa asdasdasdasdasdasdas asd",
							"unescaped-content": "breaking <br /> the <br /> row",
							"@tags": "1,2,3"
            }
          }
        ]
      },
      "status": 200
    }`

		Convey("Should transform to annotation with default query", func() {
			rt, err := newAnnotationQueryResponseTransformerForTest(response, &annotationQueryModel{
				timeField: "@timestamp",
				textField: "description",
				tagsField: "tags",
				refID:     "A",
			})
			So(err, ShouldBeNil)
			result, err := rt.transform()
			So(err, ShouldBeNil)

			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			cols := queryRes.Tables[0].Columns
			So(cols, ShouldHaveLength, 3)
			So(cols[0].Text, ShouldEqual, "time")
			So(cols[1].Text, ShouldEqual, "text")
			So(cols[2].Text, ShouldEqual, "tags")

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 1)
			So(rows[0][0], ShouldEqual, 1532536710159)
			So(rows[0][1], ShouldEqual, "Torkel deployed website")
			So(rows[0][2].([]interface{})[0].(string), ShouldEqual, "deploy")
			So(rows[0][2].([]interface{})[1].(string), ShouldEqual, "website-01")
		})

		Convey("Should transform to annotation with string time, title field and csv tags", func() {
			rt, err := newAnnotationQueryResponseTransformerForTest(response, &annotationQueryModel{
				timeField:  "time",
				textField:  "description",
				titleField: "@message",
				tagsField:  "@tags",
				refID:      "A",
			})
			So(err, ShouldBeNil)
			result, err := rt.transform()
			So(err, ShouldBeNil)

			So(result.Results, ShouldHaveLength, 1)

			queryRes := result.Results["A"]
			So(queryRes, ShouldNotBeNil)
			So(queryRes.Tables, ShouldHaveLength, 1)

			rows := queryRes.Tables[0].Rows
			So(rows, ShouldHaveLength, 1)
			So(rows[0][0], ShouldEqual, 1136214245000)
			So(rows[0][1], ShouldEqual, "Deployed website\nTorkel deployed website")
			So(rows[0][2].([]string)[0], ShouldEqual, "1")
			So(rows[0][2].([]string)[1], ShouldEqual, "2")
			So(rows[0][2].([]string)[2], ShouldEqual, "3")
		})
	})
}

func executeAnnotationQuery(c es.Client, body string, from, to time.Time, refID string) (*tsdb.Response, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return nil, err
	}
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
	tsdbQuery := &tsdb.TsdbQuery{
		Queries: []*tsdb.Query{
			{
				Model: json,
				RefId: refID,
			},
		},
		TimeRange: tsdb.NewTimeRange(fromStr, toStr),
	}
	query := newAnnotationQuery(c, tsdbQuery)
	return query.execute()
}

func newAnnotationQueryResponseTransformerForTest(responseBody string, m *annotationQueryModel) (responseTransformer, error) {
	var response es.SearchResponse
	err := json.Unmarshal([]byte(responseBody), &response)
	if err != nil {
		return nil, err
	}

	return newAnnotationQueryResponseTransformer(&response, m), nil
}
