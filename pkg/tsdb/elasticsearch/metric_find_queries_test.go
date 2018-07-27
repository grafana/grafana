package elasticsearch

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestExecuteFieldsQuery(t *testing.T) {
	Convey("Test execute fields query", t, func() {
		var extractedFieldTypeFilter string
		var extractedRefID string
		origResponseTransformer := newFieldsQueryResponseTransformer
		newFieldsQueryResponseTransformer = func(response *es.IndexMappingResponse, fieldTypeFilter, refID string) responseTransformer {
			extractedFieldTypeFilter = fieldTypeFilter
			extractedRefID = refID
			return &fakeResponseTransformer{}
		}

		Convey("When executing fields query should extract field type filter", func() {
			c := newFakeClient(2)
			_, err := executeFieldsQuery(c, `{
				"fieldTypeFilter": "date"
			}`, "A")
			So(err, ShouldBeNil)
			So(extractedFieldTypeFilter, ShouldEqual, "date")
			So(extractedRefID, ShouldEqual, "A")
		})

		Reset(func() {
			newFieldsQueryResponseTransformer = origResponseTransformer
		})
	})
}

func TestExecuteTermsQuery(t *testing.T) {
	from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
	to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))

	Convey("Test execute terms query", t, func() {
		var extractedRefID string
		origResponseTransformer := newTermsQueryResponseTransformer
		newTermsQueryResponseTransformer = func(response *es.SearchResponse, termsAggID, refID string) responseTransformer {
			extractedRefID = refID
			return &fakeResponseTransformer{}
		}

		Convey("Should return error if field property is missing", func() {
			c := newFakeClient(2)
			_, err := executeTermsQuery(c, `{}`, from, to, "A")
			So(err, ShouldNotBeNil)
		})

		Convey("With defaults", func() {
			c := newFakeClient(2)
			_, err := executeTermsQuery(c, `{
				"field": "@host"
			}`, from, to, "A")
			So(err, ShouldBeNil)
			So(extractedRefID, ShouldEqual, "A")

			sr := c.searchRequests[0]
			rangeFilter := sr.Query.Bool.Filters[0].(*es.RangeFilter)
			So(rangeFilter.Key, ShouldEqual, c.timeField)
			So(rangeFilter.Lte, ShouldEqual, toStr)
			So(rangeFilter.Gte, ShouldEqual, fromStr)
			So(rangeFilter.Format, ShouldEqual, es.DateFormatEpochMS)
			termsAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Field, ShouldEqual, "@host")
			So(termsAgg.Order["_term"], ShouldEqual, "asc")
			So(termsAgg.Size, ShouldEqual, defaultTermsSize)
		})

		Convey("With custom size", func() {
			c := newFakeClient(2)
			_, err := executeTermsQuery(c, `{
				"field": "@host",
				"size": 1000
			}`, from, to, "A")
			So(err, ShouldBeNil)

			sr := c.searchRequests[0]
			termsAgg := sr.Aggs[0].Aggregation.Aggregation.(*es.TermsAggregation)
			So(termsAgg.Size, ShouldEqual, 1000)
		})

		Convey("With query", func() {
			c := newFakeClient(2)
			_, err := executeTermsQuery(c, `{
				"field": "@host",
				"query": "@metric:cpu"
			}`, from, to, "A")
			So(err, ShouldBeNil)

			sr := c.searchRequests[0]
			qsFilter := sr.Query.Bool.Filters[1].(*es.QueryStringFilter)
			So(qsFilter.Query, ShouldEqual, "@metric:cpu")
			So(qsFilter.AnalyzeWildcard, ShouldBeTrue)
		})

		Reset(func() {
			newTermsQueryResponseTransformer = origResponseTransformer
		})
	})
}

func executeFieldsQuery(c es.Client, body, refID string) (*tsdb.Response, error) {
	json, err := simplejson.NewJson([]byte(body))
	if err != nil {
		return nil, err
	}
	tsdbQuery := &tsdb.TsdbQuery{
		Queries: []*tsdb.Query{
			{
				Model: json,
				RefId: refID,
			},
		},
	}
	query := newFieldsQuery(c, tsdbQuery)
	return query.execute()
}

func executeTermsQuery(c es.Client, body string, from, to time.Time, refID string) (*tsdb.Response, error) {
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
	query := newTermsQuery(c, tsdbQuery)
	return query.execute()
}

type fakeResponseTransformer struct{}

func (t *fakeResponseTransformer) transform() (*tsdb.Response, error) {
	return nil, nil
}
