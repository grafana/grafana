package contracts

// SecretDBMigrator is an interface for running database migrations related to secrets management.
type SecretDBMigrator interface {
	RunMigrations() error
}
