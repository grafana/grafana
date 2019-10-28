package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMetricDataInputBuilder(t *testing.T) {
	Convey("TestMetricDataInputBuilder", t, func() {
		const (
			maxNoOfSearchExpressions = 2
			maxNoOfMetricDataQueries = 5
		)
		mdib := &metricDataInputBuilder{maxNoOfSearchExpressions, maxNoOfMetricDataQueries}
		ctx := &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-3h", "now-2h")}

		metricStatQueryWithoutID := &cloudWatchQuery{
			RefId:      "metricStatQueryWithoutID",
			Expression: "",
			Stats:      "Average",
			Period:     300,
			Id:         "",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678"}},
		}

		metricStatQueryWithDefinedID := &cloudWatchQuery{
			RefId:         "metricStatQueryWithDefinedID",
			Expression:    "",
			Stats:         "Average",
			Period:        300,
			UserDefinedId: "metricStatQueryWithID",
			Id:            "metricStatQueryWithID",
			Dimensions:    map[string][]string{"InstanceId": {"i-12345678"}},
		}

		mathExpression := &cloudWatchQuery{
			RefId:      "mathExpression",
			Expression: "a * 2",
			Stats:      "Average",
			Period:     300,
			Id:         "mathExpression",
			Dimensions: map[string][]string{},
		}

		userDefinedSearchExpression := &cloudWatchQuery{
			RefId:      "userDefinedSearchExpression",
			Expression: "SEARCH(someexpression)",
			Stats:      "Average",
			Period:     300,
			Id:         "userDefinedSearchExpression",
			Dimensions: map[string][]string{},
		}

		inferredSearchExpression := &cloudWatchQuery{
			RefId:      "inferredSearchExpression",
			Expression: "",
			Stats:      "Average",
			Period:     300,
			Id:         "inferredSearchExpression",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678", "i-34562312"}},
		}

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := mdib.buildMetricDataInputs(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")}, []*cloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := mdib.buildMetricDataInputs(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")}, []*cloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})

		Convey("and testing sort order", func() {
			Convey("and there's one metric stat query, one math expression and one search expression", func() {
				queries := []*cloudWatchQuery{mathExpression, userDefinedSearchExpression, metricStatQueryWithoutID}
				mdib.sortQueries(queries)
				So(queries[0].RefId, ShouldEqual, "metricStatQueryWithoutID")
				So(queries[1].RefId, ShouldEqual, "mathExpression")
				So(queries[2].RefId, ShouldEqual, "userDefinedSearchExpression")
			})

			Convey("and there's two search expressions, one match expression and one metric stat ", func() {
				queries := []*cloudWatchQuery{inferredSearchExpression, mathExpression, userDefinedSearchExpression, metricStatQueryWithoutID}
				mdib.sortQueries(queries)
				So(queries[0].RefId, ShouldEqual, "metricStatQueryWithoutID")
				So(queries[1].RefId, ShouldEqual, "mathExpression")
				So(queries[2].RefId, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
				So(queries[3].RefId, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
			})
		})

		Convey("and testing metricDataInput bulding", func() {
			Convey("first metricDataInput is filled with metric stat queries without ID only", func() {
				res, err := mdib.buildMetricDataInputs(ctx, []*cloudWatchQuery{inferredSearchExpression, userDefinedSearchExpression, mathExpression, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithDefinedID})

				So(err, ShouldBeNil)
				So(*res[0].MetricDataQueries[0].MetricStat, ShouldNotBeNil)
				So(*res[0].MetricDataQueries[1].MetricStat, ShouldNotBeNil)
				So(*res[0].MetricDataQueries[2].MetricStat, ShouldNotBeNil)

				So(*res[1].MetricDataQueries[0].Id, ShouldEqual, "metricStatQueryWithID")
				So(*res[1].MetricDataQueries[1].Id, ShouldEqual, "mathExpression")
				So(*res[1].MetricDataQueries[2].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
				So(*res[1].MetricDataQueries[3].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
			})
		})

		Convey("a maximum of 2 search expressions are used in each metricDataInput", func() {
			res, err := mdib.buildMetricDataInputs(ctx, []*cloudWatchQuery{
				inferredSearchExpression,
				inferredSearchExpression,
				inferredSearchExpression,
				userDefinedSearchExpression,
				userDefinedSearchExpression,
				userDefinedSearchExpression,
				mathExpression,
				metricStatQueryWithoutID,
				metricStatQueryWithoutID,
				metricStatQueryWithoutID,
				metricStatQueryWithoutID,
				metricStatQueryWithDefinedID})

			So(err, ShouldBeNil)
			So(*res[0].MetricDataQueries[0].MetricStat, ShouldNotBeNil)
			So(*res[0].MetricDataQueries[1].MetricStat, ShouldNotBeNil)
			So(*res[0].MetricDataQueries[2].MetricStat, ShouldNotBeNil)
			So(*res[0].MetricDataQueries[3].MetricStat, ShouldNotBeNil)

			So(*res[1].MetricDataQueries[0].Id, ShouldEqual, "metricStatQueryWithID")
			So(*res[1].MetricDataQueries[1].Id, ShouldEqual, "mathExpression")
			So(*res[1].MetricDataQueries[2].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
			So(*res[1].MetricDataQueries[3].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})

			So(*res[2].MetricDataQueries[0].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
			So(*res[2].MetricDataQueries[1].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})

			So(*res[3].MetricDataQueries[0].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})
			So(*res[3].MetricDataQueries[1].Id, ShouldBeIn, []string{"inferredSearchExpression", "userDefinedSearchExpression"})

		})

		Convey("only one MetricDataInput is used when there's four metric stat queries", func() {
			res, err := mdib.buildMetricDataInputs(ctx, []*cloudWatchQuery{
				metricStatQueryWithoutID,
				metricStatQueryWithoutID,
				metricStatQueryWithoutID,
				metricStatQueryWithoutID})

			So(err, ShouldBeNil)
			So(len(res), ShouldEqual, 1)
		})

		Convey("only one MetricDataInput is used when there's two search expression queries", func() {
			res, err := mdib.buildMetricDataInputs(ctx, []*cloudWatchQuery{
				userDefinedSearchExpression,
				userDefinedSearchExpression})

			So(err, ShouldBeNil)
			So(len(res), ShouldEqual, 1)
		})
	})
}
