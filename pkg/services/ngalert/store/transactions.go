package store

import "context"

// TransactionManager represents the ability to issue and close transactions through contexts.
type TransactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

func (st *DBstore) InTransaction(ctx context.Context, f func(ctx context.Context) error) error {
	return st.SQLStore.InTransaction(ctx, f)
}
