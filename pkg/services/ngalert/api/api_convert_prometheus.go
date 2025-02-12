package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	datasourceUIDHeader        = "X-Datasource-UID"
	recordingRulesPausedHeader = "X-Recording-Rules-Paused"
	alertRulesPausedHeader     = "X-Alert-Rules-Paused"
)

type ConvertPrometheusSrv struct {
	cfg              *setting.UnifiedAlertingSettings
	logger           log.Logger
	ruleStore        RuleStore
	datasourceCache  datasources.CacheService
	alertRuleService *provisioning.AlertRuleService
}

func NewConvertPrometheusSrv(cfg *setting.UnifiedAlertingSettings, logger log.Logger, ruleStore RuleStore, datasourceCache datasources.CacheService, alertRuleService *provisioning.AlertRuleService) *ConvertPrometheusSrv {
	return &ConvertPrometheusSrv{
		cfg:              cfg,
		logger:           logger,
		ruleStore:        ruleStore,
		datasourceCache:  datasourceCache,
		alertRuleService: alertRuleService,
	}
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRules(c *contextmodel.ReqContext) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	return response.Error(501, "Not implemented", nil)
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	return response.YAML(http.StatusOK, apimodels.PrometheusRuleGroup{})
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, promGroup apimodels.PrometheusRuleGroup) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	logger.Debug("Received request to convert Prometheus rule group", "namespace", namespaceTitle, "group", promGroup.Name)

	ns, errResp := srv.getOrCreateNamespace(c, namespaceTitle, logger)
	if errResp != nil {
		return errResp
	}

	logger.Debug("Found folder", "folder", ns.Title, "folder_uid", ns.UID)

	datasourceUID := strings.TrimSpace(c.Req.Header.Get(datasourceUIDHeader))
	if datasourceUID == "" {
		return response.Error(http.StatusBadRequest, fmt.Sprintf("Missing datasource UID header: %s", datasourceUIDHeader), nil)
	}
	ds, err := srv.datasourceCache.GetDatasourceByUID(c.Req.Context(), datasourceUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		logger.Error("Failed to get datasource", "error", err)
		return errorToResponse(err)
	}

	group, err := srv.convertToGrafanaRuleGroup(c, ds, ns.UID, promGroup, logger)
	if err != nil {
		return errorToResponse(err)
	}

	err = srv.alertRuleService.ReplaceRuleGroup(c.Req.Context(), c.SignedInUser, *group, models.ProvenanceConvertedPrometheus)
	if err != nil {
		srv.logger.Error("Failed to replace rule group", "error", err)
		return errorToResponse(err)
	}

	return response.JSON(http.StatusAccepted, map[string]string{"status": "success"})
}

func (srv *ConvertPrometheusSrv) getOrCreateNamespace(c *contextmodel.ReqContext, title string, logger log.Logger) (*folder.Folder, response.Response) {
	logger.Debug("Getting or creating a new namespace", "title", title)
	ns, err := srv.ruleStore.GetOrCreateNamespaceInRootByTitle(
		c.Req.Context(),
		title,
		c.SignedInUser.GetOrgID(),
		c.SignedInUser,
	)
	if err != nil {
		logger.Error("Failed to get or create a new namespace", "error", err)
		return nil, toNamespaceErrorResponse(err)
	}
	return ns, nil
}

func (srv *ConvertPrometheusSrv) convertToGrafanaRuleGroup(c *contextmodel.ReqContext, ds *datasources.DataSource, namespaceUID string, promGroup apimodels.PrometheusRuleGroup, logger log.Logger) (*models.AlertRuleGroup, error) {
	logger.Debug("Converting Prometheus rules to Grafana rules", "group", promGroup.Name, "rules", len(promGroup.Rules))

	rules := make([]prom.PrometheusRule, len(promGroup.Rules))
	for i, r := range promGroup.Rules {
		rules[i] = prom.PrometheusRule{
			Alert:         r.Alert,
			Expr:          r.Expr,
			For:           r.For,
			KeepFiringFor: r.KeepFiringFor,
			Labels:        r.Labels,
			Annotations:   r.Annotations,
			Record:        r.Record,
		}
	}
	group := prom.PrometheusRuleGroup{
		Name:     promGroup.Name,
		Interval: promGroup.Interval,
		Rules:    rules,
	}

	pauseRecordingRules, _ := strconv.ParseBool(c.Req.Header.Get(recordingRulesPausedHeader))
	pauseAlertRules, _ := strconv.ParseBool(c.Req.Header.Get(alertRulesPausedHeader))

	converter, err := prom.NewConverter(
		prom.Config{
			DatasourceUID:   ds.UID,
			DatasourceType:  ds.Type,
			DefaultInterval: srv.cfg.DefaultRuleEvaluationInterval,
			RecordingRules: prom.RulesConfig{
				IsPaused: pauseRecordingRules,
			},
			AlertRules: prom.RulesConfig{
				IsPaused: pauseAlertRules,
			},
		},
	)
	if err != nil {
		logger.Error("Failed to create Prometheus converter", "error", err)
		return nil, err
	}

	grafanaGroup, err := converter.PrometheusRulesToGrafana(c.SignedInUser.GetOrgID(), namespaceUID, group)
	if err != nil {
		logger.Error("Failed to convert Prometheus rules to Grafana rules", "error", err)
		return nil, err
	}

	return grafanaGroup, nil
}
