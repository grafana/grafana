package api

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

const legacyRulerPrefix = "/api/prom/rules"

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
	return r.withReq(
		ctx,
		&http.Request{
			Method: "DELETE",
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf("/api/prom/rules/%s", ctx.Params("Namespace")),
			),
		},
		messageExtractor,
	)
}

func (r *LotexRuler) RouteDeleteRuleGroupConfig(ctx *models.ReqContext) response.Response {
	return r.withReq(
		ctx,
		&http.Request{
			Method: "DELETE",
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf(
					"%s/%s/%s",
					legacyRulerPrefix,
					ctx.Params("Namespace"),
					ctx.Params("Groupname"),
				),
			),
		},
		messageExtractor,
	)
}

func (r *LotexRuler) RouteGetNamespaceRulesConfig(ctx *models.ReqContext) response.Response {
	return r.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf(
					"%s/%s",
					legacyRulerPrefix,
					ctx.Params("Namespace"),
				),
			),
		},
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
	)
}

func (r *LotexRuler) RouteGetRulegGroupConfig(ctx *models.ReqContext) response.Response {
	return r.withReq(
		ctx,
		&http.Request{
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf(
					"%s/%s/%s",
					legacyRulerPrefix,
					ctx.Params("Namespace"),
					ctx.Params("Groupname"),
				),
			),
		},
		yamlExtractor(apimodels.RuleGroupConfigResponse{}),
	)
}

func (r *LotexRuler) RouteGetRulesConfig(ctx *models.ReqContext) response.Response {
	return r.withReq(
		ctx,
		&http.Request{
			URL: withPath(
				*ctx.Req.URL,
				legacyRulerPrefix,
			),
		},
		yamlExtractor(apimodels.NamespaceConfigResponse{}),
	)
}

func (r *LotexRuler) RoutePostNameRulesConfig(ctx *models.ReqContext, conf apimodels.RuleGroupConfig) response.Response {
	yml, err := yaml.Marshal(conf)
	if err != nil {
		return response.Error(500, "Failed marshal rule group", err)
	}
	body, ln := payload(yml)

	ns := ctx.Params("Namespace")

	u := withPath(*ctx.Req.URL, fmt.Sprintf("%s/%s", legacyRulerPrefix, ns))
	req := &http.Request{
		Method:        "POST",
		URL:           u,
		Body:          body,
		ContentLength: ln,
	}
	return r.withReq(ctx, req, jsonExtractor(nil))
}

func withPath(u url.URL, newPath string) *url.URL {
	// TODO: handle path escaping
	u.Path = newPath
	return &u
}

func payload(b []byte) (io.ReadCloser, int64) {
	return ioutil.NopCloser(bytes.NewBuffer(b)), int64(len(b))
}
