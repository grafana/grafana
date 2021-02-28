package cloudwatch

import (
	"net/url"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueryTransformer(t *testing.T) {
	executor := newExecutor(nil)
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

	requestQueries := []*requestQuery{
		{
			RefId:      "D",
			Region:     "us-east-1",
			Namespace:  "ec2",
			MetricName: "CPUUtilization",
			Statistics: aws.StringSlice([]string{"Sum"}),
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

	t.Run("A deep link that reference two metric stat metrics is created based on a request query with two stats", func(t *testing.T) {
		start, err := time.Parse(time.RFC3339, "2018-03-15T13:00:00Z")
		require.NoError(t, err)
		end, err := time.Parse(time.RFC3339, "2018-03-18T13:34:00Z")
		require.NoError(t, err)

		executedQueries := []executedQuery{{
			Expression: ``,
			ID:         "D",
			Period:     600,
		}}

		link, err := buildDeepLink("E", requestQueries, executedQueries, start, end)
		require.NoError(t, err)

		parsedURL, err := url.Parse(link)
		require.NoError(t, err)

		decodedLink, err := url.PathUnescape(parsedURL.String())
		require.NoError(t, err)
		expected := `https://us-east-1.console.aws.amazon.com/cloudwatch/deeplink.js?region=us-east-1#metricsV2:graph={"view":"timeSeries","stacked":false,"title":"E","start":"2018-03-15T13:00:00Z","end":"2018-03-18T13:34:00Z","region":"us-east-1","metrics":[["ec2","CPUUtilization",{"stat":"Average","period":600}],["ec2","CPUUtilization",{"stat":"p46.32","period":600}]]}`
		assert.Equal(t, expected, decodedLink)
	})

	t.Run("A deep link that reference an expression based metric is created based on a request query with one stat", func(t *testing.T) {
		start, err := time.Parse(time.RFC3339, "2018-03-15T13:00:00Z")
		require.NoError(t, err)
		end, err := time.Parse(time.RFC3339, "2018-03-18T13:34:00Z")
		require.NoError(t, err)

		executedQueries := []executedQuery{{
			Expression: `REMOVE_EMPTY(SEARCH('Namespace="AWS/EC2" MetricName="CPUUtilization"', 'Sum', 600))`,
			ID:         "D",
			Period:     600,
		}}

		link, err := buildDeepLink("E", requestQueries, executedQueries, start, end)
		require.NoError(t, err)

		parsedURL, err := url.Parse(link)
		require.NoError(t, err)

		decodedLink, err := url.PathUnescape(parsedURL.String())
		require.NoError(t, err)

		expected := `https://us-east-1.console.aws.amazon.com/cloudwatch/deeplink.js?region=us-east-1#metricsV2:graph={"view":"timeSeries","stacked":false,"title":"E","start":"2018-03-15T13:00:00Z","end":"2018-03-18T13:34:00Z","region":"us-east-1","metrics":[{"expression":"REMOVE_EMPTY(SEARCH('Namespace=\"AWS/EC2\"+MetricName=\"CPUUtilization\"',+'Sum',+600))"}]}`
		assert.Equal(t, expected, decodedLink)
	})

	t.Run("A deep link is not built in case any of the executedQueries are math expressions", func(t *testing.T) {
		start, err := time.Parse(time.RFC3339, "2018-03-15T13:00:00Z")
		require.NoError(t, err)
		end, err := time.Parse(time.RFC3339, "2018-03-18T13:34:00Z")
		require.NoError(t, err)

		executedQueries := []executedQuery{{
			Expression: `a * 2`,
			ID:         "D",
			Period:     600,
		}}

		link, err := buildDeepLink("E", requestQueries, executedQueries, start, end)
		require.NoError(t, err)

		parsedURL, err := url.Parse(link)
		require.NoError(t, err)

		decodedLink, err := url.PathUnescape(parsedURL.String())
		require.NoError(t, err)
		assert.Equal(t, "", decodedLink)
	})
}
