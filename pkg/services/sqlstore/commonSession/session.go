package commonSession

import "context"

type Session interface {
	IsTransactionOpen() bool
	Close()
	Rollback() error
	Commit() error
	GetEvents() []interface{}
}

type Engine interface {
	StartSessionOrUseExisting(ctx context.Context, beginTran bool) (Session, bool, error)
}
