package contracts

import "context"

// SecretDBMigrator is an interface for running database migrations related to secrets management.
type SecretDBMigrator interface {
	RunMigrations(ctx context.Context, lockDatabase bool) error
}
