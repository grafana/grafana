package models

import "context"

type TransactionManager interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
