package contracts

import (
	"context"
)

type OutboxQueue interface {
	Append(ctx context.Context, tx TransactionManager, foo any, cb func(error))
}
