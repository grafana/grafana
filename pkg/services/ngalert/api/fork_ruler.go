package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// ForkedRuler will validate and proxy requests to the correct backend type depending on the datasource.
type ForkedRuler struct {
	LotexRuler, GrafanaRuler RulerApiService
	DatasourceCache          datasources.CacheService
}

// NewForkedRuler implements a set of routes that proxy to various Cortex Ruler-compatible backends.
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
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteDeleteNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (r *ForkedRuler) RouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteDeleteRuleGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteDeleteRuleGroupConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (r *ForkedRuler) RouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetNamespaceRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (r *ForkedRuler) RouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetRulegGroupConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetRulegGroupConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (r *ForkedRuler) RouteGetRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RouteGetRulesConfig(ctx)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RouteGetRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (r *ForkedRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig) response.Response {
	backendType, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	payloadType := conf.Type()

	if backendType != payloadType {
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v) vs payload type (%v)", backendType, payloadType), "")
	}

	switch backendType {
	case apimodels.GrafanaBackend:
		return r.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf)
	case apimodels.LoTexRulerBackend:
		return r.LotexRuler.RoutePostNameRulesConfig(ctx, conf)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", backendType), "")
	}
}
