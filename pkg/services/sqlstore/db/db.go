package db

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type DB interface {
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
}
