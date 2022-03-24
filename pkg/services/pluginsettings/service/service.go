package service

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(store *sqlstore.SQLStore, secretsService secrets.Service) *Service {
	s := &Service{
		sqlStore: store,
		decryptionCache: secureJSONDecryptionCache{
			cache: make(map[int64]cachedDecryptedJSON),
		},
		secretsService: secretsService,
		logger:         log.New("pluginsettings"),
	}

	return s
}

type Service struct {
	sqlStore        *sqlstore.SQLStore
	decryptionCache secureJSONDecryptionCache
	secretsService  secrets.Service

	logger log.Logger
}

type cachedDecryptedJSON struct {
	updated time.Time
	json    map[string]string
}

type secureJSONDecryptionCache struct {
	cache map[int64]cachedDecryptedJSON
	sync.Mutex
}

func (s *Service) GetPluginSettings(ctx context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.DTO, error) {
	ps, err := s.sqlStore.GetPluginSettings(ctx, args.OrgID)
	if err != nil {
		return nil, err
	}

	var result []*pluginsettings.DTO
	for _, p := range ps {
		result = append(result, &pluginsettings.DTO{
			ID:             p.Id,
			OrgID:          p.OrgId,
			PluginID:       p.PluginId,
			PluginVersion:  p.PluginVersion,
			JSONData:       p.JsonData,
			SecureJSONData: p.SecureJsonData,
			Enabled:        p.Enabled,
			Pinned:         p.Pinned,
			Updated:        p.Updated,
		})
	}

	return result, nil
}

func (s *Service) GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	query := &models.GetPluginSettingByIdQuery{
		OrgId:    args.OrgID,
		PluginId: args.PluginID,
	}

	err := s.sqlStore.GetPluginSettingById(ctx, query)
	if err != nil {
		return nil, err
	}

	return &pluginsettings.DTO{
		ID:             query.Result.Id,
		OrgID:          query.Result.OrgId,
		PluginID:       query.Result.PluginId,
		PluginVersion:  query.Result.PluginVersion,
		JSONData:       query.Result.JsonData,
		SecureJSONData: query.Result.SecureJsonData,
		Enabled:        query.Result.Enabled,
		Pinned:         query.Result.Pinned,
		Updated:        query.Result.Updated,
	}, nil
}

func (s *Service) UpdatePluginSetting(ctx context.Context, args *pluginsettings.UpdateArgs) error {
	encryptedSecureJsonData, err := s.secretsService.EncryptJsonData(ctx, args.SecureJSONData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.sqlStore.UpdatePluginSetting(ctx, &models.UpdatePluginSettingCmd{
		Enabled:                 args.Enabled,
		Pinned:                  args.Pinned,
		JsonData:                args.JSONData,
		SecureJsonData:          args.SecureJSONData,
		PluginVersion:           args.PluginVersion,
		PluginId:                args.PluginID,
		OrgId:                   args.OrgID,
		EncryptedSecureJsonData: encryptedSecureJsonData,
	})
}

func (s *Service) UpdatePluginSettingPluginVersion(ctx context.Context, args *pluginsettings.UpdatePluginVersionArgs) error {
	return s.sqlStore.UpdatePluginSettingVersion(ctx, &models.UpdatePluginSettingVersionCmd{
		PluginVersion: args.PluginVersion,
		PluginId:      args.PluginID,
		OrgId:         args.OrgID,
	})
}

func (s *Service) DecryptedValues(ps *pluginsettings.DTO) map[string]string {
	s.decryptionCache.Lock()
	defer s.decryptionCache.Unlock()

	if item, present := s.decryptionCache.cache[ps.ID]; present && ps.Updated.Equal(item.updated) {
		return item.json
	}

	json, err := s.secretsService.DecryptJsonData(context.Background(), ps.SecureJSONData)
	if err != nil {
		s.logger.Error("Failed to decrypt secure json data", "error", err)
		return map[string]string{}
	}

	s.decryptionCache.cache[ps.ID] = cachedDecryptedJSON{
		updated: ps.Updated,
		json:    json,
	}

	return json
}
