package cloudwatch

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudWatchQuery(t *testing.T) {
	t.Run("Deeplink", func(t *testing.T) {
		t.Run("is not generated for MetricQueryTypeQuery", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeQuery,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.buildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.Empty(t, deepLink)
		})

		testCases := map[string]struct {
			linkContainsSubstring string
			query                 *cloudWatchQuery
			featureEnabled        bool
		}{"includes label in case dynamic label is enabled and its a metric stat query": {
			query: &cloudWatchQuery{
				RefId:      "A",
				Region:     "us-east-1",
				Expression: "",
				Statistic:  "Average",
				Period:     300,
				Id:         "id1",
				MatchExact: true,
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			},
			featureEnabled: true,
			// decoded: label: ${PROP('Namespace')}
			linkContainsSubstring: "label%22%3A%22%24%7BPROP%28%27Namespace%27%29%7D%22%7D%5D%5D%7D",
		},
			"does not include label in case dynamic label is diabled": {
				query: &cloudWatchQuery{
					RefId:      "A",
					Region:     "us-east-1",
					Expression: "",
					Statistic:  "Average",
					Period:     300,
					Id:         "id1",
					MatchExact: true,
					Label:      "${PROP('Namespace')}",
					Dimensions: map[string][]string{
						"InstanceId": {"i-12345678"},
					},
					MetricQueryType:  MetricQueryTypeSearch,
					MetricEditorMode: MetricEditorModeBuilder,
				},
				featureEnabled: true,
				// decoded: label: ${PROP('Namespace')}
				linkContainsSubstring: "label%22%3A%22%24%7BPROP%28%27Namespace%27%29%7D%22%7D%5D%5D%7D",
			},
			"includes label in case dynamic label is enabled and its a math expression query": {
				query: &cloudWatchQuery{
					RefId:      "A",
					Region:     "us-east-1",
					Expression: "",
					Statistic:  "Average",
					Period:     300,
					Id:         "id1",
					MatchExact: true,
					Label:      "${PROP('Namespace')}",
					Dimensions: map[string][]string{
						"InstanceId": {"i-12345678"},
					},
					MetricQueryType:  MetricQueryTypeSearch,
					MetricEditorMode: MetricEditorModeBuilder,
				},
				featureEnabled: true,
				// decoded: label: ${PROP('Namespace')}
				linkContainsSubstring: "label%22%3A%22%24%7BPROP%28%27Namespace%27%29%7D%22%7D%5D%5D%7D",
			},
		}

		for name, tc := range testCases {
			t.Run(name, func(t *testing.T) {
				startTime := time.Now()
				endTime := startTime.Add(2 * time.Hour)

				deepLink, err := tc.query.buildDeepLink(startTime, endTime, tc.featureEnabled)
				require.NoError(t, err)

				assert.Contains(t, deepLink, tc.linkContainsSubstring)
			})
		}
	})

	t.Run("SEARCH(someexpression) was specified in the query editor", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "SEARCH(someexpression)",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.isMathExpression(), "Expected not math expression")
	})

	t.Run("No expression, no multi dimension key values and no * was used", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: true,
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678"},
			},
		}

		assert.False(t, query.isSearchExpression(), "Expected not a search expression")
		assert.False(t, query.isMathExpression(), "Expected not math expressions")
	})

	t.Run("No expression but multi dimension key values exist", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678", "i-34562312"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.isMathExpression(), "Expected not math expressions")
	})

	t.Run("No expression but dimension values has *", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId":   {"i-12345678", "*"},
				"InstanceType": {"abc", "def"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.False(t, query.isMathExpression(), "Expected not math expression")
	})

	t.Run("Query has a multi-valued dimension", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			Dimensions: map[string][]string{
				"InstanceId":   {"i-12345678", "i-12345679"},
				"InstanceType": {"abc"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected a search expression")
		assert.True(t, query.isMultiValuedDimensionExpression(), "Expected a multi-valued dimension expression")
	})

	t.Run("No dimensions were added", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: false,
			Dimensions: make(map[string][]string),
		}
		t.Run("Match exact is false", func(t *testing.T) {
			query.MatchExact = false
			assert.True(t, query.isSearchExpression(), "Expected a search expression")
			assert.False(t, query.isMathExpression(), "Expected not math expression")
		})

		t.Run("Match exact is true", func(t *testing.T) {
			query.MatchExact = true
			assert.False(t, query.isSearchExpression(), "Exxpected not search expression")
			assert.False(t, query.isMathExpression(), "Expected not math expression")
		})
	})

	t.Run("Match exact is", func(t *testing.T) {
		query := &cloudWatchQuery{
			RefId:      "A",
			Region:     "us-east-1",
			Expression: "",
			Statistic:  "Average",
			Period:     300,
			Id:         "id1",
			MatchExact: false,
			Dimensions: map[string][]string{
				"InstanceId": {"i-12345678"},
			},
		}

		assert.True(t, query.isSearchExpression(), "Expected search expression")
		assert.False(t, query.isMathExpression(), "Expected not math expression")
	})
}
