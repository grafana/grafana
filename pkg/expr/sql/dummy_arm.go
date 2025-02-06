//go:build arm

package sql

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DB struct{}

// Stub out the QueryFrames method for ARM builds
// See github.com/dolthub/go-mysql-server/issues/2837
func (db *DB) QueryFrames(_ context.Context, _, _ string, _ []*data.Frame) (*data.Frame, error) {
	return nil, fmt.Errorf("sql expressions not supported in arm")
}
