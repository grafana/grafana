package api

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

const (
	Prometheus = "prometheus"
	Cortex     = "cortex"
	Mimir      = "mimir"
)

const (
	mimirPrefix      = "/config/v1/rules"
	prometheusPrefix = "/rules"
	lokiPrefix       = "/api/prom/rules"

	subtypeQuery = "subtype"
)

var subtypeToPrefix = map[string]string{
	Prometheus: prometheusPrefix,
	Cortex:     prometheusPrefix,
	Mimir:      mimirPrefix,
}

// The requester is primarily used for testing purposes, allowing us to inject a different implementation of withReq.
type requester interface {
	withReq(ctx *contextmodel.ReqContext, method string, u *url.URL, body io.Reader, extractor func(*response.NormalResponse) (any, error), headers map[string]string) response.Response
}

type LotexRuler struct {
	log log.Logger
	*AlertingProxy
	requester requester
}

func NewLotexRuler(proxy *AlertingProxy, log log.Logger) *LotexRuler {
	return &LotexRuler{
		log:           log,
		AlertingProxy: proxy,
		requester:     proxy,
	}
}

func (r *LotexRuler) RouteDeleteNamespaceRulesConfig(ctx *contextmodel.ReqContext, namespace string) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf("%s/%s", legacyRulerPrefix, url.PathEscape(finalNamespace)),
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

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	finalGroup, err := getRulesGroupParam(ctx, group)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
				url.PathEscape(finalGroup),
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

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
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

	finalNamespace, err := getRulesNamespaceParam(ctx, namespace)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	finalGroup, err := getRulesGroupParam(ctx, group)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	return r.requester.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(
				"%s/%s/%s",
				legacyRulerPrefix,
				url.PathEscape(finalNamespace),
				url.PathEscape(finalGroup),
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

	return r.requester.withReq(
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

	finalNamespace, err := getRulesNamespaceParam(ctx, ns)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}

	u := withPath(*ctx.Req.URL, fmt.Sprintf("%s/%s", legacyRulerPrefix, url.PathEscape(finalNamespace)))
	return r.requester.withReq(ctx, http.MethodPost, u, bytes.NewBuffer(yml), jsonExtractor(nil), nil)
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

	var prefix string
	switch {
	case isPrometheusCompatible(ds.Type):
		prefix = prometheusPrefix
	case ds.Type == datasources.DS_LOKI:
		prefix = lokiPrefix
	default:
		return "", unexpectedDatasourceTypeError(ds.Type, "loki, prometheus, amazon prometheus, azure prometheus")
	}

	// If the datasource is Loki, there's nothing else for us to do - it doesn't have subtypes.
	if ds.Type == datasources.DS_LOKI {
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
	u.Path, _ = url.PathUnescape(newPath)
	u.RawPath = newPath

	return &u
}
