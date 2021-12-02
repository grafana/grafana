package serviceaccounts

import "context"

type Service interface {
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
