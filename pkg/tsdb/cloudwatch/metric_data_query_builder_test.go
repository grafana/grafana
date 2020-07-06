package cloudwatch

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMetricDataQueryBuilder(t *testing.T) {
	Convey("TestMetricDataQueryBuilder", t, func() {
		Convey("buildSearchExpression", func() {
			Convey("and query should be matched exact", func() {
				matchExact := true
				Convey("and query has three dimension values for a given dimension key", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`)
				})

				Convey("and query has three dimension values for two given dimension keys", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
							"InstanceId":   {"i-123", "i-456", "i-789"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"InstanceId","LoadBalancer"} MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`)
				})

				Convey("and no OR operator was added if a star was used for dimension value", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"*"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldNotContainSubstring, "OR")
				})

				Convey("and query has one dimension key with a * value", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"*"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"LoadBalancer"} MetricName="CPUUtilization"', 'Average', 300))`)
				})

				Convey("and query has three dimension values for two given dimension keys, and one value is a star", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
							"InstanceId":   {"i-123", "*", "i-789"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"InstanceId","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`)
				})

				Convey("and query has a dimension key with a space", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/Kafka",
						MetricName: "CpuUser",
						Dimensions: map[string][]string{
							"Cluster Name": {"dev-cluster"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('{AWS/Kafka,"Cluster Name"} MetricName="CpuUser" "Cluster Name"="dev-cluster"', 'Average', 300))`)
				})
			})

			Convey("and query should not be matched exact", func() {
				matchExact := false
				Convey("and query has three dimension values for a given dimension key", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`)
				})

				Convey("and query has three dimension values for two given dimension keys", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
							"InstanceId":   {"i-123", "i-456", "i-789"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`)
				})

				Convey("and query has one dimension key with a * value", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"*"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"', 'Average', 300))`)
				})

				Convey("and query has three dimension values for two given dimension keys, and one value is a star", func() {
					query := &cloudWatchQuery{
						Namespace:  "AWS/EC2",
						MetricName: "CPUUtilization",
						Dimensions: map[string][]string{
							"LoadBalancer": {"lb1", "lb2", "lb3"},
							"InstanceId":   {"i-123", "*", "i-789"},
						},
						Period:     300,
						Expression: "",
						MatchExact: matchExact,
					}

					res := buildSearchExpression(query, "Average")
					So(res, ShouldEqual, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3") "InstanceId"', 'Average', 300))`)
				})
			})
		})

		Convey("and query has invalid characters in dimension values", func() {
			query := &cloudWatchQuery{
				Namespace:  "AWS/EC2",
				MetricName: "CPUUtilization",
				Dimensions: map[string][]string{
					"lb4": {`lb4""`},
				},
				Period:     300,
				Expression: "",
				MatchExact: true,
			}
			res := buildSearchExpression(query, "Average")

			Convey("it should escape double quotes", func() {
				So(res, ShouldContainSubstring, `lb4\"\"`)
			})
		})
	})
}
