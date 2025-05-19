//go:build arm

package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type DB struct{}

// Stub out the QueryFrames method for ARM builds
// See github.com/dolthub/go-mysql-server/issues/2837
func (db *DB) QueryFrames(_ context.Context, _ tracing.Tracer, _, _ string, _ []*data.Frame, _ ...QueryOption) (*data.Frame, error) {
	return nil, fmt.Errorf("sql expressions not supported in arm")
}

func WithTimeout(_ time.Duration) QueryOption {
	return func(_ *QueryOptions) {
		// no-op
	}
}

func WithMaxOutputCells(_ int64) QueryOption {
	return func(_ *QueryOptions) {
		// no-op
	}
}

type QueryOptions struct{}

type QueryOption func(*QueryOptions)
