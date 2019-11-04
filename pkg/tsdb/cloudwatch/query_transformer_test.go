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
				requestQueries := []*requestQuery{
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
				requestQueries := []*requestQuery{
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
				So(len(res), ShouldEqual, 2)
			})
			Convey("and id is given by user", func() {
				Convey("that id will be used in the cloudwatch query", func() {
					requestQueries := []*requestQuery{
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
					So(len(res), ShouldEqual, 1)
					So(res, ShouldContainKey, "myid")
				})
			})

			Convey("and id is not given by user", func() {
				Convey("and queries is just one search expression", func() {
					Convey("id will be e1 if query has only 1 stat", func() {
						requestQueries := []*requestQuery{
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
						So(res, ShouldContainKey, "e1")
					})

					Convey("id will be e1 if query has two stats", func() {
						requestQueries := []*requestQuery{
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
						So(len(res), ShouldEqual, 2)
						So(res, ShouldContainKey, "e1")
						So(res, ShouldContainKey, "e2")
					})

					Convey("dot should be removed when query has more than one stat and one of them is a percentile", func() {
						requestQueries := []*requestQuery{
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
						So(len(res), ShouldEqual, 2)
						So(res, ShouldContainKey, "e2")
					})
				})

				Convey("and queries is multiple request queries", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"lb"}
					requestQueries := []*requestQuery{
						{
							RefId:          "A",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Dimensions:     dimensions,
							MatchExact:     true,
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
						{
							RefId:          "B",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MetricName:     "CPUUtilization",
							Dimensions:     dimensions,
							MatchExact:     true,
							Expression:     "SEARCH(expression)",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
						{
							RefId:          "C",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MatchExact:     true,
							Dimensions:     dimensions,
							MetricName:     "CPUUtilization",
							Expression:     "B * 2",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
						{
							RefId:          "D",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MatchExact:     true,
							Dimensions:     dimensions,
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average", "Sum"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
						{
							RefId:          "E",
							Region:         "us-east-1",
							Namespace:      "ec2",
							MatchExact:     true,
							Dimensions:     dimensions,
							MetricName:     "CPUUtilization",
							Statistics:     aws.StringSlice([]string{"Average"}),
							Period:         600,
							Id:             "",
							HighResolution: false,
						},
					}
					Convey("id will be e1 if query has only 1 stat", func() {

						res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
						So(err, ShouldBeNil)
						So(len(res), ShouldEqual, 6)
						So(res["m1"].RefId, ShouldEqual, "A")
						So(res["e1"].RefId, ShouldEqual, "B")
						So(res["e2"].RefId, ShouldEqual, "C")
						So(res["m2"].RefId, ShouldEqual, "D")
						So(res["m3"].RefId, ShouldEqual, "D")
						So(res["m4"].RefId, ShouldEqual, "E")
					})
				})
			})

			Convey("should return an error if two queries have the same id", func() {
				requestQueries := []*requestQuery{
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
