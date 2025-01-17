package sql

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var (
	_ resource.BatchWriteableBackend = (*backend)(nil)
)

func (b *backend) BatchWrite(ctx context.Context, next func() *resource.BatchWriteRequest) error {
	return b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		for req := next(); req != nil; req = next() {
			fmt.Printf("TODO: %s / %s\n", req.Action, req.Key.SearchID())
		}
		return nil
	})
}
