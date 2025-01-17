package sql

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var (
	_ resource.BatchProcessingBackend = (*backend)(nil)
)

func (b *backend) ProcessBatch(ctx context.Context, next func() *resource.BatchRequest) error {
	return b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		for req := next(); req != nil; req = next() {
			fmt.Printf("TODO: %s / %s\n", req.Action, req.Key.SearchID())
		}
		fmt.Printf("finished.... maybe write history into current?\n")
		return nil
	})
}
