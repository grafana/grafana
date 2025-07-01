package secret

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// This is needed to wire up and run DB migrations for Secrets Manager, which is not run by the generic OSS DB migrator.
type DBMigratorRunner struct{}

func RunDBMigrations(features featuremgmt.FeatureToggles, cfg *setting.Cfg, secretDBMigrator contracts.SecretDBMigrator) (*DBMigratorRunner, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) || !features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return nil, nil
	}

	// Some DBs that claim to be MySQL/Postgres-compatible might not support table locking.
	lockDatabase := cfg.Raw.Section("database").Key("migration_locking").MustBool(true)

	if err := secretDBMigrator.RunMigrations(context.Background(), lockDatabase); err != nil {
		return nil, fmt.Errorf("running secret database migrations: %w", err)
	}

	return &DBMigratorRunner{}, nil
}
