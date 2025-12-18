package secret

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/setting"
)

// DependencyRegisterer is set to satisfy wire gen and make sure the `RegisterDependencies` is called.
type DependencyRegisterer struct{}

func RegisterDependencies(cfg *setting.Cfg, secretDBMigrator contracts.SecretDBMigrator) (*DependencyRegisterer, error) {
	// Some DBs that claim to be MySQL/Postgres-compatible might not support table locking.
	lockDatabase := cfg.Raw.Section("database").Key("migration_locking").MustBool(true)

	// This is needed to wire up and run DB migrations for Secrets Manager, which is not run by the generic OSS DB migrator.
	if err := secretDBMigrator.RunMigrations(context.Background(), lockDatabase); err != nil {
		return nil, fmt.Errorf("running secret database migrations: %w", err)
	}

	return &DependencyRegisterer{}, nil
}
