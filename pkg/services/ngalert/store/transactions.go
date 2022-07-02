package store

import "context"

func (st *DBstore) InTransaction(ctx context.Context, f func(ctx context.Context) error) error {
	return st.SQLStore.InTransaction(ctx, f)
}
