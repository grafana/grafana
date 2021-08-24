package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"gopkg.in/yaml.v3"
)

const (
	amSilencesPath    = "/alertmanager/api/v2/silences"
	amSilencePath     = "/alertmanager/api/v2/silence/%s"
	amStatusPath      = "/alertmanager/api/v2/status"
	amAlertGroupsPath = "/alertmanager/api/v2/alerts/groups"
	amAlertsPath      = "/alertmanager/api/v2/alerts"
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

func (am *LotexAM) RouteGetAMStatus(ctx *models.ReqContext) response.Response {
	return am.withReq(
		ctx,
		http.MethodGet,
		withPath(
			*ctx.Req.URL,
			amStatusPath,
		),
		nil,
		jsonExtractor(&apimodels.GettableStatus{}),
		nil,
	)
}

func (am *LotexAM) RouteCreateSilence(ctx *models.ReqContext, silenceBody apimodels.PostableSilence) response.Response {
	blob, err := json.Marshal(silenceBody)
	if err != nil {
		return ErrResp(500, err, "Failed marshal silence")
	}
	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amSilencesPath),
		bytes.NewBuffer(blob),
		jsonExtractor(&apimodels.GettableSilence{}),
		map[string]string{"Content-Type": "application/json"},
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
		nil,
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
		nil,
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
		yamlExtractor(&apimodels.GettableUserConfig{}),
		nil,
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
		nil,
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
		nil,
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
		nil,
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
		nil,
	)
}

func (am *LotexAM) RoutePostAlertingConfig(ctx *models.ReqContext, config apimodels.PostableUserConfig) response.Response {
	yml, err := yaml.Marshal(&config)
	if err != nil {
		return ErrResp(500, err, "Failed marshal alert manager configuration ")
	}

	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amConfigPath),
		bytes.NewBuffer(yml),
		messageExtractor,
		nil,
	)
}

func (am *LotexAM) RoutePostAMAlerts(ctx *models.ReqContext, alerts apimodels.PostableAlerts) response.Response {
	yml, err := yaml.Marshal(alerts)
	if err != nil {
		return ErrResp(500, err, "Failed marshal postable alerts")
	}

	return am.withReq(
		ctx,
		http.MethodPost,
		withPath(*ctx.Req.URL, amAlertsPath),
		bytes.NewBuffer(yml),
		messageExtractor,
		nil,
	)
}

func (am *LotexAM) RoutePostTestReceivers(ctx *models.ReqContext, config apimodels.TestReceiversConfigParams) response.Response {
	return NotImplementedResp
}
