package runner

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Runner struct {
	Cfg               *setting.Cfg
	SQLStore          *sqlstore.SQLStore
	SettingsProvider  setting.Provider
	EncryptionService encryption.Internal
	SecretsService    *manager.SecretsService
}

func New(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, settingsProvider setting.Provider,
	encryptionService encryption.Internal, secretsService *manager.SecretsService) Runner {
	return Runner{
		Cfg:               cfg,
		SQLStore:          sqlStore,
		SettingsProvider:  settingsProvider,
		EncryptionService: encryptionService,
		SecretsService:    secretsService,
	}
}
