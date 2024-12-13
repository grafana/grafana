package secret

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// SecureValueStorage is the interface for wiring and dependency injection.
type SecureValueStorage interface{}

func ProvideSecureValueStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (SecureValueStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &storage{}, nil
	}

	if err := migrateSecretSQL(db.GetEngine(), cfg); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &storage{db: db}, nil
}

// storage is the actual implementation of the secure value (metadata) storage.
type storage struct {
	db db.DB
}
