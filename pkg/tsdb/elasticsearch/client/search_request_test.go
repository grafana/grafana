package es

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/stretchr/testify/require"
)

func TestSearchRequest(t *testing.T) {
	t.Run("Test elasticsearch search request", func(t *testing.T) {
		timeField := "@timestamp"
		t.Run("Given new search request builder for es version 5", func(t *testing.T) {
			version5, _ := semver.NewVersion("5.0.0")
			b := NewSearchRequestBuilder(version5, interval.Interval{Value: 15 * time.Second, Text: "15s"})

			t.Run("When building search request", func(t *testing.T) {
				sr, err := b.Build()
				require.NoError(t, err)

				t.Run("Should have size of zero", func(t *testing.T) {
					require.Equal(t, 0, sr.Size)
				})

				t.Run("Should have no sorting", func(t *testing.T) {
					So(sr.Sort, ShouldHaveLength, 0)
				})

				t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
					body, err := json.Marshal(sr)
					require.NoError(t, err)
					json, err := simplejson.NewJson(body)
					require.NoError(t, err)
					require.Equal(t, 0, json.Get("size").MustInt(500))
					So(json.Get("sort").Interface(), ShouldBeNil)
					So(json.Get("aggs").Interface(), ShouldBeNil)
					So(json.Get("query").Interface(), ShouldBeNil)
				})
			})

			t.Run("When adding size, sort, filters", func(t *testing.T) {
				b.Size(200)
				b.SortDesc(timeField, "boolean")
				filters := b.Query().Bool().Filter()
				filters.AddDateRangeFilter(timeField, "$timeTo", "$timeFrom", DateFormatEpochMS)
				filters.AddQueryStringFilter("test", true)

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have correct size", func(t *testing.T) {
						require.Equal(t, 200, sr.Size)
					})

					t.Run("Should have correct sorting", func(t *testing.T) {
						sort, ok := sr.Sort[timeField].(map[string]string)
						require.True(t, ok)
						require.Equal(t, "desc", sort["order"])
						require.Equal(t, "boolean", sort["unmapped_type"])
					})

					t.Run("Should have range filter", func(t *testing.T) {
						f, ok := sr.Query.Bool.Filters[0].(*RangeFilter)
						require.True(t, ok)
						require.Equal(t, "$timeFrom", f.Gte)
						require.Equal(t, "$timeTo", f.Lte)
						require.Equal(t, "epoch_millis", f.Format)
					})

					t.Run("Should have query string filter", func(t *testing.T) {
						f, ok := sr.Query.Bool.Filters[1].(*QueryStringFilter)
						require.True(t, ok)
						require.Equal(t, "test", f.Query)
						require.True(t, f.AnalyzeWildcard)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)
						require.Equal(t, 200, json.Get("size").MustInt(0))

						sort := json.GetPath("sort", timeField)
						require.Equal(t, "desc", sort.Get("order").MustString())
						require.Equal(t, "boolean", sort.Get("unmapped_type").MustString())

						timeRangeFilter := json.GetPath("query", "bool", "filter").GetIndex(0).Get("range").Get(timeField)
						require.Equal(t, "$timeFrom", timeRangeFilter.Get("gte").MustString(""))
						require.Equal(t, "$timeTo", timeRangeFilter.Get("lte").MustString(""))
						require.Equal(t, DateFormatEpochMS, timeRangeFilter.Get("format").MustString(""))

						queryStringFilter := json.GetPath("query", "bool", "filter").GetIndex(1).Get("query_string")
						require.Equal(t, true, queryStringFilter.Get("analyze_wildcard").MustBool(false))
						require.Equal(t, "test", queryStringFilter.Get("query").MustString(""))
					})
				})
			})

			t.Run("When adding doc value field", func(t *testing.T) {
				b.AddDocValueField(timeField)

				t.Run("should set correct props", func(t *testing.T) {
					So(b.customProps["fields"], ShouldBeNil)

					scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
					require.True(t, ok)
					So(scriptFields, ShouldHaveLength, 0)

					docValueFields, ok := b.customProps["docvalue_fields"].([]string)
					require.True(t, ok)
					So(docValueFields, ShouldHaveLength, 1)
					require.Equal(t, timeField, docValueFields[0])
				})

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						scriptFields, err := json.Get("script_fields").Map()
						require.NoError(t, err)
						So(scriptFields, ShouldHaveLength, 0)

						_, err = json.Get("fields").StringArray()
						require.Error(t, err)

						docValueFields, err := json.Get("docvalue_fields").StringArray()
						require.NoError(t, err)
						So(docValueFields, ShouldHaveLength, 1)
						require.Equal(t, timeField, docValueFields[0])
					})
				})
			})

			t.Run("and adding multiple top level aggs", func(t *testing.T) {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", nil)
				aggBuilder.DateHistogram("2", "@timestamp", nil)

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have 2 top level aggs", func(t *testing.T) {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 2)
						require.Equal(t, "1", aggs[0].Key)
						require.Equal(t, "terms", aggs[0].Aggregation.Type)
						require.Equal(t, "2", aggs[1].Key)
						require.Equal(t, "date_histogram", aggs[1].Aggregation.Type)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						So(json.Get("aggs").MustMap(), ShouldHaveLength, 2)
						require.Equal(t, "@hostname", json.GetPath("aggs", "1", "terms", "field").MustString())
						require.Equal(t, "@timestamp", json.GetPath("aggs", "2", "date_histogram", "field").MustString())
					})
				})
			})

			t.Run("and adding top level agg with child agg", func(t *testing.T) {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
					ib.DateHistogram("2", "@timestamp", nil)
				})

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have 1 top level agg and one child agg", func(t *testing.T) {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						require.Equal(t, "1", topAgg.Key)
						require.Equal(t, "terms", topAgg.Aggregation.Type)
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := aggs[0].Aggregation.Aggs[0]
						require.Equal(t, "2", childAgg.Key)
						require.Equal(t, "date_histogram", childAgg.Aggregation.Type)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						So(json.Get("aggs").MustMap(), ShouldHaveLength, 1)
						firstLevelAgg := json.GetPath("aggs", "1")
						secondLevelAgg := firstLevelAgg.GetPath("aggs", "2")
						require.Equal(t, "@hostname", firstLevelAgg.GetPath("terms", "field").MustString())
						require.Equal(t, "@timestamp", secondLevelAgg.GetPath("date_histogram", "field").MustString())
					})
				})
			})

			t.Run("and adding two top level aggs with child agg", func(t *testing.T) {
				aggBuilder := b.Agg()
				aggBuilder.Histogram("1", "@hostname", func(a *HistogramAgg, ib AggBuilder) {
					ib.DateHistogram("2", "@timestamp", nil)
				})
				aggBuilder.Filters("3", func(a *FiltersAggregation, ib AggBuilder) {
					ib.Terms("4", "@test", nil)
				})

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have 2 top level aggs with one child agg each", func(t *testing.T) {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 2)

						topAggOne := aggs[0]
						require.Equal(t, "1", topAggOne.Key)
						require.Equal(t, "histogram", topAggOne.Aggregation.Type)
						So(topAggOne.Aggregation.Aggs, ShouldHaveLength, 1)

						topAggOnechildAgg := topAggOne.Aggregation.Aggs[0]
						require.Equal(t, "2", topAggOnechildAgg.Key)
						require.Equal(t, "date_histogram", topAggOnechildAgg.Aggregation.Type)

						topAggTwo := aggs[1]
						require.Equal(t, "3", topAggTwo.Key)
						require.Equal(t, "filters", topAggTwo.Aggregation.Type)
						So(topAggTwo.Aggregation.Aggs, ShouldHaveLength, 1)

						topAggTwochildAgg := topAggTwo.Aggregation.Aggs[0]
						require.Equal(t, "4", topAggTwochildAgg.Key)
						require.Equal(t, "terms", topAggTwochildAgg.Aggregation.Type)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						topAggOne := json.GetPath("aggs", "1")
						require.Equal(t, "@hostname", topAggOne.GetPath("histogram", "field").MustString())
						topAggOnechildAgg := topAggOne.GetPath("aggs", "2")
						require.Equal(t, "@timestamp", topAggOnechildAgg.GetPath("date_histogram", "field").MustString())

						topAggTwo := json.GetPath("aggs", "3")
						topAggTwochildAgg := topAggTwo.GetPath("aggs", "4")
						So(topAggTwo.GetPath("filters").MustArray(), ShouldHaveLength, 0)
						require.Equal(t, "@test", topAggTwochildAgg.GetPath("terms", "field").MustString())
					})
				})
			})

			t.Run("and adding top level agg with child agg with child agg", func(t *testing.T) {
				aggBuilder := b.Agg()
				aggBuilder.Terms("1", "@hostname", func(a *TermsAggregation, ib AggBuilder) {
					ib.Terms("2", "@app", func(a *TermsAggregation, ib AggBuilder) {
						ib.DateHistogram("3", "@timestamp", nil)
					})
				})

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have 1 top level agg with one child having a child", func(t *testing.T) {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						require.Equal(t, "1", topAgg.Key)
						require.Equal(t, "terms", topAgg.Aggregation.Type)
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := topAgg.Aggregation.Aggs[0]
						require.Equal(t, "2", childAgg.Key)
						require.Equal(t, "terms", childAgg.Aggregation.Type)

						childChildAgg := childAgg.Aggregation.Aggs[0]
						require.Equal(t, "3", childChildAgg.Key)
						require.Equal(t, "date_histogram", childChildAgg.Aggregation.Type)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						topAgg := json.GetPath("aggs", "1")
						require.Equal(t, "@hostname", topAgg.GetPath("terms", "field").MustString())

						childAgg := topAgg.GetPath("aggs", "2")
						require.Equal(t, "@app", childAgg.GetPath("terms", "field").MustString())

						childChildAgg := childAgg.GetPath("aggs", "3")
						require.Equal(t, "@timestamp", childChildAgg.GetPath("date_histogram", "field").MustString())
					})
				})
			})

			t.Run("and adding bucket and metric aggs", func(t *testing.T) {
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

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("Should have 1 top level agg with one child having a child", func(t *testing.T) {
						aggs := sr.Aggs
						So(aggs, ShouldHaveLength, 1)

						topAgg := aggs[0]
						require.Equal(t, "1", topAgg.Key)
						require.Equal(t, "terms", topAgg.Aggregation.Type)
						So(topAgg.Aggregation.Aggs, ShouldHaveLength, 1)

						childAgg := topAgg.Aggregation.Aggs[0]
						require.Equal(t, "2", childAgg.Key)
						require.Equal(t, "terms", childAgg.Aggregation.Type)

						childChildOneAgg := childAgg.Aggregation.Aggs[0]
						require.Equal(t, "4", childChildOneAgg.Key)
						require.Equal(t, "avg", childChildOneAgg.Aggregation.Type)

						childChildTwoAgg := childAgg.Aggregation.Aggs[1]
						require.Equal(t, "3", childChildTwoAgg.Key)
						require.Equal(t, "date_histogram", childChildTwoAgg.Aggregation.Type)

						childChildTwoChildOneAgg := childChildTwoAgg.Aggregation.Aggs[0]
						require.Equal(t, "4", childChildTwoChildOneAgg.Key)
						require.Equal(t, "avg", childChildTwoChildOneAgg.Aggregation.Type)

						childChildTwoChildTwoAgg := childChildTwoAgg.Aggregation.Aggs[1]
						require.Equal(t, "5", childChildTwoChildTwoAgg.Key)
						require.Equal(t, "max", childChildTwoChildTwoAgg.Aggregation.Type)
					})

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						termsAgg := json.GetPath("aggs", "1")
						require.Equal(t, "@hostname", termsAgg.GetPath("terms", "field").MustString())

						termsAggTwo := termsAgg.GetPath("aggs", "2")
						require.Equal(t, "@app", termsAggTwo.GetPath("terms", "field").MustString())

						termsAggTwoAvg := termsAggTwo.GetPath("aggs", "4")
						require.Equal(t, "@value", termsAggTwoAvg.GetPath("avg", "field").MustString())

						dateHistAgg := termsAggTwo.GetPath("aggs", "3")
						require.Equal(t, "@timestamp", dateHistAgg.GetPath("date_histogram", "field").MustString())

						avgAgg := dateHistAgg.GetPath("aggs", "4")
						require.Equal(t, "@value", avgAgg.GetPath("avg", "field").MustString())

						maxAgg := dateHistAgg.GetPath("aggs", "5")
						require.Equal(t, "@value", maxAgg.GetPath("max", "field").MustString())
					})
				})
			})
		})

		t.Run("Given new search request builder for es version 2", func(t *testing.T) {
			version2, _ := semver.NewVersion("2.0.0")
			b := NewSearchRequestBuilder(version2, interval.Interval{Value: 15 * time.Second, Text: "15s"})

			t.Run("When adding doc value field", func(t *testing.T) {
				b.AddDocValueField(timeField)

				t.Run("should set correct props", func(t *testing.T) {
					fields, ok := b.customProps["fields"].([]string)
					require.True(t, ok)
					So(fields, ShouldHaveLength, 2)
					require.Equal(t, "*", fields[0])
					require.Equal(t, "_source", fields[1])

					scriptFields, ok := b.customProps["script_fields"].(map[string]interface{})
					require.True(t, ok)
					So(scriptFields, ShouldHaveLength, 0)

					fieldDataFields, ok := b.customProps["fielddata_fields"].([]string)
					require.True(t, ok)
					So(fieldDataFields, ShouldHaveLength, 1)
					require.Equal(t, timeField, fieldDataFields[0])
				})

				t.Run("When building search request", func(t *testing.T) {
					sr, err := b.Build()
					require.NoError(t, err)

					t.Run("When marshal to JSON should generate correct json", func(t *testing.T) {
						body, err := json.Marshal(sr)
						require.NoError(t, err)
						json, err := simplejson.NewJson(body)
						require.NoError(t, err)

						scriptFields, err := json.Get("script_fields").Map()
						require.NoError(t, err)
						So(scriptFields, ShouldHaveLength, 0)

						fields, err := json.Get("fields").StringArray()
						require.NoError(t, err)
						So(fields, ShouldHaveLength, 2)
						require.Equal(t, "*", fields[0])
						require.Equal(t, "_source", fields[1])

						fieldDataFields, err := json.Get("fielddata_fields").StringArray()
						require.NoError(t, err)
						So(fieldDataFields, ShouldHaveLength, 1)
						require.Equal(t, timeField, fieldDataFields[0])
					})
				})
			})
		})
	})
}

func TestMultiSearchRequest(t *testing.T) {
	t.Run("Test elasticsearch multi search request", func(t *testing.T) {
		t.Run("Given new multi search request builder", func(t *testing.T) {
			version2, _ := semver.NewVersion("2.0.0")
			b := NewMultiSearchRequestBuilder(version2)

			t.Run("When adding one search request", func(t *testing.T) {
				b.Search(interval.Interval{Value: 15 * time.Second, Text: "15s"})

				t.Run("When building search request should contain one search request", func(t *testing.T) {
					mr, err := b.Build()
					require.NoError(t, err)
					So(mr.Requests, ShouldHaveLength, 1)
				})
			})

			t.Run("When adding two search requests", func(t *testing.T) {
				b.Search(interval.Interval{Value: 15 * time.Second, Text: "15s"})
				b.Search(interval.Interval{Value: 15 * time.Second, Text: "15s"})

				t.Run("When building search request should contain two search requests", func(t *testing.T) {
					mr, err := b.Build()
					require.NoError(t, err)
					So(mr.Requests, ShouldHaveLength, 2)
				})
			})
		})
	})
}
