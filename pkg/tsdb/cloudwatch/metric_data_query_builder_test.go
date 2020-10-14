package cloudwatch

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMetricDataQueryBuilder_buildSearchExpression(t *testing.T) {
	t.Run("Query should be matched exact", func(t *testing.T) {
		const matchExact = true

		t.Run("Query has three dimension values for a given dimension key", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
		})

		t.Run("Query has three dimension values for two given dimension keys", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"InstanceId","LoadBalancer"} MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
		})

		t.Run("No OR operator was added if a star was used for dimension value", func(t *testing.T) {
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
			assert.NotContains(t, res, "OR")
		})

		t.Run("Query has one dimension key with a * value", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"LoadBalancer"} MetricName="CPUUtilization"', 'Average', 300))`, res)
		})

		t.Run("Query has three dimension values for two given dimension keys, and one value is a star", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{AWS/EC2,"InstanceId","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
		})

		t.Run("Query has a dimension key with a space", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{AWS/Kafka,"Cluster Name"} MetricName="CpuUser" "Cluster Name"="dev-cluster"', 'Average', 300))`, res)
		})
	})

	t.Run("Query should not be matched exact", func(t *testing.T) {
		const matchExact = false

		t.Run("Query has three dimension values for a given dimension key", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
		})

		t.Run("Query has three dimension values for two given dimension keys", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
		})

		t.Run("Query has one dimension key with a * value", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"', 'Average', 300))`, res)
		})

		t.Run("query has three dimension values for two given dimension keys, and one value is a star", func(t *testing.T) {
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3") "InstanceId"', 'Average', 300))`, res)
		})
	})

	t.Run("Query has invalid characters in dimension values", func(t *testing.T) {
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

		assert.Contains(t, res, `lb4\"\"`, "Expected escape double quotes")
	})
}
