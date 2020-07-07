package cloudwatch

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchQuery(t *testing.T) {
	Convey("TestCloudWatchQuery", t, func() {
		Convey("and SEARCH(someexpression) was specified in the query editor", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "SEARCH(someexpression)",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
			}

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression, no multi dimension key values and no * was used", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
			}

			Convey("it is not a search expression", func() {
				So(query.isSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression but multi dimension key values exist", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678", "i-34562312"},
				},
			}

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression but dimension values has *", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				Dimensions: map[string][]string{
					"InstanceId":   {"i-12345678", "*"},
					"InstanceType": {"abc", "def"},
				},
			}

			Convey("it is not a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and query has a multi-valued dimension", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				Dimensions: map[string][]string{
					"InstanceId":   {"i-12345678", "i-12345679"},
					"InstanceType": {"abc"},
				},
			}

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is a multi-valued dimension expression", func() {
				So(query.isMultiValuedDimensionExpression(), ShouldBeTrue)
			})
		})

		Convey("and no dimensions were added", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: false,
				Dimensions: make(map[string][]string),
			}
			Convey("and match exact is false", func() {
				query.MatchExact = false
				Convey("it is a search expression", func() {
					So(query.isSearchExpression(), ShouldBeTrue)
				})

				Convey("it is not math expressions", func() {
					So(query.isMathExpression(), ShouldBeFalse)
				})

				Convey("it is not metric stat", func() {
					So(query.isMetricStat(), ShouldBeFalse)
				})
			})

			Convey("and match exact is true", func() {
				query.MatchExact = true
				Convey("it is a search expression", func() {
					So(query.isSearchExpression(), ShouldBeFalse)
				})

				Convey("it is not math expressions", func() {
					So(query.isMathExpression(), ShouldBeFalse)
				})

				Convey("it is a metric stat", func() {
					So(query.isMetricStat(), ShouldBeTrue)
				})
			})
		})

		Convey("and match exact is", func() {
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Stats:      "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: false,
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
			}

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})

			Convey("it is not metric stat", func() {
				So(query.isMetricStat(), ShouldBeFalse)
			})
		})
	})
}
