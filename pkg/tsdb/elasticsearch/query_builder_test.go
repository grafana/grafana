package elasticsearch

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

var testElasticsearchModelRequestJSON = `
{
      "bucketAggs": [
        {
          "field": "timestamp",
          "id": "2",
          "settings": {
            "interval": "auto",
            "min_doc_count": 0,
            "trimEdges": 0
          },
          "type": "date_histogram"
        }
      ],
      "dsType": "elasticsearch",
      "metrics": [
        {
          "field": "value",
          "id": "1",
          "inlineScript": "_value * 2",
          "meta": {

          },
          "settings": {
            "script": {
              "inline": "_value * 2"
            }
          },
          "type": "avg"
        },
        {
          "field": "1",
          "id": "3",
          "meta": {

          },
          "pipelineAgg": "1",
          "settings": {
            "minimize": false,
            "model": "simple",
            "window": 5
          },
          "type": "moving_avg"
        }
      ],
      "query": "(test:query) AND (name:sample)",
      "refId": "A",
      "timeField": "timestamp"
}
`

var testElasticsearchQueryJSON = `
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "timestamp": {
              "gte": "<FROM_TIMESTAMP>",
              "lte": "<TO_TIMESTAMP>",
              "format": "epoch_millis"
            }
          }
        },
        {
          "query_string": {
            "analyze_wildcard": true,
            "query": "(test:query) AND (name:sample)"
          }
        }
      ]
    }
  },
  "aggs": {
    "2": {
      "date_histogram": {
        "interval": "5s",
        "field": "timestamp",
        "min_doc_count": 0,
        "extended_bounds": {
          "min": "<FROM_TIMESTAMP>",
          "max": "<TO_TIMESTAMP>"
        },
        "format": "epoch_millis"
      },
      "aggs": {
        "1": {
          "avg": {
            "field": "value",
	            "script": {
	              "inline": "_value * 2"
	            }
          }
        },
        "3": {
          "moving_avg": {
            "buckets_path": "1",
            "window": 5,
            "model": "simple",
            "minimize": false
          }
        }
      }
    }
  }
}`

func TestElasticserachQueryBuilder(t *testing.T) {
	Convey("Elasticserach QueryBuilder query testing", t, func() {

		Convey("Build test average metric with moving average", func() {
			model := &RequestModel{}

			err := json.Unmarshal([]byte(testElasticsearchModelRequestJSON), model)
			So(err, ShouldBeNil)

			testTimeRange := &tsdb.TimeRange{
				From: "5m",
				To:   "now",
				Now:  time.Now(),
			}

			queryJSON, err := model.buildQueryJSON(testTimeRange)
			So(err, ShouldBeNil)

			var queryExpectedJSONInterface, queryJSONInterface interface{}

			err = json.Unmarshal([]byte(queryJSON), &queryJSONInterface)
			So(err, ShouldBeNil)

			testElasticsearchQueryJSON = strings.Replace(
				testElasticsearchQueryJSON,
				"<FROM_TIMESTAMP>",
				convertTimeToUnixNano(testTimeRange.From, testTimeRange.Now),
				-1,
			)

			testElasticsearchQueryJSON = strings.Replace(
				testElasticsearchQueryJSON,
				"<TO_TIMESTAMP>",
				convertTimeToUnixNano(testTimeRange.To, testTimeRange.Now),
				-1,
			)

			err = json.Unmarshal([]byte(testElasticsearchQueryJSON), &queryExpectedJSONInterface)
			So(err, ShouldBeNil)

			result := reflect.DeepEqual(queryExpectedJSONInterface, queryJSONInterface)
			So(result, ShouldBeTrue)
		})
	})
}
