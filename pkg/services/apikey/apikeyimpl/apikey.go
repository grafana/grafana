package apikeyimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB, settingsProvider setting.SettingsProvider, quotaService quota.Service) (apikey.Service, error) {
	s := &Service{
		store: &sqlStore{db: db},
	}
	defaultLimits, err := readQuotaConfig(settingsProvider)
	if err != nil {
		return s, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     apikey.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.Usage,
	}); err != nil {
		return s, err
	}

	return s, nil
}

func (s *Service) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return s.store.Count(ctx, scopeParams)
}

func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	return s.store.GetAllAPIKeys(ctx, orgID)
}

func (s *Service) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (*apikey.APIKey, error) {
	return s.store.GetApiKeyByName(ctx, query)
}

func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return s.store.GetAPIKeyByHash(ctx, hash)
}

func (s *Service) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (res *apikey.APIKey, err error) {
	return s.store.AddAPIKey(ctx, cmd)
}

func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.store.UpdateAPIKeyLastUsedDate(ctx, tokenID)
}

func readQuotaConfig(settingsProvider setting.SettingsProvider) (*quota.Map, error) {
	limits := &quota.Map{}

	if settingsProvider == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}
	orgQuotaTag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, quota.OrgScope)
	if err != nil {
		return limits, err
	}

	cfg := settingsProvider.Get()
	limits.Set(globalQuotaTag, cfg.Quota.Global.ApiKey)
	limits.Set(orgQuotaTag, cfg.Quota.Org.ApiKey)
	return limits, nil
}
