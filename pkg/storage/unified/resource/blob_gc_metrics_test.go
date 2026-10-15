package resource

import (
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestBlobGCMetrics(t *testing.T) {
	reg := prometheus.NewRegistry()
	sql := NewBlobGCMetricsIfEnabled(reg, "sql", true)
	kv := NewBlobGCMetricsIfEnabled(reg, "kv", true)
	require.Nil(t, NewBlobGCMetricsIfEnabled(reg, "sql", false))

	sql.Record(3, true, nil)
	require.Equal(t, float64(3), testutil.ToFloat64(sql.Candidates))
	require.Zero(t, testutil.ToFloat64(sql.Deleted))
	sql.Record(2, false, nil)
	require.Equal(t, float64(2), testutil.ToFloat64(sql.Candidates))
	require.Equal(t, float64(2), testutil.ToFloat64(sql.Deleted))
	sql.Record(1, false, errors.New("list failed"))
	require.Equal(t, float64(2), testutil.ToFloat64(sql.Candidates))
	require.Equal(t, float64(3), testutil.ToFloat64(sql.Deleted))
	require.Equal(t, float64(1), testutil.ToFloat64(sql.Errors))
	require.Equal(t, float64(3), testutil.ToFloat64(sql.Runs))
	require.Zero(t, testutil.ToFloat64(kv.Deleted))
	_, err := reg.Gather()
	require.NoError(t, err)
}
