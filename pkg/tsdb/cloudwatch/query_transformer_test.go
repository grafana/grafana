package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	. "github.com/smartystreets/goconvey/convey"
)

func TestQueryTransformer(t *testing.T) {
	Convey("TestQueryTransformer", t, func() {
		Convey("when transforming queries", func() {

			executor := &CloudWatchExecutor{}
			Convey("one cloudwatchQuery is generated when its cloudWatchQuery has one stat", func() {
				requestQueries := make(map[string][]*requestQuery)
				requestQueries["region"] = []*requestQuery{
					{
						RefId:          "D",
						Region:         "us-east-1",
						Namespace:      "ec2",
						MetricName:     "CPUUtilization",
						Statistics:     aws.StringSlice([]string{"Average"}),
						Period:         600,
						Id:             "",
						HighResolution: false,
					},
				}

				res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 1)
			})

			Convey("two cloudwatchQuery is generated when there's two stats", func() {
				requestQueries := make(map[string][]*requestQuery)
				requestQueries["region"] = []*requestQuery{
					{
						RefId:          "D",
						Region:         "us-east-1",
						Namespace:      "ec2",
						MetricName:     "CPUUtilization",
						Statistics:     aws.StringSlice([]string{"Average", "Sum"}),
						Period:         600,
						Id:             "",
						HighResolution: false,
					},
				}

				res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
				So(err, ShouldBeNil)
				So(len(res["region"]), ShouldEqual, 2)
			})

			Convey("and id is given by user", func() {
				Convey("that id will be used in the cloudwatch query", func() {
					requestQueries := make(map[string][]*requestQuery)
					requestQueries["region"] = []*requestQuery{
						{
							RefId:          "D",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Period:         600,
							Id:             "myid",
							HighResolution: false,
						},
					}

					res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
					So(err, ShouldBeNil)
					So(len(res["region"]), ShouldEqual, 1)
					So(res["region"], ShouldContainKey, "myid")
				})
			})

			Convey("and id is not given by user", func() {
				Convey("id will be generated based on ref id if query only has one stat", func() {
					requestQueries := make(map[string][]*requestQuery)
					requestQueries["region"] = []*requestQuery{
						{
							RefId:          "D",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
					}

					res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
					So(err, ShouldBeNil)
					So(len(res["region"]), ShouldEqual, 1)
					So(res["region"], ShouldContainKey, "queryD")
				})

				Convey("id will be generated based on ref and stat name if query has two stats", func() {
					requestQueries := make(map[string][]*requestQuery)
					requestQueries["region"] = []*requestQuery{
						{
							RefId:          "D",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average", "Sum"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
					}

					res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
					So(err, ShouldBeNil)
					So(len(res["region"]), ShouldEqual, 2)
					So(res["region"], ShouldContainKey, "queryD_Sum")
					So(res["region"], ShouldContainKey, "queryD_Average")
				})
			})

			Convey("dot should be removed when query has more than one stat and one of them is a percentile", func() {
				requestQueries := make(map[string][]*requestQuery)
				requestQueries["region"] = []*requestQuery{
					{
						RefId:          "D",
						Region:         "us-east-1",
						Namespace:      "ec2",
						MetricName:     "CPUUtilization",
						Statistics:     aws.StringSlice([]string{"Average", "p46.32"}),
						Period:         600,
						Id:             "",
						HighResolution: false,
					},
				}

				res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
				So(err, ShouldBeNil)
				So(len(res["region"]), ShouldEqual, 2)
				So(res["region"], ShouldContainKey, "queryD_p46_32")
			})

			Convey("should return an error if two queries have the same id", func() {
				requestQueries := make(map[string][]*requestQuery)
				requestQueries["region"] = []*requestQuery{
					{
						RefId:          "D",
						Region:         "us-east-1",
						Namespace:      "ec2",
						MetricName:     "CPUUtilization",
						Statistics:     aws.StringSlice([]string{"Average", "p46.32"}),
						Period:         600,
						Id:             "myId",
						HighResolution: false,
					},
					{
						RefId:          "E",
						Region:         "us-east-1",
						Namespace:      "ec2",
						MetricName:     "CPUUtilization",
						Statistics:     aws.StringSlice([]string{"Average", "p46.32"}),
						Period:         600,
						Id:             "myId",
						HighResolution: false,
					},
				}

				res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
				So(res, ShouldBeNil)
				So(err, ShouldNotBeNil)
			})
		})
	})
}
