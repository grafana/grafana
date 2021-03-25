package api

import (
	"fmt"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// ForkedRuler will validate and proxy requests to the correct backend type depending on the datasource.
type ForkedRuler struct {
	LotexRuler, GrafanaRuler RulerApiService
	DatasourceCache          datasources.CacheService
}

func NewForkedRuler(datasourceCache datasources.CacheService, lotex, grafana RulerApiService) *ForkedRuler {
	return &ForkedRuler{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
	}
}

func (r *ForkedRuler) RouteDeleteNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteDeleteNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteDeleteRuleGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteDeleteRuleGroupConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetNamespaceRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetRulegGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetRulegGroupConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.RuleGroupConfig) response.Response {
	backendType, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	payloadType := conf.Type()

	if backendType != payloadType {
		return response.Error(
			400,
			fmt.Sprintf(
				"unexpected backend type (%v) vs payload type (%v)",
				backendType,
				payloadType,
			),
			nil,
		)
	}

	switch backendType {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RoutePostNameRulesConfig(ctx, conf)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", backendType), nil)
	}
}
