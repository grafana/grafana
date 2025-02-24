package contracts

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
)

type OutboxQueue interface {
	Append(ctx context.Context, tx Tx, secureValue *secretv0alpha1.SecureValue, cb func(error))
}
