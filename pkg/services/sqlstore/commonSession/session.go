package commonSession

import "context"

type Tx[T any] interface {
	IsTransactionOpen() bool
	Close()
	Rollback() error
	Commit() error
	GetEvents() []interface{}
	ConcreteType() T
}

type TxSessionGetter[T any] interface {
	StartSessionOrUseExisting(ctx context.Context, beginTran bool) (Tx[T], bool, error)
}
