package store

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestRuleStateBlobWithSeries(t *testing.T) {
	series := []models.RecordingSeries{{
		TargetDatasourceUID: "ds",
		Metric:              "metric",
		Labels:              map[string]string{"job": "a"},
		LastUpdate:          time.Unix(1000, 0).UTC(),
	}}

	t.Run("a reader that only knows instances gets none from a series blob", func(t *testing.T) {
		blob, err := convertAndCompressRuleState(nil, series)
		require.NoError(t, err)

		instances, err := decompressAlertInstances(blob)
		require.NoError(t, err)
		require.Empty(t, instances)
	})

	t.Run("series round trip", func(t *testing.T) {
		blob, err := convertAndCompressRuleState(nil, series)
		require.NoError(t, err)

		state, err := decompressRuleState(blob)
		require.NoError(t, err)
		require.Equal(t, series, recordingSeriesProtoToModels(state.Series))
	})

	t.Run("an empty state is a non-nil blob", func(t *testing.T) {
		blob, err := convertAndCompressRuleState(nil, nil)
		require.NoError(t, err)
		require.NotNil(t, blob)
	})
}
