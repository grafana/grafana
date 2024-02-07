package cloudwatch

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func TestGetMetricQueryBatches(t *testing.T) {
	nullLogger := log.NewNullLogger()
	insight1 := models.CloudWatchQuery{
		MetricQueryType: models.MetricQueryTypeQuery,
		Id:              "i1",
	}
	insight2 := models.CloudWatchQuery{
		MetricQueryType: models.MetricQueryTypeQuery,
		Id:              "i2",
	}
	insight3 := models.CloudWatchQuery{
		MetricQueryType: models.MetricQueryTypeQuery,
		Id:              "i3",
	}

	metricStat := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeBuilder,
		Id:               "s1",
	}
	m1_ref_i1 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(i1)",
		Id:               "m1",
	}
	m99_ref_m98 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(m98)",
		Id:               "m99",
	}
	m98_ref_m88 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(m88)",
		Id:               "m98",
	}
	m88_ref_m98 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(m98)",
		Id:               "m88",
	}
	m2_ref_i1 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "RATE(i1)",
		Id:               "m2",
	}
	m3_ref_m1_m2 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "m1 * m2",
		Id:               "m3",
	}
	m4_ref_s1 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "SUM(s1)",
		Id:               "m4",
	}
	m4_ref_i1_i3 := models.CloudWatchQuery{
		MetricQueryType:  models.MetricQueryTypeSearch,
		MetricEditorMode: models.MetricEditorModeRaw,
		Expression:       "PERIOD(i1) * RATE(i3)",
		Id:               "m5",
	}

	t.Run("m99 ref m98 which ref m88 which ref m98, with 2 insights", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&insight2,
			&m99_ref_m98,
			&m98_ref_m88,
			&m88_ref_m98,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[1])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&m99_ref_m98, &m98_ref_m88, &m88_ref_m98}, result[2])
	})

	t.Run("zero insight queries should not separate into batches", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&metricStat,
			&m1_ref_i1,
			&m2_ref_i1,
			&m3_ref_m1_m2,
			&m4_ref_s1,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 1)
		assert.Equal(t, batch, result[0])
	})

	t.Run("one insight query should not separate into batches", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 1)
		assert.ElementsMatch(t, batch, result[0])
	})

	t.Run("multiple insight queries should separate into batches", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
			&insight2,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&metricStat}, result[1])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[2])
	})

	t.Run("math queries with one insight query should not separate into batches", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&metricStat,
			&m1_ref_i1,
			&m2_ref_i1,
			&m3_ref_m1_m2,
			&m4_ref_s1,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 1)
		assert.ElementsMatch(t, batch, result[0])
	})
	t.Run("math queries with multiple insight queries should separate into batches", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&insight2,
			&metricStat,
			&m1_ref_i1,
			&m2_ref_i1,
			&m3_ref_m1_m2,
			&m4_ref_s1,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1, &m1_ref_i1, &m2_ref_i1, &m3_ref_m1_m2}, result[1])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&metricStat, &m4_ref_s1}, result[2])
	})
	t.Run("a math query with multiple insight queries should batch them together", func(t *testing.T) {
		batch := []*models.CloudWatchQuery{
			&insight1,
			&insight2,
			&insight3,
			&m1_ref_i1,
			&m4_ref_i1_i3,
		}

		result := getMetricQueryBatches(batch, nullLogger)
		assert.Len(t, result, 3)
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight2}, result[0])
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1, &m1_ref_i1}, result[1])
		// This batch is expected to get an error from AWS, which does not allow multiple insight queries in a batch
		assert.ElementsMatch(t, []*models.CloudWatchQuery{&insight1, &insight3, &m4_ref_i1_i3}, result[2])
	})
}
