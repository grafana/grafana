package api

import (
	"bytes"
	"fmt"
	"net/http"
	"net/url"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var dsTypeToRulerPrefix = map[string]string{
	"prometheus": "/rules",
	"loki":       "/api/prom/rules",
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

func (r *LotexRuler) RouteDeleteNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	return r.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf("%s/%s", legacyRulerPrefix, web.Params(ctx.Req)[":Namespace"]),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
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
				web.Params(ctx.Req)[":Namespace"],
				web.Params(ctx.Req)[":Groupname"],
			),
		),
		nil,
		messageExtractor,
		nil,
	)
}

func (r *LotexRuler) RouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
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
				web.Params(ctx.Req)[":Namespace"],
			),
		),
		nil,
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
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
				web.Params(ctx.Req)[":Namespace"],
				web.Params(ctx.Req)[":Groupname"],
			),
		),
		nil,
		yamlExtractor(&apimodels.GettableRuleGroupConfig{}),
		nil,
	)
}

func (r *LotexRuler) RouteGetRulesConfig(ctx *models.ReqContext) response.Response {
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

func (r *LotexRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.PostableRuleGroupConfig) response.Response {
	legacyRulerPrefix, err := r.validateAndGetPrefix(ctx)
	if err != nil {
		return ErrResp(500, err, "")
	}
	yml, err := yaml.Marshal(conf)
	if err != nil {
		return ErrResp(500, err, "Failed marshal rule group")
	}
	ns := web.Params(ctx.Req)[":Namespace"]
	u := withPath(*ctx.Req.URL, fmt.Sprintf("%s/%s", legacyRulerPrefix, ns))
	return r.withReq(ctx, http.MethodPost, u, bytes.NewBuffer(yml), jsonExtractor(nil), nil)
}

func (r *LotexRuler) validateAndGetPrefix(ctx *models.ReqContext) (string, error) {
	ds, err := r.DataProxy.DataSourceCache.GetDatasource(ctx.ParamsInt64(":Recipient"), ctx.SignedInUser, ctx.SkipCache)
	if err != nil {
		return "", err
	}
	// Validate URL
	if ds.Url == "" {
		return "", fmt.Errorf("URL for this data source is empty")
	}

	prefix, ok := dsTypeToRulerPrefix[ds.Type]
	if !ok {
		return "", fmt.Errorf("unexpected datasource type. expecting loki or prometheus")
	}
	return prefix, nil
}

func withPath(u url.URL, newPath string) *url.URL {
	// TODO: handle path escaping
	u.Path = newPath
	return &u
}
