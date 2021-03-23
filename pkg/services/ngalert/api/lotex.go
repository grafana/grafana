package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"gopkg.in/macaron.v1"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
)

const legacyRulerPrefix = "/api/prom/rules"

type LotexRuler struct {
	DataProxy *datasourceproxy.DatasourceProxyService
	log       log.Logger
}

// macaron unsafely asserts the http.ResponseWriter is an http.CloseNotifier, which will panic.
// Here we impl it, which will ensure this no longer happens, but neither will we take
// advantage cancelling upstream requests when the downstream has closed.
// NB: http.CloseNotifier is a deprecated ifc from before the context pkg.
type safeMacaronWrapper struct {
	http.ResponseWriter
}

func (w *safeMacaronWrapper) CloseNotify() <-chan bool {
	return make(chan bool)
}

// replacedResponseWriter overwrites the underlying responsewriter used by a *models.ReqContext.
// It's ugly because it needs to replace a value behind a few nested pointers.
func replacedResponseWriter(ctx *models.ReqContext) (*models.ReqContext, *response.NormalResponse) {
	resp := response.CreateNormalResponse(make(http.Header), nil, 0)
	cpy := *ctx
	cpyMCtx := *cpy.Context
	cpyMCtx.Resp = macaron.NewResponseWriter(ctx.Req.Method, &safeMacaronWrapper{resp})
	cpy.Context = &cpyMCtx
	return &cpy, resp
}

// withReq proxies a different request
func (r *LotexRuler) withReq(
	ctx *models.ReqContext,
	req *http.Request,
	extractor func([]byte) (interface{}, error),
) response.Response {
	newCtx, resp := replacedResponseWriter(ctx)
	newCtx.Req.Request = req
	r.DataProxy.ProxyDatasourceRequestWithID(newCtx, ctx.ParamsInt64("Recipient"))

	status := resp.Status()
	if status >= 400 {
		return response.Error(status, string(resp.Body()), nil)
	}

	t, err := extractor(resp.Body())
	if err != nil {
		return response.Error(500, err.Error(), nil)
	}

	b, err := json.Marshal(t)
	if err != nil {
		return response.Error(500, err.Error(), nil)
	}

	return response.JSON(status, b)
}

func yamlExtractor(v interface{}) func([]byte) (interface{}, error) {
	return func(b []byte) (interface{}, error) {
		decoder := yaml.NewDecoder(bytes.NewReader(b))
		decoder.KnownFields(true)

		err := decoder.Decode(v)

		return v, err
	}
}

func jsonExtractor(v interface{}) func([]byte) (interface{}, error) {
	if v == nil {
		// json unmarshal expects a pointer
		v = &map[string]interface{}{}
	}
	return func(b []byte) (interface{}, error) {
		return v, json.Unmarshal(b, v)
	}
}

func messageExtractor(b []byte) (interface{}, error) {
	return map[string]string{"message": string(b)}, nil
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
