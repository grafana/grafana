package pluginsettings

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Service struct {
	Bus            bus.Bus
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.Service

	logger                       log.Logger
	pluginSettingDecryptionCache secureJSONDecryptionCache
}

type cachedDecryptedJSON struct {
	updated time.Time
	json    map[string]string
}

type secureJSONDecryptionCache struct {
	cache map[int64]cachedDecryptedJSON
	sync.Mutex
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, secretsService secrets.Service) *Service {
	s := &Service{
		Bus:            bus,
		SQLStore:       store,
		SecretsService: secretsService,
		logger:         log.New("pluginsettings"),
		pluginSettingDecryptionCache: secureJSONDecryptionCache{
			cache: make(map[int64]cachedDecryptedJSON),
		},
	}

	s.Bus.AddHandler(s.GetPluginSettingById)
	s.Bus.AddHandler(s.UpdatePluginSetting)
	s.Bus.AddHandler(s.UpdatePluginSettingVersion)

	return s
}

func (s *Service) GetPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	return s.SQLStore.GetPluginSettingById(ctx, query)
}

func (s *Service) UpdatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	var err error
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.UpdatePluginSetting(ctx, cmd)
}

func (s *Service) UpdatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return s.SQLStore.UpdatePluginSettingVersion(ctx, cmd)
}

func (s *Service) DecryptedValues(ps *models.PluginSetting) map[string]string {
	s.pluginSettingDecryptionCache.Lock()
	defer s.pluginSettingDecryptionCache.Unlock()

	if item, present := s.pluginSettingDecryptionCache.cache[ps.Id]; present && ps.Updated.Equal(item.updated) {
		return item.json
	}

	json, err := s.SecretsService.DecryptJsonData(context.Background(), ps.SecureJsonData)
	if err != nil {
		s.logger.Error("Failed to decrypt secure json data", "error", err)
		return map[string]string{}
	}

	s.pluginSettingDecryptionCache.cache[ps.Id] = cachedDecryptedJSON{
		updated: ps.Updated,
		json:    json,
	}

	return json
}
