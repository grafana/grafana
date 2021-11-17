package runner

import (
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Runner struct {
	Cfg               *setting.Cfg
	SQLStore          *sqlstore.SQLStore
	SettingsProvider  setting.Provider
	EncryptionService encryption.Internal
	SecretsService    secrets.Service
}

func New(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, settingsProvider setting.Provider,
	encryptionService encryption.Internal, secretsService secrets.Service) Runner {
	return Runner{
		Cfg:               cfg,
		SQLStore:          sqlStore,
		SettingsProvider:  settingsProvider,
		EncryptionService: encryptionService,
		SecretsService:    secretsService,
	}
}
