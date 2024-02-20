//go:build tests

package sql

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const err = "sqlexpressions feature is not enabled"

// NewInMemoryDB ...
func NewInMemoryDB(ctx context.Context) (*DuckDB, error) {
	return &DuckDB{
		db:     nil,
		name:   "",
		lookup: Fields{},
	}, errors.New(err)
}

// Query ...
func (d *DuckDB) Query(ctx context.Context, query string) (*data.Frame, error) {
	return nil, errors.New(err)
}

// AppendAll ...
func (d *DuckDB) AppendAll(ctx context.Context, frames data.Frames) error {
	return errors.New(err)
}

// TablesList ...
func TablesList(rawSQL string) ([]string, error) {
	return nil, errors.New(err)
}
