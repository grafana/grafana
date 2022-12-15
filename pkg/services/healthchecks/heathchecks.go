package healthchecks

import "context"

type Service interface {
	CheckDatabaseHealth(ctx context.Context) error
	CheckDatabaseMigrations(ctx context.Context) error // TODO
}

type Store interface {
	CheckDatabaseHealth(ctx context.Context) error
	CheckDatabaseMigrations(ctx context.Context) error // TODO
}
