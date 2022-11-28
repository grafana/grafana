package runner

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Runner struct {
	Cfg               *setting.Cfg
	SQLStore          *sqlstore.SQLStore
	SettingsProvider  setting.Provider
	Features          featuremgmt.FeatureToggles
	EncryptionService encryption.Internal
	SecretsService    *manager.SecretsService
	SecretsMigrator   secrets.Migrator
	UserService       user.Service
}

func New(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, settingsProvider setting.Provider,
	encryptionService encryption.Internal, features featuremgmt.FeatureToggles,
	secretsService *manager.SecretsService, secretsMigrator secrets.Migrator,
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
