package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"gopkg.in/yaml.v3"
)

const (
	amSilencesPath    = "/api/v2/silences"
	amSilencePath     = "/api/v2/silence/%s"
	amAlertGroupsPath = "/api/v2/alerts/groups"
	amAlertsPath      = "/api/v2/alerts"
	amConfigPath      = "/api/v1/alerts"
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

func (am *LotexAM) RouteCreateSilence(ctx *models.ReqContext, silenceBody apimodels.PostableSilence) response.Response {
	blob, err := json.Marshal(silenceBody)
	if err != nil {
		return response.Error(500, "Failed marshal silence", err)
	}
	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amSilencesPath),
		bytes.NewBuffer(blob),
		jsonExtractor(&apimodels.GettableSilence{}),
	)
}

func (am *LotexAM) RouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			amConfigPath,
		),
		nil,
		messageExtractor,
	)
}

func (am *LotexAM) RouteDeleteSilence(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodDelete,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(amSilencePath, ctx.Params(":SilenceId")),
		),
		nil,
		messageExtractor,
	)
}

func (am *LotexAM) RouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			amConfigPath,
		),
		nil,
		jsonExtractor(&apimodels.GettableUserConfig{}),
	)
}

func (am *LotexAM) RouteGetAMAlertGroups(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			amAlertGroupsPath,
		),
		nil,
		jsonExtractor(&apimodels.AlertGroups{}),
	)
}

func (am *LotexAM) RouteGetAMAlerts(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			amAlertsPath,
		),
		nil,
		jsonExtractor(&apimodels.GettableAlerts{}),
	)
}

func (am *LotexAM) RouteGetSilence(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			fmt.Sprintf(amSilencePath, ctx.Params(":SilenceId")),
		),
		nil,
		jsonExtractor(&apimodels.GettableSilence{}),
	)
}

func (am *LotexAM) RouteGetSilences(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			amSilencesPath,
		),
		nil,
		jsonExtractor(&apimodels.GettableSilences{}),
	)
}

func (am *LotexAM) RoutePostAlertingConfig(ctx *models.ReqContext, config apimodels.PostableUserConfig) response.Response {
	yml, err := yaml.Marshal(config)
	if err != nil {
		return response.Error(500, "Failed marshal alert manager configuration ", err)
	}

	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amConfigPath),
		bytes.NewBuffer(yml),
		messageExtractor,
	)
}

func (am *LotexAM) RoutePostAMAlerts(ctx *models.ReqContext, alerts apimodels.PostableAlerts) response.Response {
	yml, err := yaml.Marshal(alerts)
	if err != nil {
		return response.Error(500, "Failed marshal postable alerts", err)
	}

	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amAlertsPath),
		bytes.NewBuffer(yml),
		messageExtractor,
	)
}
