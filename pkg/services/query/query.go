package query

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("query_data")
)

func ProvideService(cfg *setting.Cfg, dataSourceCache datasources.CacheService, expressionService *expr.Service,
	pluginRequestValidator models.PluginRequestValidator, SecretsService secrets.Service,
	pluginClient plugins.Client, OAuthTokenService oauthtoken.OAuthTokenService) *Service {
	logger.Info("Query Service initialization")
	g := &Service{
		Cfg:                    cfg,
		DataSourceCache:        dataSourceCache,
		expressionService:      expressionService,
		PluginRequestValidator: pluginRequestValidator,
		SecretsService:         SecretsService,
		pluginClient:           pluginClient,
		OAuthTokenService:      OAuthTokenService,
	}
	return g
}

// Gateway receives data and translates it to Grafana Live publications.
type Service struct {
	Cfg                    *setting.Cfg
	DataSourceCache        datasources.CacheService
	expressionService      *expr.Service
	PluginRequestValidator models.PluginRequestValidator
	SecretsService         secrets.Service
	pluginClient           plugins.Client
	OAuthTokenService      oauthtoken.OAuthTokenService
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *Service) QueryData(ctx context.Context, u *models.SignedInUser, skipCache bool, reqDTO dtos.MetricRequest) (*backend.QueryDataResponse, error) {
	return nil, errors.New("not implemented")
}
