package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func TestGetMetricQueryBatches(t *testing.T) {
	logger := &logtest.Fake{}
	insight1 := models.CloudWatchQuery{
		MetricQueryType: models.MetricQueryTypeQuery,
		Id:              "i1",
	}
	insight2 := models.CloudWatchQuery{
		MetricQueryType: models.MetricQueryTypeQuery,
		Id:              "i2",
	}
	metricStat := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeBuilder,
		Id:               "s1",
	}
	math1 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(i1)",
		Id:               "m1",
	}
	math2 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "RATE(i1)",
		Id:               "m2",
	}
	math3 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "m1 * m2",
		Id:               "m3",
	}
	math4 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "SUM(s1)",
		Id:               "m4",
	}

	t.Run("zero insight queries should not batch", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&metricStat,
			&math1,
			&math2,
			&math3,
			&math4,
		}

		result := getMetricQueryBatches(batch, logger)
		assert.Len(t, result, 1)
		assert.Equal(t, batch, result[0])
	})

	t.Run("one insight query should not batch", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
		}

		result := getMetricQueryBatches(batch, logger)
		assert.Len(t, result, 1)
		assert.ElementsMatch(t, batch, result[0])
	})

	t.Run("multiple insight queries should batch independent queries", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
			&insight2,
		}

		result := getMetricQueryBatches(batch, logger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&metricStat}, result[1])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[2])
	})

	t.Run("math queries with one insight query should not batch", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
			&math1,
			&math2,
			&math3,
			&math4,
		}

		result := getMetricQueryBatches(batch, logger)
		assert.Len(t, result, 1)
		assert.ElementsMatch(t, batch, result[0])
	})
	t.Run("math queries with multiple insight queries should batch", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&insight2,
			&metricStat,
			&math1,
			&math2,
			&math3,
			&math4,
		}

		result := getMetricQueryBatches(batch, logger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1, &math1, &math2, &math3}, result[1])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&metricStat, &math4}, result[2])
	})
}
