package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestCloudWatchQueryBuilder(t *testing.T) {
	Convey("TestCloudWatchQueryBuilder", t, func() {
		e := &CloudWatchExecutor{
			DataSource: &models.DataSource{
				JsonData: simplejson.New(),
			},
		}

		Convey("building GetMetricDataQueries", func() {
			Convey("and one GetMetricDataInput is generated for each query statistic", func() {
				dimensions := make(map[string][]string)
				dimensions["InstanceId"] = []string{"i-12345678"}
				query := &CloudWatchQuery{
					RefId:      "A",
					Region:     "us-east-1",
					Namespace:  "AWS/EC2",
					MetricName: "CPUUtilization",
					Dimensions: dimensions,
					Statistics: []*string{aws.String("Average"), aws.String("Sum")},
					Period:     300,
					Id:         "id1",
					Identifier: "id1",
					Expression: "",
				}

				res, err := e.buildMetricDataQueries(query)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 2)
				So(*res[0].Id, ShouldEqual, "id1_____0")
				So(*res[1].Id, ShouldEqual, "id1_____1")
			})

			Convey("and query expression will be used if it was set in query editor", func() {
				query := &CloudWatchQuery{
					RefId:      "A",
					Region:     "us-east-1",
					Expression: "SEARCH(someexpression)",
					Statistics: []*string{aws.String("Average")},
					Period:     300,
					Id:         "id1",
					Identifier: "id1",
				}

				res, err := e.buildMetricDataQueries(query)
				So(err, ShouldBeNil)
				So(len(res), ShouldEqual, 1)
				So(*res[0].Expression, ShouldEqual, "SEARCH(someexpression)")
			})

			Convey("and metric stat", func() {
				Convey("will be used when expression is not set in the client and not more than one dimension value is used for on specific key and a star is not being used as dimension value", func() {
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

					res, err := e.buildMetricDataQueries(query)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(res[0].Expression, ShouldBeNil)
					So(res[0].MetricStat, ShouldNotBeNil)
				})

				Convey("will be not used when expression is set in the client", func() {
					dimensions := make(map[string][]string)
					dimensions["InstanceId"] = []string{"i-12345678"}
					query := &CloudWatchQuery{
						RefId:      "A",
						Region:     "us-east-1",
						Expression: "SEARCH(",
						Statistics: []*string{aws.String("Average")},
						Period:     300,
						Id:         "id1",
						Identifier: "id1",
						Dimensions: dimensions,
					}

					res, err := e.buildMetricDataQueries(query)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(res[0].Expression, ShouldNotBeNil)
					So(res[0].MetricStat, ShouldBeNil)
				})

			})

			Convey("and query expression is being generated server side", func() {
				Convey("and query has three dimension values for a given dimension key", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"lb1", "lb2", "lb3"}
					query := &CloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: dimensions,
						Statistics: []*string{aws.String("Average")},
						Period:     300,
						Identifier: "id1",
						Expression: "",
					}

					res, err := e.buildMetricDataQueries(query)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(len(res), ShouldEqual, 1)
					So(*res[0].Expression, ShouldEqual, "SEARCH('{AWS/EC2,LoadBalancer} MetricName=\"CPUUtilization\" LoadBalancer=(\"lb1\" OR \"lb2\" OR \"lb3\")', 'Average', 300)")
				})

				Convey("and query has three dimension values for two given dimension keys", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"lb1", "lb2", "lb3"}
					dimensions["InstanceId"] = []string{"i-123", "i-456", "i-789"}
					query := &CloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: dimensions,
						Statistics: []*string{aws.String("Average")},
						Period:     300,
						Identifier: "id1",
						Expression: "",
					}

					res, err := e.buildMetricDataQueries(query)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(*res[0].Expression, ShouldEqual, "SEARCH('{AWS/EC2,LoadBalancer,InstanceId} MetricName=\"CPUUtilization\" LoadBalancer=(\"lb1\" OR \"lb2\" OR \"lb3\") AND InstanceId=(\"i-123\" OR \"i-456\" OR \"i-789\")', 'Average', 300)")
				})

				Convey("and no AND/OR operators were added if a star was used for dimension value", func() {
					dimensions := make(map[string][]string)
					dimensions["LoadBalancer"] = []string{"*"}
					query := &CloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: dimensions,
						Statistics: []*string{aws.String("Average")},
						Period:     300,
						Identifier: "id1",
						Expression: "",
					}

					res, err := e.buildMetricDataQueries(query)
					So(err, ShouldBeNil)
					So(len(res), ShouldEqual, 1)
					So(*res[0].Expression, ShouldNotContainSubstring, "AND")
					So(*res[0].Expression, ShouldNotContainSubstring, "OR")
				})
			})
		})
	})
}
