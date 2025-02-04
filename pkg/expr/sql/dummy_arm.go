//go:build arm

package sql

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DB struct{}

func (db *DB) QueryFrames(_ context.Context, _, _ string, _ []*data.Frame) (*data.Frame, error) {
	return nil, fmt.Errorf("sql expressions not supported in arm")
}
