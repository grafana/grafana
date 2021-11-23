package serviceaccounts

import "context"

type Service interface {
	CreateServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
type Store interface {
	CreateServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
}
