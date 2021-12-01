package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedRulerApi will validate and proxy requests to the correct backend type depending on the datasource.
type ForkedRulerApi struct {
	LotexRuler, GrafanaRuler RulerApiService
	DatasourceCache          datasources.CacheService
}

// NewForkedRuler implements a set of routes that proxy to various Cortex Ruler-compatible backends.
func NewForkedRuler(datasourceCache datasources.CacheService, lotex, grafana RulerApiService) *ForkedRulerApi {
	return &ForkedRulerApi{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *ForkedRulerApi) forkRouteDeleteNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RouteDeleteNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RouteDeleteRuleGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteDeleteRuleGroupConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetNamespaceRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RouteGetRulegGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetRulegGroupConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RouteGetRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig) response.Response {
	backendType, err := backendType(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	payloadType := conf.Type()

	if backendType != payloadType {
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v) vs payload type (%v)", backendType, payloadType), "")
	}

	switch backendType {
	case apimodels.GrafanaBackend:
		return f.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf)
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RoutePostNameRulesConfig(ctx, conf)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", backendType), "")
	}
}
