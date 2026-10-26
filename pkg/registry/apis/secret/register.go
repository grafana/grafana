package secret

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// DependencyRegisterer is set to satisfy wire gen and make sure the `RegisterDependencies` is called.
type DependencyRegisterer struct{}

func RegisterDependencies(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	secretDBMigrator contracts.SecretDBMigrator,
	accessControlService accesscontrol.Service,
) (*DependencyRegisterer, error) {
	// Permissions for requests in multi-tenant mode will come from HG.
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	// We shouldn't need to create the DB in HG, as that will use the MT api server.
	if cfg.SecretsManagement.RunSecretsDBMigrations {
		// Some DBs that claim to be MySQL/Postgres-compatible might not support table locking.
		databaseSection := cfg.Raw.Section("database")
		lockDatabase := databaseSection.Key("migration_locking").MustBool(true)
		lockingAttemptTimeoutSec := databaseSection.Key("locking_attempt_timeout_sec").MustInt()

		// This is needed to wire up and run DB migrations for Secrets Manager, which is not run by the generic OSS DB migrator.
		if err := secretDBMigrator.RunMigrations(context.Background(), lockDatabase, lockingAttemptTimeoutSec); err != nil {
			return nil, fmt.Errorf("running secret database migrations: %w", err)
		}
	}

	return &DependencyRegisterer{}, nil
}
