package utils

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestBatchDataQueriesByTimeRange(t *testing.T) {
	start := time.Date(2024, time.November, 29, 0, 42, 34, 0, time.UTC)
	FiveMin := time.Date(2024, time.November, 29, 0, 47, 34, 0, time.UTC)
	TenMin := time.Date(2024, time.November, 29, 0, 52, 34, 0, time.UTC)
	loc := time.FixedZone("UTC+1", 1*60*60)
	FiveMinDifferentZone := time.Date(2024, time.November, 29, 1, 47, 34, 0, loc)
	testQueries := []backend.DataQuery{
		{
			RefID:     "A",
			TimeRange: backend.TimeRange{From: start, To: FiveMin},
		},
		{
			RefID:     "B",
			TimeRange: backend.TimeRange{From: start, To: TenMin},
		},
		{
			RefID:     "C",
			TimeRange: backend.TimeRange{From: start, To: FiveMinDifferentZone},
		},
	}
	result := BatchDataQueriesByTimeRange(testQueries)
	require.Equal(t, 2, len(result))
	var FiveMinQueries = result[0]
	var TenMinQueries = result[1]
	// Since BatchDataQueriesByTimeRange uses a map, we don't known the return indices for the batches
	if len(result[0]) == 1 {
		TenMinQueries = result[0]
		FiveMinQueries = result[1]
	}

	require.Equal(t, 2, len(FiveMinQueries))
	require.Equal(t, "A", FiveMinQueries[0].RefID)
	require.Equal(t, "C", FiveMinQueries[1].RefID)

	require.Equal(t, 1, len(TenMinQueries))
	require.Equal(t, "B", TenMinQueries[0].RefID)
}
