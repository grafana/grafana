package serviceaccounts

import (
	"context"
)

type Store interface {
	DeleteServiceAccount(ctx context.Context, serviceAccountId int64) error
}
