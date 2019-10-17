package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudwatchQuery(t *testing.T) {
	Convey("TestCloudwatchQuery", t, func() {
		Convey("and SEARCH(someexpression) was specified in the query editor", func() {
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "SEARCH(someexpression)",
				Statistics: []*string{aws.String("Average")},
				Period:     300,
				Id:         "id1",
				Identifier: "id1",
			}

			Convey("it is a user defined search expression", func() {
				So(query.isUserDefinedSearchExpression(), ShouldBeTrue)
			})

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not an inferred search expression", func() {
				So(query.isInferredSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression, no multi dimension key values and no * was used", func() {
			dimensions := make(map[string][]string)
			dimensions["InstanceId"] = []string{"i-12345678"}
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistics: []*string{aws.String("Average")},
				Period:     300,
				Id:         "id1",
				Identifier: "id1",
				Dimensions: dimensions,
			}

			Convey("it is not a user defined search expression", func() {
				So(query.isUserDefinedSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not a search expression", func() {
				So(query.isSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not an inferred search expression", func() {
				So(query.isInferredSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression but multi dimension key values exist", func() {
			dimensions := make(map[string][]string)
			dimensions["InstanceId"] = []string{"i-12345678", "i-34562312"}
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistics: []*string{aws.String("Average")},
				Period:     300,
				Id:         "id1",
				Identifier: "id1",
				Dimensions: dimensions,
			}

			Convey("it is not a user defined search expression", func() {
				So(query.isUserDefinedSearchExpression(), ShouldBeFalse)
			})

			Convey("it is a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is an inferred search expression", func() {
				So(query.isInferredSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})

		Convey("and no expression but dimension values has *", func() {
			dimensions := make(map[string][]string)
			dimensions["InstanceType"] = []string{"abc", "def"}
			dimensions["InstanceId"] = []string{"i-12345678", "*"}
			query := &CloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistics: []*string{aws.String("Average")},
				Period:     300,
				Id:         "id1",
				Identifier: "id1",
				Dimensions: dimensions,
			}

			Convey("it is not a user defined search expression", func() {
				So(query.isUserDefinedSearchExpression(), ShouldBeFalse)
			})

			Convey("it is not a search expression", func() {
				So(query.isSearchExpression(), ShouldBeTrue)
			})

			Convey("it is an inferred search expression", func() {
				So(query.isInferredSearchExpression(), ShouldBeTrue)
			})

			Convey("it is not math expressions", func() {
				So(query.isMathExpression(), ShouldBeFalse)
			})
		})
	})
}
