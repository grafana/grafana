package contracts

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

type OutboxQueue interface {
	Append(ctx context.Context, tx *db.Session, foo any, cb func(error))
}
