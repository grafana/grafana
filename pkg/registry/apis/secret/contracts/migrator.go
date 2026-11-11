package contracts

import "context"

// SecretDBMigrator is an interface for running database migrations related to secrets management.
type SecretDBMigrator interface {
	RunMigrations(ctx context.Context, lockDatabase bool, lockingAttemptTimeoutSec int) error
}

// SecretDBMigrated is provided once the Secrets Manager tables are migrated,
// so services that encrypt while the wire graph is built can depend on it.
type SecretDBMigrated struct{}
