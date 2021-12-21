package serviceaccounts

import "context"

type Service interface {
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	HasMigrated(ctx context.Context, ordID int64) bool
}
type Store interface {
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	HasMigrated(ctx context.Context, orgID int64) error
}
