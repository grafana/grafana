package resource

import (
	"context"
	"io"
	"iter"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var _ KV = &sqlKV{}

type sqlKV struct {
	db db.DBProvider
}

func NewSQLKV(dbProvider db.DBProvider) (KV, error) {
	return &sqlKV{
		db: dbProvider,
	}, nil
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
