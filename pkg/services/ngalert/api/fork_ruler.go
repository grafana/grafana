package api

import (
	"fmt"
	"strconv"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type backendType string

const (
	grafanaRecipient backendType = "grafana"
	lokiRecipient    backendType = "loki"
	cortexRecipient  backendType = "prometheus"
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

func (r *ForkedRuler) backendType(ctx *models.ReqContext) (backend backendType) {
	recipient := ctx.Params("Recipient")
	if backendType(recipient) == grafanaRecipient {
		return backendType(recipient)
	}
	if datasourceID, err := strconv.ParseInt(recipient, 10, 64); err == nil {
		if ds, err := r.DatasourceCache.GetDatasource(datasourceID, ctx.SignedInUser, ctx.SkipCache); err == nil {
			return backendType(ds.Type)
		}
	}
	return backendType(recipient)
}

func backend(backendType backendType) (backend apimodels.Backend) {
	switch backendType {
	case grafanaRecipient:
		return apimodels.GrafanaBackend
	case lokiRecipient, cortexRecipient:
		return apimodels.LoTexRulerBackend
	}
	return
}

func (r *ForkedRuler) RouteDeleteNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	switch t := r.backendType(ctx); t {
	case grafanaRecipient:
		return r.GrafanaRuler.RouteDeleteNamespaceRulesConfig(ctx)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
	switch t := r.backendType(ctx); t {
	case grafanaRecipient:
		return r.GrafanaRuler.RouteDeleteRuleGroupConfig(ctx)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RouteDeleteRuleGroupConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	switch t := r.backendType(ctx); t {
	case grafanaRecipient:
		return r.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RouteGetNamespaceRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
	switch t := r.backendType(ctx); t {
	case grafanaRecipient:
		return r.GrafanaRuler.RouteGetRulegGroupConfig(ctx)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RouteGetRulegGroupConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RouteGetRulesConfig(ctx *models.ReqContext) response.Response {
	switch t := r.backendType(ctx); t {
	case grafanaRecipient:
		return r.GrafanaRuler.RouteGetRulesConfig(ctx)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RouteGetRulesConfig(ctx)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.RuleGroupConfig) response.Response {
	backendType := r.backendType(ctx)
	payloadType := conf.Type()

	b := backend(backendType)
	if b != payloadType {
		return response.Error(
			400,
			fmt.Sprintf(
				"unexpected backend type (%v) vs payload type (%v)",
				b,
				payloadType,
			),
			nil,
		)
	}

	switch backendType {
	case grafanaRecipient:
		return r.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf)
	case lokiRecipient, cortexRecipient:
		return r.LotexRuler.RoutePostNameRulesConfig(ctx, conf)
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", backendType), nil)
	}
}
