package postgres

import (
	"testing"

	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/puddle/v2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

func TestApplyPoolConfig(t *testing.T) {
	// Regression test for https://github.com/grafana/grafana/issues/119810:
	// setting maxOpenConns=0 must not produce "MaxSize must be >= 1" from pgxpool.
	t.Run("MaxOpenConns=0 leaves MaxConns unset so pgxpool uses its default", func(t *testing.T) {
		cfg := &pgxpool.Config{}
		applyPoolConfig(cfg, sqleng.JsonData{MaxOpenConns: 0})
		require.Equal(t, int32(0), cfg.MaxConns,
			"MaxConns must stay 0 (pgxpool default) when MaxOpenConns is unset")

		// Verify pgxpool itself does not reject MaxConns=0 — it must apply its
		// own default (max(4, NumCPU)) rather than passing 0 to puddle.
		_, err := puddle.NewPool(&puddle.Config[any]{
			Constructor: func(_ context.Context) (any, error) { return nil, nil },
			MaxSize:     cfg.MaxConns,
		})
		require.ErrorContains(t, err, "MaxSize must be >= 1",
			"sanity check: puddle rejects MaxSize=0, confirming pgxpool must not pass it through")
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
