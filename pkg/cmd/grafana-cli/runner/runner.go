package runner

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Runner struct {
	Cfg               *setting.Cfg
	SQLStore          db.DB
	SettingsProvider  setting.Provider
	Features          featuremgmt.FeatureToggles
	EncryptionService encryption.Internal
	SecretsService    *manager.SecretsService //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	SecretsMigrator   secrets.Migrator        //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	UserService       user.Service
}

func New(cfg *setting.Cfg, sqlStore db.DB, settingsProvider setting.Provider,
	encryptionService encryption.Internal, features featuremgmt.FeatureToggles,
	secretsService *manager.SecretsService, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	secretsMigrator secrets.Migrator, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	userService user.Service,
) Runner {
	return Runner{
		Cfg:               cfg,
		SQLStore:          sqlStore,
		SettingsProvider:  settingsProvider,
		EncryptionService: encryptionService,
		SecretsService:    secretsService,
		SecretsMigrator:   secretsMigrator,
		Features:          features,
		UserService:       userService,
	}
}
