package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

var endpoints = map[string]map[string]string{
	"cortex": {
		"silences": "/alertmanager/api/v2/silences",
		"silence":  "/alertmanager/api/v2/silence/%s",
		"status":   "/alertmanager/api/v2/status",
		"groups":   "/alertmanager/api/v2/alerts/groups",
		"alerts":   "/alertmanager/api/v2/alerts",
		"config":   "/api/v1/alerts",
	},
	"mimir": {
		"silences": "/alertmanager/api/v2/silences",
		"silence":  "/alertmanager/api/v2/silence/%s",
		"status":   "/alertmanager/api/v2/status",
		"groups":   "/alertmanager/api/v2/alerts/groups",
		"alerts":   "/alertmanager/api/v2/alerts",
		"config":   "/api/v1/alerts",
	},
	"prometheus": {
		"silences": "/api/v2/silences",
		"silence":  "/api/v2/silence/%s",
		"status":   "/api/v2/status",
		"groups":   "/api/v2/alerts/groups",
		"alerts":   "/api/v2/alerts",
	},
}

const (
	defaultImplementation = "cortex"
)

type LotexAM struct {
	log log.Logger
	*AlertingProxy
}

func NewLotexAM(proxy *AlertingProxy, log log.Logger) *LotexAM {
	return &LotexAM{
		log:           log,
		AlertingProxy: proxy,
	}
}

func (am *LotexAM) withAMReq(
	ctx *contextmodel.ReqContext,
	method string,
	endpoint string,
	pathParams []string,
	body io.Reader,
	extractor func(*response.NormalResponse) (interface{}, error),
	headers map[string]string,
) response.Response {
	datasourceUID := web.Params(ctx.Req)[":DatasourceUID"]
	if datasourceUID == "" {
		return response.Error(http.StatusBadRequest, "DatasourceUID is invalid", nil)
	}

	ds, err := am.DataProxy.DataSourceCache.GetDatasourceByUID(ctx.Req.Context(), datasourceUID, ctx.SignedInUser, ctx.SkipCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			return ErrResp(http.StatusForbidden, err, "Access denied to datasource")
		}
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return ErrResp(http.StatusNotFound, err, "Unable to find datasource")
		}
		return ErrResp(http.StatusInternalServerError, err, "Unable to load datasource meta data")
	}

	impl := ds.JsonData.Get("implementation").MustString(defaultImplementation)
	implEndpoints, ok := endpoints[impl]
	if !ok {
		return ErrResp(http.StatusBadRequest, fmt.Errorf("unsupported Alert Manager implementation \"%s\"", impl), "")
	}
	endpointPath, ok := implEndpoints[endpoint]
	if !ok {
		return ErrResp(http.StatusBadRequest, fmt.Errorf("unsupported endpoint \"%s\" for Alert Manager implementation \"%s\"", endpoint, impl), "")
	}

	iPathParams := make([]interface{}, len(pathParams))
	for idx, value := range pathParams {
		iPathParams[idx] = value
	}

	return am.withReq(
		ctx,
		method,
		withPath(*ctx.Req.URL, fmt.Sprintf(endpointPath, iPathParams...)),
		body,
		extractor,
		headers,
	)
}

func (am *LotexAM) RouteGetAMStatus(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"status",
		nil,
		nil,
		jsonExtractor(&apimodels.GettableStatus{}),
		nil,
	)
}

func (am *LotexAM) RouteCreateSilence(ctx *contextmodel.ReqContext, silenceBody apimodels.PostableSilence) response.Response {
	blob, err := json.Marshal(silenceBody)
	if err != nil {
		return ErrResp(500, err, "Failed marshal silence")
	}
	return am.withAMReq(
		ctx,
		http.MethodPost,
		"silences",
		nil,
		bytes.NewBuffer(blob),
		jsonExtractor(&apimodels.PostSilencesOKBody{}),
		map[string]string{"Content-Type": "application/json"},
	)
}

func (am *LotexAM) RouteDeleteAlertingConfig(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodDelete,
		"config",
		nil,
		nil,
		messageExtractor,
		nil,
	)
}

func (am *LotexAM) RouteDeleteSilence(ctx *contextmodel.ReqContext, silenceID string) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodDelete,
		"silence",
		[]string{silenceID},
		nil,
		messageExtractor,
		nil,
	)
}

func (am *LotexAM) RouteGetAlertingConfig(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"config",
		nil,
		nil,
		yamlExtractor(&apimodels.GettableUserConfig{}),
		nil,
	)
}

func (am *LotexAM) RouteGetAMAlertGroups(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"groups",
		nil,
		nil,
		jsonExtractor(&apimodels.AlertGroups{}),
		nil,
	)
}

func (am *LotexAM) RouteGetAMAlerts(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"alerts",
		nil,
		nil,
		jsonExtractor(&apimodels.GettableAlerts{}),
		nil,
	)
}

func (am *LotexAM) RouteGetSilence(ctx *contextmodel.ReqContext, silenceID string) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"silence",
		[]string{silenceID},
		nil,
		jsonExtractor(&apimodels.GettableSilence{}),
		nil,
	)
}

func (am *LotexAM) RouteGetSilences(ctx *contextmodel.ReqContext) response.Response {
	return am.withAMReq(
		ctx,
		http.MethodGet,
		"silences",
		nil,
		nil,
		jsonExtractor(&apimodels.GettableSilences{}),
		nil,
	)
}

func (am *LotexAM) RoutePostAlertingConfig(ctx *contextmodel.ReqContext, config apimodels.PostableUserConfig) response.Response {
	yml, err := yaml.Marshal(&config)
	if err != nil {
		return ErrResp(500, err, "Failed marshal alert manager configuration ")
	}

	return am.withAMReq(
		ctx,
		http.MethodPost,
		"config",
		nil,
		bytes.NewBuffer(yml),
		messageExtractor,
		nil,
	)
}

func (am *LotexAM) RoutePostAMAlerts(ctx *contextmodel.ReqContext, alerts apimodels.PostableAlerts) response.Response {
	yml, err := yaml.Marshal(alerts)
	if err != nil {
		return ErrResp(500, err, "Failed marshal postable alerts")
	}

	return am.withAMReq(
		ctx,
		http.MethodPost,
		"alerts",
		nil,
		bytes.NewBuffer(yml),
		messageExtractor,
		nil,
	)
}
