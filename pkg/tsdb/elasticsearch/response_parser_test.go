package elasticsearch

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

var testResponseJSON = `
{
  "took": 1588,
  "timed_out": false,
  "_shards": {
    "total": 2250,
    "successful": 2250,
    "failed": 0
  },
  "hits": {
    "total": 5,
    "max_score": 0,
    "hits": []
  },
  "aggregations": {
    "2": {
      "buckets": [
        {
          "key_as_string": "1487020955000",
          "key": 1487020955000,
          "doc_count": 0,
          "1": {
            "value": null
          }
        },
        {
          "key_as_string": "1487020985000",
          "key": 1487020985000,
          "doc_count": 1,
          "1": {
            "value": 0
          }
        },
        {
          "key_as_string": "1487021010000",
          "key": 1487021010000,
          "doc_count": 0,
          "1": {
            "value": null
          }
        },
        {
          "key_as_string": "1487021045000",
          "key": 1487021045000,
          "doc_count": 1,
          "1": {
            "value": 1234
          },
          "3": {
            "value": 123
          }
        },
        {
          "key_as_string": "1487021105000",
          "key": 1487021105000,
          "doc_count": 1,
          "1": {
            "value": 155
          },
          "3": {
            "value": 0
          }
        },
        {
          "key_as_string": "1487021165000",
          "key": 1487021165000,
          "doc_count": 1,
          "1": {
            "value": 0
          },
          "3": {
            "value": 0
          }
        },
        {
          "key_as_string": "1487021180000",
          "key": 1487021180000,
          "doc_count": 0,
          "1": {
            "value": null
          }
        },
        {
          "key_as_string": "1487021210000",
          "key": 1487021210000,
          "doc_count": 0,
          "1": {
            "value": null
          }
        },
        {
          "key_as_string": "1487021225000",
          "key": 1487021225000,
          "doc_count": 1,
          "1": {
            "value": 0
          },
          "3": {
            "value": 1000
          }
        }
      ]
    }
  }
}`

var testRecursiveResponseJSON = `
{
  "aggregations": {
    "2": {
      "buckets": [
      {
        "3": {
          "buckets": [
          { "4": {"value": 10}, "doc_count": 1, "key": 1000},
          { "4": {"value": 12}, "doc_count": 3, "key": 2000}
          ]
        },
        "doc_count": 4,
        "key": "server1"
      },
      {
        "3": {
          "buckets": [
          { "4": {"value": 20}, "doc_count": 1, "key": 1000},
          { "4": {"value": 32}, "doc_count": 3, "key": 2000}
          ]
        },
        "doc_count": 10,
        "key": "server2"
      }
      ]
    }
  }
}`

func TestElasticserachQueryParser(t *testing.T) {
	Convey("Elasticserach QueryBuilder query parsing", t, func() {

		Convey("Parse ElasticSearch Query Results", func() {
			names := NameMap{}
			names["1"] = Name{
				Value: "Average value",
			}
			names["3"] = Name{
				Value:     "Moving Average",
				Reference: "1",
			}
			queryResult, err := parseQueryResult([]byte(testResponseJSON), names, FilterMap{})

			So(err, ShouldBeNil)
			So(queryResult, ShouldNotBeNil)
			So(len(queryResult.Series), ShouldEqual, 2)
		})

		Convey("Parse ElasticSearch Nested Query Results", func() {
			names := NameMap{}
			names["4"] = Name{
				Value: "Test Name",
			}

			queryResult, err := parseQueryResult([]byte(testRecursiveResponseJSON), names, FilterMap{})

			So(err, ShouldBeNil)
			So(queryResult, ShouldNotBeNil)
			So(len(queryResult.Series), ShouldEqual, 1)
			So(queryResult.Series[0].Name, ShouldEqual, "Test Name")
		})

		Convey("Parse ElasticSearch Nested Query Results With Filter", func() {
			names := NameMap{}
			names["4"] = Name{
				Value: "Test Name",
			}

			queryResult, err := parseQueryResult([]byte(testRecursiveResponseJSON), names, FilterMap{"4": true})

			So(err, ShouldBeNil)
			So(queryResult, ShouldNotBeNil)
			So(len(queryResult.Series), ShouldEqual, 0)
		})
	})
}
