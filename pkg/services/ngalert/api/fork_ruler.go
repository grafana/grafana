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
	LotexRuler      *LotexRuler
	GrafanaRuler    *RulerSrv
	DatasourceCache datasources.CacheService
}

// NewForkedRuler implements a set of routes that proxy to various Cortex Ruler-compatible backends.
func NewForkedRuler(datasourceCache datasources.CacheService, lotex *LotexRuler, grafana *RulerSrv) *ForkedRulerApi {
	return &ForkedRulerApi{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
	}
}

func (f *ForkedRulerApi) forkRouteDeleteNamespaceRulesConfig(ctx *models.ReqContext, dsUID, namespace string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx, namespace)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteDeleteRuleGroupConfig(ctx *models.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteDeleteRuleGroupConfig(ctx, namespace, group)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetNamespaceRulesConfig(ctx *models.ReqContext, dsUID, namespace string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetNamespaceRulesConfig(ctx, namespace)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetRulegGroupConfig(ctx *models.ReqContext, dsUID, namespace, group string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetRulegGroupConfig(ctx, namespace, group)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRouteGetRulesConfig(ctx *models.ReqContext, dsUID string) response.Response {
	t, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	switch t {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RouteGetRulesConfig(ctx)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", t), "")
	}
}

func (f *ForkedRulerApi) forkRoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig, dsUID, namespace string) response.Response {
	backendType, err := backendTypeByUID(ctx, f.DatasourceCache)
	if err != nil {
		return ErrResp(400, err, "")
	}
	payloadType := conf.Type()

	if backendType != payloadType {
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v) vs payload type (%v)", backendType, payloadType), "")
	}

	switch backendType {
	case apimodels.LoTexRulerBackend:
		return f.LotexRuler.RoutePostNameRulesConfig(ctx, conf, namespace)
	default:
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v)", backendType), "")
	}
}

func (f *ForkedRulerApi) forkRouteDeleteNamespaceGrafanaRulesConfig(ctx *models.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, "")
}

func (f *ForkedRulerApi) forkRouteDeleteGrafanaRuleGroupConfig(ctx *models.ReqContext, namespace, groupName string) response.Response {
	return f.GrafanaRuler.RouteDeleteAlertRules(ctx, namespace, groupName)
}

func (f *ForkedRulerApi) forkRouteGetNamespaceGrafanaRulesConfig(ctx *models.ReqContext, namespace string) response.Response {
	return f.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx, namespace)
}

func (f *ForkedRulerApi) forkRouteGetGrafanaRuleGroupConfig(ctx *models.ReqContext, namespace, group string) response.Response {
	return f.GrafanaRuler.RouteGetRulesGroupConfig(ctx, namespace, group)
}

func (f *ForkedRulerApi) forkRouteGetGrafanaRulesConfig(ctx *models.ReqContext) response.Response {
	return f.GrafanaRuler.RouteGetRulesConfig(ctx)
}

func (f *ForkedRulerApi) forkRoutePostNameGrafanaRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig, namespace string) response.Response {
	payloadType := conf.Type()
	if payloadType != apimodels.GrafanaBackend {
		return ErrResp(400, fmt.Errorf("unexpected backend type (%v) vs payload type (%v)", apimodels.GrafanaBackend, payloadType), "")
	}
	return f.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf, namespace)
}
