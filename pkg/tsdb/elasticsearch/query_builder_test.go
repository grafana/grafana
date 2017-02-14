package elasticsearch

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

var testElasticsearchModelRequestJSON = `
{
      "bucketAggs": [
        {
          "field": "rfc460Timestamp",
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
      "query": "(rfc190Scope:globalriot.las2.ansible1.transformer.zabbix) AND (name_raw:system.transformer.ansible.count)",
      "refId": "A",
      "timeField": "rfc460Timestamp"
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
            "rfc460Timestamp": {
              "gte": "1486999666201",
              "lte": "1487003266201",
              "format": "epoch_millis"
            }
          }
        },
        {
          "query_string": {
            "analyze_wildcard": true,
            "query": "(rfc190Scope:globalriot.las2.ansible1.transformer.zabbix) AND (name_raw:system.transformer.ansible.count)"
          }
        }
      ]
    }
  },
  "aggs": {
    "2": {
      "date_histogram": {
        "interval": "5s",
        "field": "rfc460Timestamp",
        "min_doc_count": 0,
        "extended_bounds": {
          "min": "1486999666201",
          "max": "1487003266201"
        },
        "format": "epoch_millis"
      },
      "aggs": {
        "1": {
          "avg": {
            "field": "value"
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
			model := &ElasticsearchRequestModel{}

			err := json.Unmarshal([]byte(testElasticsearchModelRequestJSON), model)
			So(err, ShouldBeNil)

			testTimeRange := &tsdb.TimeRange{
				From: "5m",
				To:   "now",
				Now:  time.Now(),
			}

			queryJson, err := model.BuildQueryJson(testTimeRange)
			So(err, ShouldBeNil)

			fmt.Println(queryJson)
			var queryExpectedJsonInterface, queryJsonInterface interface{}
			err = json.Unmarshal([]byte(testElasticsearchQueryJSON), &queryExpectedJsonInterface)
			So(err, ShouldBeNil)

			err = json.Unmarshal([]byte(queryJson), &queryJsonInterface)
			So(err, ShouldBeNil)

			//result := reflect.DeepEqual(queryExpectedJsonInterface, queryJsonInterface)

			// TODO Fix this timestamp comparison
			//So(result, ShouldBeTrue)
		})
	})
}
