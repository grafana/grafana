package contracts

import "context"

type TokenDBMigrator interface {
	RunMigrations(ctx context.Context, lockDatabase bool) error
}
