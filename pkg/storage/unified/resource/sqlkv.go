package resource

import (
	"context"
	"fmt"
	"io"
	"iter"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var _ KV = &sqlKV{}

type sqlKV struct {
	dbProvider db.DBProvider
	db         db.DB
}

func NewSQLKV(dbProvider db.DBProvider) (KV, error) {
	if dbProvider == nil {
		return nil, fmt.Errorf("dbProvider is required")
	}

	ctx := context.Background()
	dbConn, err := dbProvider.Init(ctx)
	if err != nil {
		return nil, fmt.Errorf("error initializing DB: %w", err)
	}

	return &sqlKV{
		dbProvider: dbProvider,
		db:         dbConn,
	}, nil
}

func (k *sqlKV) Ping(ctx context.Context) error {
	if k.db == nil {
		return fmt.Errorf("database connection is nil")
	}
	return k.db.PingContext(ctx)
}

func (k *sqlKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		panic("not implemented!")
	}
}

func (k *sqlKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	panic("not implemented!")
}

func (k *sqlKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	return func(yield func(KeyValue, error) bool) {
		panic("not implemented!")
	}
}

func (k *sqlKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	panic("not implemented!")
}

func (k *sqlKV) Delete(ctx context.Context, section string, key string) error {
	panic("not implemented!")
}

func (k *sqlKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	panic("not implemented!")
}

func (k *sqlKV) UnixTimestamp(ctx context.Context) (int64, error) {
	panic("not implemented!")
}
