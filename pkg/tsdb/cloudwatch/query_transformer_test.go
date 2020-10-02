package cloudwatch

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueryTransformer(t *testing.T) {
	executor := newExecutor()
	t.Run("One cloudwatchQuery is generated when its request query has one stat", func(t *testing.T) {
		requestQueries := []*requestQuery{
			{
				RefId:      "D",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average"}),
				Period:     600,
				Id:         "",
			},
		}

		res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
		require.NoError(t, err)
		assert.Len(t, res, 1)
	})

	t.Run("Two cloudwatchQuery is generated when there's two stats", func(t *testing.T) {
		requestQueries := []*requestQuery{
			{
				RefId:      "D",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average", "Sum"}),
				Period:     600,
				Id:         "",
			},
		}

		res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
		require.NoError(t, err)
		assert.Len(t, res, 2)
	})
	t.Run("id is given by user that will be used in the cloudwatch query", func(t *testing.T) {
		requestQueries := []*requestQuery{
			{
				RefId:      "D",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average"}),
				Period:     600,
				Id:         "myid",
			},
		}

		res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
		require.Nil(t, err)
		assert.Equal(t, len(res), 1)
		assert.Contains(t, res, "myid")
	})

	t.Run("ID is not given by user", func(t *testing.T) {
		t.Run("ID will be generated based on ref ID if query only has one stat", func(t *testing.T) {
			requestQueries := []*requestQuery{
				{
					RefId:      "D",
					Region:     "us-east-1",
					Namespace:  "ec2",
					MetricName: "CPUUtilization",
					Statistics: aws.StringSlice([]string{"Average"}),
					Period:     600,
					Id:         "",
				},
			}

			res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
			require.NoError(t, err)
			assert.Len(t, res, 1)
			assert.Contains(t, res, "queryD")
		})

		t.Run("ID will be generated based on ref and stat name if query has two stats", func(t *testing.T) {
			requestQueries := []*requestQuery{
				{
					RefId:      "D",
					Region:     "us-east-1",
					Namespace:  "ec2",
					MetricName: "CPUUtilization",
					Statistics: aws.StringSlice([]string{"Average", "Sum"}),
					Period:     600,
					Id:         "",
				},
			}

			res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
			require.NoError(t, err)
			assert.Len(t, res, 2)
			assert.Contains(t, res, "queryD_Sum")
			assert.Contains(t, res, "queryD_Average")
		})
	})

	t.Run("dot should be removed when query has more than one stat and one of them is a percentile", func(t *testing.T) {
		requestQueries := []*requestQuery{
			{
				RefId:      "D",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average", "p46.32"}),
				Period:     600,
				Id:         "",
			},
		}

		res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
		require.NoError(t, err)
		assert.Len(t, res, 2)
		assert.Contains(t, res, "queryD_p46_32")
	})

	t.Run("should return an error if two queries have the same id", func(t *testing.T) {
		requestQueries := []*requestQuery{
			{
				RefId:      "D",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average", "p46.32"}),
				Period:     600,
				Id:         "myId",
			},
			{
				RefId:      "E",
				Region:     "us-east-1",
				Namespace:  "ec2",
				MetricName: "CPUUtilization",
				Statistics: aws.StringSlice([]string{"Average", "p46.32"}),
				Period:     600,
				Id:         "myId",
			},
		}

		res, err := executor.transformRequestQueriesToCloudWatchQueries(requestQueries)
		require.Nil(t, res)
		assert.Error(t, err)
	})
}
