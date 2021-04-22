package api

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	GrafanaBackend = "grafana"
	ProxyBackend   = "proxy" // metric cardinality is too high to enumerate all non-grafana backends
)

// ForkedRuler will validate and proxy requests to the correct backend type depending on the datasource.
type ForkedRuler struct {
	LotexRuler, GrafanaRuler RulerApiService
	DatasourceCache          datasources.CacheService

	// metrics
	duration *prometheus.HistogramVec
}

// NewForkedRuler implements a set of routes that proxy to various Cortex Ruler-compatible backends.
func NewForkedRuler(datasourceCache datasources.CacheService, lotex, grafana RulerApiService, reg prometheus.Registerer) *ForkedRuler {
	r := &ForkedRuler{
		LotexRuler:      lotex,
		GrafanaRuler:    grafana,
		DatasourceCache: datasourceCache,
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "alerting_ruler_api_duration_seconds",
			Help:      "Histogram of latencies affecting the Unified Alerting Ruler API",
			Buckets:   prometheus.DefBuckets,
		}, []string{"backend", "status"}),
	}
	if reg != nil {
		reg.MustRegister(
			r.duration,
		)
	}
	return r
}

func (r *ForkedRuler) instrument(backend string, fn func() response.Response) response.Response {
	start := time.Now()
	resp := fn()
	r.duration.
		WithLabelValues(backend, fmt.Sprint(resp.Status())).
		Observe(time.Since(start).Seconds())
	return resp
}

func (r *ForkedRuler) RouteDeleteNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	t, err := backendType(ctx, r.DatasourceCache)
	if err != nil {
		return response.Error(400, err.Error(), nil)
	}
	switch t {
	case apimodels.GrafanaBackend:
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RouteDeleteNamespaceRulesConfig(ctx) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RouteDeleteNamespaceRulesConfig(ctx) })
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
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RouteDeleteRuleGroupConfig(ctx) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RouteDeleteRuleGroupConfig(ctx) })
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
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RouteGetNamespaceRulesConfig(ctx) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RouteGetNamespaceRulesConfig(ctx) })
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
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RouteGetRulegGroupConfig(ctx) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RouteGetRulegGroupConfig(ctx) })
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
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RouteGetRulesConfig(ctx) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RouteGetRulesConfig(ctx) })
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", t), nil)
	}
}

func (r *ForkedRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig) response.Response {
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
		return r.instrument(GrafanaBackend, func() response.Response { return r.GrafanaRuler.RoutePostNameRulesConfig(ctx, conf) })
	case apimodels.LoTexRulerBackend:
		return r.instrument(ProxyBackend, func() response.Response { return r.LotexRuler.RoutePostNameRulesConfig(ctx, conf) })
	default:
		return response.Error(400, fmt.Sprintf("unexpected backend type (%v)", backendType), nil)
	}
}
