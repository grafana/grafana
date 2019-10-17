package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
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

		metricStatQueryWithID := &CloudWatchQuery{
			RefId:      "metricStatQueryWithID",
			Expression: "",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "id1",
			Identifier: "metricStatQueryWithID",
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678"},
			},
		}

		userDefinedSearchExpressionQueryWithID := &CloudWatchQuery{
			RefId:      "userDefinedSearchExpressionQueryWithID",
			Expression: "SEARCH(someexpression)",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "id1",
			Identifier: "userDefinedSearchExpressionQueryWithID",
			Dimensions: map[string][]string{},
		}

		userDefinedSearchExpressionQueryWithoutID := &CloudWatchQuery{
			RefId:      "userDefinedSearchExpressionQueryWithoutID",
			Expression: "SEARCH(someexpression)",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "",
			Identifier: "userDefinedSearchExpressionQueryWithoutID",
			Dimensions: map[string][]string{},
		}

		metricStatQueryWithoutID := &CloudWatchQuery{
			RefId:      "metricStatQueryWithoutID",
			Expression: "",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "",
			Identifier: "metricStatQueryWithoutID",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678"}},
		}

		inferredSearchExpressionQueryWithID := &CloudWatchQuery{
			RefId:      "inferredSearchExpressionQueryWithID",
			Expression: "",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "id1",
			Identifier: "inferredSearchExpressionQueryWithID",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678", "i-34562312"}},
		}

		inferredSearchExpressionQueryWithoutID := &CloudWatchQuery{
			RefId:      "inferredSearchExpressionQueryWithoutID",
			Expression: "",
			Statistics: []*string{aws.String("Average")},
			Period:     300,
			Id:         "",
			Identifier: "inferredSearchExpressionQueryWithoutID",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678", "i-34562312"}},
		}

		inferredSearchExpressionQueryWithMultipleStats := &CloudWatchQuery{
			RefId:      "inferredSearchExpressionQueryWithMultipleStats",
			Expression: "",
			Statistics: []*string{aws.String("Average"), aws.String("Sum")},
			Period:     300,
			Id:         "",
			Identifier: "inferredSearchExpressionQueryWithMultipleStats",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678", "i-34562312"}},
		}

		metricStatQueryWithMultipleStats := &CloudWatchQuery{
			RefId:      "metricStatQueryWithMultipleStats",
			Expression: "",
			Statistics: []*string{aws.String("Average"), aws.String("Sum")},
			Period:     300,
			Id:         "",
			Identifier: "metricStatQueryWithMultipleStats",
			Dimensions: map[string][]string{"InstanceId": {"i-12345678"}},
		}

		Convey("Time range is valid", func() {
			Convey("End time before start time should result in error", func() {
				_, err := mdib.buildMetricDataInput(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-2h")}, []*CloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})

			Convey("End time equals start time should result in error", func() {
				_, err := mdib.buildMetricDataInput(&tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("now-1h", "now-1h")}, []*CloudWatchQuery{})
				So(err.Error(), ShouldEqual, "Invalid time range: Start time must be before end time")
			})
		})

		Convey("and testing sort order", func() {
			Convey("and there's two metric stat queries with id and one search expression", func() {
				queries := []*CloudWatchQuery{userDefinedSearchExpressionQueryWithID, metricStatQueryWithID, metricStatQueryWithID}
				res := sortQueries(queries)
				So(res[0].RefId, ShouldEqual, "metricStatQueryWithID")
				So(res[1].RefId, ShouldEqual, "metricStatQueryWithID")
				So(res[2].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithID")
			})

			Convey("with four queries ", func() {
				queries := []*CloudWatchQuery{userDefinedSearchExpressionQueryWithID, metricStatQueryWithID,
					userDefinedSearchExpressionQueryWithoutID, metricStatQueryWithoutID}
				res := sortQueries(queries)
				So(res[0].RefId, ShouldEqual, "metricStatQueryWithID")
				So(res[1].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithID")
				So(res[2].RefId, ShouldEqual, "metricStatQueryWithoutID")
				So(res[3].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithoutID")
			})

			Convey("with search expressions only ", func() {
				queries := []*CloudWatchQuery{userDefinedSearchExpressionQueryWithID, userDefinedSearchExpressionQueryWithoutID, inferredSearchExpressionQueryWithID, inferredSearchExpressionQueryWithoutID}
				res := sortQueries(queries)
				So(res[0].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithID")
				So(res[1].RefId, ShouldEqual, "inferredSearchExpressionQueryWithID")
				So(res[2].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithoutID")
				So(res[3].RefId, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
			})

			Convey("queries without id", func() {
				queries := []*CloudWatchQuery{inferredSearchExpressionQueryWithoutID, metricStatQueryWithoutID, userDefinedSearchExpressionQueryWithoutID}
				res := sortQueries(queries)
				So(res[0].RefId, ShouldEqual, "metricStatQueryWithoutID")
				So(res[1].RefId, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
				So(res[2].RefId, ShouldEqual, "userDefinedSearchExpressionQueryWithoutID")
			})

			Convey("queries with multiple stats", func() {
				queries := []*CloudWatchQuery{inferredSearchExpressionQueryWithMultipleStats, metricStatQueryWithMultipleStats, inferredSearchExpressionQueryWithoutID}
				res := sortQueries(queries)
				So(res[0].RefId, ShouldEqual, "metricStatQueryWithMultipleStats")
				So(res[1].RefId, ShouldEqual, "inferredSearchExpressionQueryWithMultipleStats")
				So(res[2].RefId, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
			})
		})

		Convey("and testing metricDataInput bulding", func() {
			Convey("first metricDataInput is filled with metric stat queries", func() {
				res, err := mdib.buildMetricDataInput(ctx, []*CloudWatchQuery{inferredSearchExpressionQueryWithoutID, inferredSearchExpressionQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID, metricStatQueryWithoutID})
				So(err, ShouldBeNil)
				So(*res[0].MetricDataQueries[0].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[0].MetricDataQueries[1].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[0].MetricDataQueries[2].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[0].MetricDataQueries[3].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[0].MetricDataQueries[4].Id, ShouldEqual, "metricStatQueryWithoutID")

				So(*res[1].MetricDataQueries[0].Id, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
				So(*res[1].MetricDataQueries[1].Id, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
			})

			Convey("a maximum of 2 search expressions are used in each metricDataInput", func() {
				res, err := mdib.buildMetricDataInput(ctx, []*CloudWatchQuery{
					inferredSearchExpressionQueryWithoutID,
					inferredSearchExpressionQueryWithID,
					userDefinedSearchExpressionQueryWithID,
					userDefinedSearchExpressionQueryWithID,
					userDefinedSearchExpressionQueryWithID,
					inferredSearchExpressionQueryWithID,
					inferredSearchExpressionQueryWithoutID,
					metricStatQueryWithoutID,
					metricStatQueryWithoutID,
					metricStatQueryWithoutID,
					metricStatQueryWithoutID,
					metricStatQueryWithoutID})
				So(err, ShouldBeNil)

				So(*res[0].MetricDataQueries[0].Id, ShouldEqual, "inferredSearchExpressionQueryWithID")
				So(*res[0].MetricDataQueries[1].Id, ShouldEqual, "userDefinedSearchExpressionQueryWithID")

				So(*res[1].MetricDataQueries[0].Id, ShouldEqual, "userDefinedSearchExpressionQueryWithID")
				So(*res[1].MetricDataQueries[1].Id, ShouldEqual, "userDefinedSearchExpressionQueryWithID")

				So(*res[2].MetricDataQueries[0].Id, ShouldEqual, "inferredSearchExpressionQueryWithID")
				So(*res[2].MetricDataQueries[1].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[2].MetricDataQueries[2].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[2].MetricDataQueries[3].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[2].MetricDataQueries[4].Id, ShouldEqual, "metricStatQueryWithoutID")

				So(*res[3].MetricDataQueries[0].Id, ShouldEqual, "metricStatQueryWithoutID")
				So(*res[3].MetricDataQueries[1].Id, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
				So(*res[3].MetricDataQueries[2].Id, ShouldEqual, "inferredSearchExpressionQueryWithoutID")
			})
		})
	})
}
