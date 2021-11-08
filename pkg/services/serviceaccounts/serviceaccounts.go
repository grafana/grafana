package serviceaccounts

import "context"

type Service interface {
	IsDisabled() bool
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
