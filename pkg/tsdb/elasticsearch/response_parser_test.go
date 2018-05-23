package elasticsearch

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func testElasticsearchResponse(body string, target Query) *tsdb.QueryResult {
	var responses Responses
	err := json.Unmarshal([]byte(body), &responses)
	So(err, ShouldBeNil)

	responseParser := ElasticsearchResponseParser{responses.Responses, []*Query{&target}}
	return responseParser.getTimeSeries()
}

func TestElasticSearchResponseParser(t *testing.T) {
	Convey("Elasticsearch Response query testing", t, func() {
		Convey("Build test average metric with moving average", func() {
			responses := `{
  "responses": [
    {
      "took": 1,
      "timed_out": false,
      "_shards": {
        "total": 5,
        "successful": 5,
        "skipped": 0,
        "failed": 0
      },
      "hits": {
        "total": 4500,
        "max_score": 0,
        "hits": []
      },
      "aggregations": {
        "2": {
          "buckets": [
            {
              "1": {
                "value": null
              },
              "key_as_string": "1522205880000",
              "key": 1522205880000,
              "doc_count": 0
            },
            {
              "1": {
                "value": 10
              },
              "key_as_string": "1522205940000",
              "key": 1522205940000,
              "doc_count": 300
            },
            {
              "1": {
                "value": 10
              },
              "3": {
                "value": 20
              },
              "key_as_string": "1522206000000",
              "key": 1522206000000,
              "doc_count": 300
            },
            {
              "1": {
                "value": 10
              },
              "3": {
                "value": 20
              },
              "key_as_string": "1522206060000",
              "key": 1522206060000,
              "doc_count": 300
            }
          ]
        }
      },
      "status": 200
    }
  ]
}
`
			res := testElasticsearchResponse(responses, avgWithMovingAvg)
			So(len(res.Series), ShouldEqual, 2)
			So(res.Series[0].Name, ShouldEqual, "Average value")
			So(len(res.Series[0].Points), ShouldEqual, 4)
			for i, p := range res.Series[0].Points {
				if i == 0 {
					So(p[0].Valid, ShouldBeFalse)
				} else {
					So(p[0].Float64, ShouldEqual, 10)
				}
				So(p[1].Float64, ShouldEqual, 1522205880000+60000*i)
			}

			So(res.Series[1].Name, ShouldEqual, "Moving Average Average 1")
			So(len(res.Series[1].Points), ShouldEqual, 2)

			for _, p := range res.Series[1].Points {
				So(p[0].Float64, ShouldEqual, 20)
			}

		})
	})
}
