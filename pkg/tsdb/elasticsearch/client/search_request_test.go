package es

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSearchRequest(t *testing.T) {
	Convey("Test elasticsearch search request", t, func() {
		timeField := "@timestamp"
		Convey("Given new search request builder for es version 5", func() {
			b := NewSearchRequestBuilder(5, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

			Convey("When building search request", func() {
				sr, err := b.Build()
				So(err, ShouldBeNil)

				Convey("Should have size of zero", func() {
					So(sr.Size, ShouldEqual, 0)
				})

				Convey("Should have no sorting", func() {
					So(sr.Sort, ShouldHaveLength, 0)
				})

				Convey("When marshal to JSON should generate correct json", func() {
					body, err := json.Marshal(sr)
					So(err, ShouldBeNil)
					json, err := simplejson.NewJson(body)
					So(err, ShouldBeNil)
					So(json.Get("size").MustInt(500), ShouldEqual, 0)
					So(json.Get("sort").Interface(), ShouldBeNil)
					So(json.Get("aggs").Interface(), ShouldBeNil)
					So(json.Get("query").Interface(), ShouldBeNil)
				})
			})

			Convey("When adding size, sort, filters", func() {
				b.Size(200)
				b.SortDesc(timeField, "boolean")
				filters := b.Query().Bool().Filter()
				filters.AddDateRangeFilter(timeField, "$timeTo", "$timeFrom", DateFormatEpochMS)
				filters.AddQueryStringFilter("test", true)

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have correct size", func() {
						So(sr.Size, ShouldEqual, 200)
					})

					Convey("Should have correct sorting", func() {
						sort, ok := sr.Sort[timeField].(map[string]string)
						So(ok, ShouldBeTrue)
						So(sort["order"], ShouldEqual, "desc")
						So(sort["unmapped_type"], ShouldEqual, "boolean")
					})

					Convey("Should have range filter", func() {
						f, ok := sr.Query.Bool.Filters[0].(*RangeFilter)
						So(ok, ShouldBeTrue)
						So(f.Gte, ShouldEqual, "$timeFrom")
						So(f.Lte, ShouldEqual, "$timeTo")
						So(f.Format, ShouldEqual, "epoch_millis")
					})

					Convey("Should have query string filter", func() {
						f, ok := sr.Query.Bool.Filters[1].(*QueryStringFilter)
						So(ok, ShouldBeTrue)
						So(f.Query, ShouldEqual, "test")
						So(f.AnalyzeWildcard, ShouldBeTrue)
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)
						So(json.Get("size").MustInt(0), ShouldEqual, 200)

						sort := json.GetPath("sort", timeField)
						So(sort.Get("order").MustString(), ShouldEqual, "desc")
						So(sort.Get("unmapped_type").MustString(), ShouldEqual, "boolean")

						timeRangeFilter := json.GetPath("query", "bool", "filter").GetIndex(0).Get("range").Get(timeField)
						So(timeRangeFilter.Get("gte").MustString(""), ShouldEqual, "$timeFrom")
						So(timeRangeFilter.Get("lte").MustString(""), ShouldEqual, "$timeTo")
						So(timeRangeFilter.Get("format").MustString(""), ShouldEqual, DateFormatEpochMS)

						queryStringFilter := json.GetPath("query", "bool", "filter").GetIndex(1).Get("query_string")
						So(queryStringFilter.Get("analyze_wildcard").MustBool(false), ShouldEqual, true)
						So(queryStringFilter.Get("query").MustString(""), ShouldEqual, "test")
					})
				})
			})

			Convey("When adding doc value field", func() {
				b.AddDocValueField(timeField)

				Convey("should set correct props", func() {
					So(b.customProps["fields"], ShouldBeNil)

					scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
					So(ok, ShouldBeTrue)
					So(scriptFields, ShouldHaveLength, 0)

					docValueFields, ok := b.customProps["docvalue_fields"].([]string)
					So(ok, ShouldBeTrue)
					So(docValueFields, ShouldHaveLength, 1)
					So(docValueFields[0], ShouldEqual, timeField)
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						scriptFields, err := json.Get("script_fields").Map()
						So(err, ShouldBeNil)
						So(scriptFields, ShouldHaveLength, 0)

						_, err = json.Get("fields").StringArray()
						So(err, ShouldNotBeNil)

						docValueFields, err := json.Get("docvalue_fields").StringArray()
						So(err, ShouldBeNil)
						So(docValueFields, ShouldHaveLength, 1)
						So(docValueFields[0], ShouldEqual, timeField)
					})
				})
			})

			Convey("and adding multiple top level aggs", func() {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", nil)
				aggBuilder.DateHistogram("2", "@timestamp", nil)

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have 2 top level aggs", func() {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 2)
						So(aggs[0].Key, ShouldEqual, "1")
						So(aggs[0].Aggregation.Type, ShouldEqual, "terms")
						So(aggs[1].Key, ShouldEqual, "2")
						So(aggs[1].Aggregation.Type, ShouldEqual, "date_histogram")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						So(json.Get("aggs").MustMap(), ShouldHaveLength, 2)
						So(json.GetPath("aggs", "1", "terms", "field").MustString(), ShouldEqual, "@hostname")
						So(json.GetPath("aggs", "2", "date_histogram", "field").MustString(), ShouldEqual, "@timestamp")
					})
				})
			})

			Convey("and adding top level agg with child agg", func() {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
					ib.DateHistogram("2", "@timestamp", nil)
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have 1 top level agg and one child agg", func() {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						So(topAgg.Key, ShouldEqual, "1")
						So(topAgg.Aggregation.Type, ShouldEqual, "terms")
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := aggs[0].Aggregation.Aggs[0]
						So(childAgg.Key, ShouldEqual, "2")
						So(childAgg.Aggregation.Type, ShouldEqual, "date_histogram")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						So(json.Get("aggs").MustMap(), ShouldHaveLength, 1)
						firstLevelAgg := json.GetPath("aggs", "1")
						secondLevelAgg := firstLevelAgg.GetPath("aggs", "2")
						So(firstLevelAgg.GetPath("terms", "field").MustString(), ShouldEqual, "@hostname")
						So(secondLevelAgg.GetPath("date_histogram", "field").MustString(), ShouldEqual, "@timestamp")
					})
				})
			})

			Convey("and adding two top level aggs with child agg", func() {
				aggBuilder := b.Agg()
				aggBuilder.Histogram("1", "@hostname", func(a *HistogramAgg, ib AggBuilder) {
					ib.DateHistogram("2", "@timestamp", nil)
				})
				aggBuilder.Filters("3", func(a *FiltersAggregation, ib AggBuilder) {
					ib.Terms("4", "@test", nil)
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have 2 top level aggs with one child agg each", func() {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 2)

						topAggOne := aggs[0]
						So(topAggOne.Key, ShouldEqual, "1")
						So(topAggOne.Aggregation.Type, ShouldEqual, "histogram")
						So(topAggOne.Aggregation.Aggs, ShouldHaveLength, 1)

						topAggOnechildAgg := topAggOne.Aggregation.Aggs[0]
						So(topAggOnechildAgg.Key, ShouldEqual, "2")
						So(topAggOnechildAgg.Aggregation.Type, ShouldEqual, "date_histogram")

						topAggTwo := aggs[1]
						So(topAggTwo.Key, ShouldEqual, "3")
						So(topAggTwo.Aggregation.Type, ShouldEqual, "filters")
						So(topAggTwo.Aggregation.Aggs, ShouldHaveLength, 1)

						topAggTwochildAgg := topAggTwo.Aggregation.Aggs[0]
						So(topAggTwochildAgg.Key, ShouldEqual, "4")
						So(topAggTwochildAgg.Aggregation.Type, ShouldEqual, "terms")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						topAggOne := json.GetPath("aggs", "1")
						So(topAggOne.GetPath("histogram", "field").MustString(), ShouldEqual, "@hostname")
						topAggOnechildAgg := topAggOne.GetPath("aggs", "2")
						So(topAggOnechildAgg.GetPath("date_histogram", "field").MustString(), ShouldEqual, "@timestamp")

						topAggTwo := json.GetPath("aggs", "3")
						topAggTwochildAgg := topAggTwo.GetPath("aggs", "4")
						So(topAggTwo.GetPath("filters").MustArray(), ShouldHaveLength, 0)
						So(topAggTwochildAgg.GetPath("terms", "field").MustString(), ShouldEqual, "@test")
					})
				})
			})

			Convey("and adding top level agg with child agg with child agg", func() {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
					ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
						ib.DateHistogram("3", "@timestamp", nil)
					})
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have 1 top level agg with one child having a child", func() {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						So(topAgg.Key, ShouldEqual, "1")
						So(topAgg.Aggregation.Type, ShouldEqual, "terms")
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := topAgg.Aggregation.Aggs[0]
						So(childAgg.Key, ShouldEqual, "2")
						So(childAgg.Aggregation.Type, ShouldEqual, "terms")

						childChildAgg := childAgg.Aggregation.Aggs[0]
						So(childChildAgg.Key, ShouldEqual, "3")
						So(childChildAgg.Aggregation.Type, ShouldEqual, "date_histogram")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						topAgg := json.GetPath("aggs", "1")
						So(topAgg.GetPath("terms", "field").MustString(), ShouldEqual, "@hostname")

						childAgg := topAgg.GetPath("aggs", "2")
						So(childAgg.GetPath("terms", "field").MustString(), ShouldEqual, "@app")

						childChildAgg := childAgg.GetPath("aggs", "3")
						So(childChildAgg.GetPath("date_histogram", "field").MustString(), ShouldEqual, "@timestamp")
					})
				})
			})

			Convey("and adding bucket and metric aggs", func() {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
					ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
						ib.Metric("4", "avg", "@value", nil)
						ib.DateHistogram("3", "@timestamp", func(a *DateHistogramAgg, ib AggBuilder) {
							ib.Metric("4", "avg", "@value", nil)
							ib.Metric("5", "max", "@value", nil)
						})
					})
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have 1 top level agg with one child having a child", func() {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						So(topAgg.Key, ShouldEqual, "1")
						So(topAgg.Aggregation.Type, ShouldEqual, "terms")
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := topAgg.Aggregation.Aggs[0]
						So(childAgg.Key, ShouldEqual, "2")
						So(childAgg.Aggregation.Type, ShouldEqual, "terms")

						childChildOneAgg := childAgg.Aggregation.Aggs[0]
						So(childChildOneAgg.Key, ShouldEqual, "4")
						So(childChildOneAgg.Aggregation.Type, ShouldEqual, "avg")

						childChildTwoAgg := childAgg.Aggregation.Aggs[1]
						So(childChildTwoAgg.Key, ShouldEqual, "3")
						So(childChildTwoAgg.Aggregation.Type, ShouldEqual, "date_histogram")

						childChildTwoChildOneAgg := childChildTwoAgg.Aggregation.Aggs[0]
						So(childChildTwoChildOneAgg.Key, ShouldEqual, "4")
						So(childChildTwoChildOneAgg.Aggregation.Type, ShouldEqual, "avg")

						childChildTwoChildTwoAgg := childChildTwoAgg.Aggregation.Aggs[1]
						So(childChildTwoChildTwoAgg.Key, ShouldEqual, "5")
						So(childChildTwoChildTwoAgg.Aggregation.Type, ShouldEqual, "max")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						termsAgg := json.GetPath("aggs", "1")
						So(termsAgg.GetPath("terms", "field").MustString(), ShouldEqual, "@hostname")

						termsAggTwo := termsAgg.GetPath("aggs", "2")
						So(termsAggTwo.GetPath("terms", "field").MustString(), ShouldEqual, "@app")

						termsAggTwoAvg := termsAggTwo.GetPath("aggs", "4")
						So(termsAggTwoAvg.GetPath("avg", "field").MustString(), ShouldEqual, "@value")

						dateHistAgg := termsAggTwo.GetPath("aggs", "3")
						So(dateHistAgg.GetPath("date_histogram", "field").MustString(), ShouldEqual, "@timestamp")

						avgAgg := dateHistAgg.GetPath("aggs", "4")
						So(avgAgg.GetPath("avg", "field").MustString(), ShouldEqual, "@value")

						maxAgg := dateHistAgg.GetPath("aggs", "5")
						So(maxAgg.GetPath("max", "field").MustString(), ShouldEqual, "@value")
					})
				})
			})
		})

		Convey("Given new search request builder for es version 2", func() {
			b := NewSearchRequestBuilder(2, tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

			Convey("When adding doc value field", func() {
				b.AddDocValueField(timeField)

				Convey("should set correct props", func() {
					fields, ok := b.customProps["fields"].([]string)
					So(ok, ShouldBeTrue)
					So(fields, ShouldHaveLength, 2)
					So(fields[0], ShouldEqual, "*")
					So(fields[1], ShouldEqual, "_source")

					scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
					So(ok, ShouldBeTrue)
					So(scriptFields, ShouldHaveLength, 0)

					fieldDataFields, ok := b.customProps["fielddata_fields"].([]string)
					So(ok, ShouldBeTrue)
					So(fieldDataFields, ShouldHaveLength, 1)
					So(fieldDataFields[0], ShouldEqual, timeField)
				})

				Convey("When building search request", func() {
					sr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(sr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)

						scriptFields, err := json.Get("script_fields").Map()
						So(err, ShouldBeNil)
						So(scriptFields, ShouldHaveLength, 0)

						fields, err := json.Get("fields").StringArray()
						So(err, ShouldBeNil)
						So(fields, ShouldHaveLength, 2)
						So(fields[0], ShouldEqual, "*")
						So(fields[1], ShouldEqual, "_source")

						fieldDataFields, err := json.Get("fielddata_fields").StringArray()
						So(err, ShouldBeNil)
						So(fieldDataFields, ShouldHaveLength, 1)
						So(fieldDataFields[0], ShouldEqual, timeField)
					})
				})
			})
		})
	})
}

func TestMultiSearchRequest(t *testing.T) {
	Convey("Test elasticsearch multi search request", t, func() {
		Convey("Given new multi search request builder", func() {
			b := NewMultiSearchRequestBuilder(0)

			Convey("When adding one search request", func() {
				b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

				Convey("When building search request should contain one search request", func() {
					mr, err := b.Build()
					So(err, ShouldBeNil)
					So(mr.Requests, ShouldHaveLength, 1)
				})
			})

			Convey("When adding two search requests", func() {
				b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})
				b.Search(tsdb.Interval{Value: 15 * time.Second, Text: "15s"})

				Convey("When building search request should contain two search requests", func() {
					mr, err := b.Build()
					So(err, ShouldBeNil)
					So(mr.Requests, ShouldHaveLength, 2)
				})
			})
		})
	})
}
