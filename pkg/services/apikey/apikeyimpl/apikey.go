package apikeyimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB, cfg *setting.Cfg) apikey.Service {
	if cfg.IsFeatureToggleEnabled("newDBLibrary") {
		return &Service{
			store: &sqlxStore{
				sess: db.GetSqlxSession(),
				cfg:  cfg,
			},
		}
	}
	return &Service{store: &sqlStore{db: db, cfg: cfg}}
}

func (s *Service) GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) error {
	return s.store.GetAPIKeys(ctx, query)
}
func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	return s.store.GetAllAPIKeys(ctx, orgID)
}
func (s *Service) GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) error {
	return s.store.GetApiKeyById(ctx, query)
}
func (s *Service) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) error {
	return s.store.GetApiKeyByName(ctx, query)
}
func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return s.store.GetAPIKeyByHash(ctx, hash)
}
func (s *Service) DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error {
	return s.store.DeleteApiKey(ctx, cmd)
}
func (s *Service) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) error {
	return s.store.AddAPIKey(ctx, cmd)
}
func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.store.UpdateAPIKeyLastUsedDate(ctx, tokenID)
}
