package postgres

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

func TestApplyPoolConfig(t *testing.T) {
	// Regression test for https://github.com/grafana/grafana/issues/119810:
	// maxOpenConns=0 must not produce "MaxSize must be >= 1" from pgxpool.
	t.Run("MaxOpenConns=0 leaves MaxConns unset so pgxpool uses its default", func(t *testing.T) {
		cfg := &pgxpool.Config{}
		applyPoolConfig(cfg, sqleng.JsonData{MaxOpenConns: 0})
		// MaxConns=0 tells pgxpool to apply its own default (max(4, NumCPU)).
		// Passing 0 directly to pgxpool.NewWithConfig would propagate to puddle
		// as MaxSize=0 and fail with "MaxSize must be >= 1".
		require.Equal(t, int32(0), cfg.MaxConns)
	})

	t.Run("MaxOpenConns>0 sets MaxConns", func(t *testing.T) {
		cfg := &pgxpool.Config{}
		applyPoolConfig(cfg, sqleng.JsonData{MaxOpenConns: 10})
		require.Equal(t, int32(10), cfg.MaxConns)
	})

	t.Run("negative MaxOpenConns leaves MaxConns unset", func(t *testing.T) {
		cfg := &pgxpool.Config{}
		applyPoolConfig(cfg, sqleng.JsonData{MaxOpenConns: -1})
		require.Equal(t, int32(0), cfg.MaxConns)
	})
}
