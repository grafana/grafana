package api

import (
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
	body, ln := payload(blob)
	return am.withReq(
		ctx, &http.Request{
			Method:        "POST",
			URL:           withPath(*ctx.Req.URL, amSilencesPath),
			Body:          body,
			ContentLength: ln,
		},
		jsonExtractor(&apimodels.GettableSilence{}),
	)
}

func (am *LotexAM) RouteDeleteAlertingConfig(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			Method: "DELETE",
			URL: withPath(
				*ctx.Req.URL,
				amConfigPath,
			),
		},
		messageExtractor,
	)
}

func (am *LotexAM) RouteDeleteSilence(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			Method: "DELETE",
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf(amSilencePath, ctx.Params(":SilenceId")),
			),
		},
		messageExtractor,
	)
}

func (am *LotexAM) RouteGetAlertingConfig(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				amConfigPath,
			),
		},
		jsonExtractor(&apimodels.GettableUserConfig{}),
	)
}

func (am *LotexAM) RouteGetAMAlertGroups(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				amAlertGroupsPath,
			),
		},
		jsonExtractor(&apimodels.AlertGroups{}),
	)
}

func (am *LotexAM) RouteGetAMAlerts(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				amAlertsPath,
			),
		},
		jsonExtractor(&apimodels.GettableAlerts{}),
	)
}

func (am *LotexAM) RouteGetSilence(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				fmt.Sprintf(amSilencePath, ctx.Params(":SilenceId")),
			),
		},
		jsonExtractor(&apimodels.GettableSilence{}),
	)
}

func (am *LotexAM) RouteGetSilences(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx, &http.Request{
			URL: withPath(
				*ctx.Req.URL,
				amSilencesPath,
			),
		},
		jsonExtractor(&apimodels.GettableSilences{}),
	)
}

func (am *LotexAM) RoutePostAlertingConfig(ctx *models.ReqContext, config apimodels.PostableUserConfig) response.Response {
	yml, err := yaml.Marshal(config)
	if err != nil {
		return response.Error(500, "Failed marshal alert manager configuration ", err)
	}
	body, ln := payload(yml)

	u := withPath(*ctx.Req.URL, amConfigPath)
	req := &http.Request{
		Method:        "POST",
		URL:           u,
		Body:          body,
		ContentLength: ln,
	}
	return am.withReq(ctx, req, messageExtractor)
}

func (am *LotexAM) RoutePostAMAlerts(ctx *models.ReqContext, alerts apimodels.PostableAlerts) response.Response {
	yml, err := yaml.Marshal(alerts)
	if err != nil {
		return response.Error(500, "Failed marshal postable alerts", err)
	}
	body, ln := payload(yml)

	u := withPath(*ctx.Req.URL, amAlertsPath)
	req := &http.Request{
		Method:        "POST",
		URL:           u,
		Body:          body,
		ContentLength: ln,
	}
	return am.withReq(ctx, req, messageExtractor)
}
