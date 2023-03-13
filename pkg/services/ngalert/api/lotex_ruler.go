package api

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

const (
	Prometheus = "prometheus"
	Cortex     = "cortex"
	Mimir      = "mimir"
)

const (
	PrometheusDatasourceType = "prometheus"
	LokiDatasourceType       = "loki"

	mimirPrefix      = "/config/v1/rules"
	prometheusPrefix = "/rules"
	lokiPrefix       = "/api/prom/rules"

	subtypeQuery = "subtype"
)

var dsTypeToRulerPrefix = map[string]string{
	PrometheusDatasourceType: prometheusPrefix,
	LokiDatasourceType:       lokiPrefix,
}

var subtypeToPrefix = map[string]string{
	Prometheus: prometheusPrefix,
	Cortex:     prometheusPrefix,
	Mimir:      mimirPrefix,
}

type LotexRuler struct {
	log log.Logger
	*AlertingProxy
}

func NewLotexRuler(proxy *AlertingProxy, log log.Logger) *LotexRuler {
	return &LotexRuler{
		log:           log,
		AlertingProxy: proxy,
	}
}

func (r *LotexRuler) RouteDeleteNamespaceRulesConfig(ctx *contextmodel.ReqContext, namespace string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	return r.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf("%s/%s", legacyRulerPrefix, namespace),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteDeleteRuleGroupConfig(ctx *contextmodel.ReqContext, namespace string, group string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	return r.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				namespace,
				group,
			),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteGetNamespaceRulesConfig(ctx *contextmodel.ReqContext, namespace string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	return r.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s",
				legacyRulerPrefix,
				namespace,
			),
		),
		nil,
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulegGroupConfig(ctx *contextmodel.ReqContext, namespace string, group string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	return r.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				namespace,
				group,
			),
		),
		nil,
		yamlExtractor(&apimodels.GettableRuleGroupConfig{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulesConfig(ctx *contextmodel.ReqContext) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}

	return r.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			legacyRulerPrefix,
		),
		nil,
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
		nil,
	)
}

func (r *LotexRuler) RoutePostNameRulesConfig(ctx *contextmodel.ReqContext, conf apimodels.PostableRuleGroupConfig, ns string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	yml, err := yaml.Marshal(conf)
	if err != nil {
		return ErrResp(500, err, "Failed marshal rule group")
	}
	u := withPath(*ctx.Req.URL, fmt.Sprintf("%s/%s", legacyRulerPrefix, ns))
	return r.withReq(ctx, http.MethodPost, u, bytes.NewBuffer(yml), jsonExtractor(nil), nil)
}

func (r *LotexRuler) validateAndGetPrefix(ctx *contextmodel.ReqContext) (string, error) {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	if datasourceUID == "" {
		return "", fmt.Errorf("datasource UID is invalid")
	}

	ds, err := r.DataProxy.DataSourceCache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipDSCache)
	if err != nil {
		return "", err
	}

	// Validate URL
	if ds.URL == "" {
		return "", fmt.Errorf("URL for this data source is empty")
	}

	prefix, ok := dsTypeToRulerPrefix[ds.Type]
	if !ok {
		return "", fmt.Errorf("unexpected datasource type. expecting loki or prometheus")
	}

	// If the datasource is Loki, there's nothing else for us to do - it doesn't have subtypes.
	if ds.Type == LokiDatasourceType {
		return prefix, nil
	}

	// A Prometheus datasource, can have many subtypes: Cortex, Mimir and vanilla Prometheus.
	// Based on these subtypes, we want to use a different proxying path.
	subtype := ctx.Query(subtypeQuery)
	subTypePrefix, ok := subtypeToPrefix[subtype]
	if !ok {
		r.log.Debug(
			"Unable to determine prometheus datasource subtype, using default prefix",
			"datasource", ds.UID, "datasourceType", ds.Type, "subtype", subtype, "prefix", prefix)
		return prefix, nil
	}

	r.log.Debug("Determined prometheus datasource subtype",
		"datasource", ds.UID, "datasourceType", ds.Type, "subtype", subtype)
	return subTypePrefix, nil
}

func withPath(u url.URL, newPath string) *url.URL {
	// TODO: handle path escaping
	u.Path = newPath
	return &u
}
