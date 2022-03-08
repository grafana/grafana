package cloudwatch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricDataQueryBuilder(t *testing.T) {
	t.Run("buildMetricDataQuery", func(t *testing.T) {
		t.Run("should use metric stat", func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{})
			query := getBaseQuery()
			query.MetricEditorMode = MetricEditorModeBuilder
			query.MetricQueryType = MetricQueryTypeSearch
			mdq, err := executor.buildMetricDataQuery(query)
			require.NoError(t, err)
			require.Empty(t, mdq.Expression)
			assert.Equal(t, query.MetricName, *mdq.MetricStat.Metric.MetricName)
			assert.Equal(t, query.Namespace, *mdq.MetricStat.Metric.Namespace)
		})

		t.Run("should use custom built expression", func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{})
			query := getBaseQuery()
			query.MetricEditorMode = MetricEditorModeBuilder
			query.MetricQueryType = MetricQueryTypeSearch
			query.MatchExact = false
			mdq, err := executor.buildMetricDataQuery(query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization" "LoadBalancer"="lb1"', '', 300))`, *mdq.Expression)
		})

		t.Run("should use sql expression", func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{})
			query := getBaseQuery()
			query.MetricEditorMode = MetricEditorModeRaw
			query.MetricQueryType = MetricQueryTypeQuery
			query.SqlExpression = `SELECT SUM(CPUUTilization) FROM "AWS/EC2"`
			mdq, err := executor.buildMetricDataQuery(query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, query.SqlExpression, *mdq.Expression)
		})

		t.Run("should use user defined math expression", func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{})
			query := getBaseQuery()
			query.MetricEditorMode = MetricEditorModeRaw
			query.MetricQueryType = MetricQueryTypeSearch
			query.Expression = `SUM(x+y)`
			mdq, err := executor.buildMetricDataQuery(query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, query.Expression, *mdq.Expression)
		})

		t.Run("should set period in user defined expression", func(t *testing.T) {
			executor := newExecutor(nil, newTestConfig(), &fakeSessionCache{})
			query := getBaseQuery()
			query.MetricEditorMode = MetricEditorModeRaw
			query.MetricQueryType = MetricQueryTypeSearch
			query.MatchExact = false
			query.Expression = `SUM([a,b])`
			mdq, err := executor.buildMetricDataQuery(query)
			require.NoError(t, err)
			require.Nil(t, mdq.MetricStat)
			assert.Equal(t, int64(300), *mdq.Period)
			assert.Equal(t, `SUM([a,b])`, *mdq.Expression)
		})
	})

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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId","LoadBalancer"} MetricName="CPUUtilization" "InstanceId"=("i-123" OR "i-456" OR "i-789") "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","LoadBalancer"} MetricName="CPUUtilization"', 'Average', 300))`, res)
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/EC2","InstanceId","LoadBalancer"} MetricName="CPUUtilization" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
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
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"AWS/Kafka","Cluster Name"} MetricName="CpuUser" "Cluster Name"="dev-cluster"', 'Average', 300))`, res)
		})

		t.Run("Query has a custom namespace contains spaces", func(t *testing.T) {
			query := &cloudWatchQuery{
				Namespace:  "Test-API Cache by Minute",
				MetricName: "CpuUser",
				Dimensions: map[string][]string{
					"LoadBalancer": {"lb1", "lb2", "lb3"},
					"InstanceId":   {"i-123", "*", "i-789"},
				},
				Period:     300,
				Expression: "",
				MatchExact: matchExact,
			}

			res := buildSearchExpression(query, "Average")
			assert.Equal(t, `REMOVE_EMPTY(SEARCH('{"Test-API Cache by Minute","InstanceId","LoadBalancer"} MetricName="CpuUser" "LoadBalancer"=("lb1" OR "lb2" OR "lb3")', 'Average', 300))`, res)
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

func getBaseQuery() *cloudWatchQuery {
	query := &cloudWatchQuery{
		Namespace:  "AWS/EC2",
		MetricName: "CPUUtilization",
		Dimensions: map[string][]string{
			"LoadBalancer": {"lb1"},
		},
		Period:     300,
		Expression: "",
		MatchExact: true,
	}
	return query
}
