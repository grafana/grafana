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

		t.Run("does not include label in case dynamic label is diabled", func(t *testing.T) {
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
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.buildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})

		t.Run("includes label in case dynamic label is enabled and it's a metric stat query", func(t *testing.T) {
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
				Label:      "${PROP('Namespace')}",
				Dimensions: map[string][]string{
					"InstanceId": {"i-12345678"},
				},
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeBuilder,
			}

			deepLink, err := query.buildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})

		t.Run("includes label in case dynamic label is enabled and it's a math expression query", func(t *testing.T) {
			startTime := time.Now()
			endTime := startTime.Add(2 * time.Hour)
			query := &cloudWatchQuery{
				RefId:            "A",
				Region:           "us-east-1",
				Statistic:        "Average",
				Expression:       "SEARCH(someexpression)",
				Period:           300,
				Id:               "id1",
				MatchExact:       true,
				Label:            "${PROP('Namespace')}",
				MetricQueryType:  MetricQueryTypeSearch,
				MetricEditorMode: MetricEditorModeRaw,
			}

			deepLink, err := query.buildDeepLink(startTime, endTime, false)
			require.NoError(t, err)
			assert.NotContains(t, deepLink, "label")
		})
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
