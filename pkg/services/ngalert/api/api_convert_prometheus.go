package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
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
	datasourceUIDHeader        = "X-Grafana-Alerting-Datasource-UID"
	recordingRulesPausedHeader = "X-Grafana-Alerting-Recording-Rules-Paused"
	alertRulesPausedHeader     = "X-Grafana-Alerting-Alert-Rules-Paused"
)

var (
	errDatasourceUIDHeaderMissing = errutil.ValidationFailed(
		"alerting.datasourceUIDHeaderMissing",
		errutil.WithPublicMessage(fmt.Sprintf("Missing datasource UID header: %s", datasourceUIDHeader)),
	).Errorf("missing datasource UID header")

	errInvalidHeaderValueMsg  = "Invalid value for header {{.Public.Header}}: must be 'true' or 'false'"
	errInvalidHeaderValueBase = errutil.ValidationFailed("aleting.invalidHeaderValue").MustTemplate(errInvalidHeaderValueMsg, errutil.WithPublic(errInvalidHeaderValueMsg))
)

func errInvalidHeaderValue(header string) error {
	return errInvalidHeaderValueBase.Build(errutil.TemplateData{Public: map[string]any{"Header": header}})
}

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
	// Just to make the mimirtool rules load work. It first checks if the group exists, and if the endpoint returns 501 it fails.
	return response.YAML(http.StatusOK, apimodels.PrometheusRuleGroup{})
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, promGroup apimodels.PrometheusRuleGroup) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())
	logger = logger.New("folder_title", namespaceTitle, "group", promGroup.Name)

	logger.Info("Converting Prometheus rule group", "rules", len(promGroup.Rules))

	ns, errResp := srv.getOrCreateNamespace(c, namespaceTitle, logger)
	if errResp != nil {
		return errResp
	}

	datasourceUID := strings.TrimSpace(c.Req.Header.Get(datasourceUIDHeader))
	if datasourceUID == "" {
		return response.Err(errDatasourceUIDHeaderMissing)
	}
	ds, err := srv.datasourceCache.GetDatasourceByUID(c.Req.Context(), datasourceUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		logger.Error("Failed to get datasource", "datasource_uid", datasourceUID, "error", err)
		return errorToResponse(err)
	}

	group, err := srv.convertToGrafanaRuleGroup(c, ds, ns.UID, promGroup, logger)
	if err != nil {
		return errorToResponse(err)
	}

	err = srv.alertRuleService.ReplaceRuleGroup(c.Req.Context(), c.SignedInUser, *group, models.ProvenanceConvertedPrometheus)
	if err != nil {
		logger.Error("Failed to replace rule group", "error", err)
		return errorToResponse(err)
	}

	return response.JSON(http.StatusAccepted, map[string]string{"status": "success"})
}

func (srv *ConvertPrometheusSrv) getOrCreateNamespace(c *contextmodel.ReqContext, title string, logger log.Logger) (*folder.Folder, response.Response) {
	logger.Debug("Getting or creating a new folder")

	ns, err := srv.ruleStore.GetOrCreateNamespaceInRootByTitle(
		c.Req.Context(),
		title,
		c.SignedInUser.GetOrgID(),
		c.SignedInUser,
	)
	if err != nil {
		logger.Error("Failed to get or create a new folder", "error", err)
		return nil, toNamespaceErrorResponse(err)
	}

	logger.Debug("Using folder for the converted rules", "folder_uid", ns.UID)

	return ns, nil
}

func (srv *ConvertPrometheusSrv) convertToGrafanaRuleGroup(c *contextmodel.ReqContext, ds *datasources.DataSource, namespaceUID string, promGroup apimodels.PrometheusRuleGroup, logger log.Logger) (*models.AlertRuleGroup, error) {
	logger.Info("Converting Prometheus rules to Grafana rules", "rules", len(promGroup.Rules), "folder_uid", namespaceUID, "datasource_uid", ds.UID, "datasource_type", ds.Type)

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

	pauseRecordingRules, err := parseBooleanHeader(c.Req.Header.Get(recordingRulesPausedHeader), recordingRulesPausedHeader)
	if err != nil {
		return nil, err
	}

	pauseAlertRules, err := parseBooleanHeader(c.Req.Header.Get(alertRulesPausedHeader), alertRulesPausedHeader)
	if err != nil {
		return nil, err
	}

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
		logger.Error("Failed to create Prometheus converter", "datasource_uid", ds.UID, "datasource_type", ds.Type, "error", err)
		return nil, err
	}

	grafanaGroup, err := converter.PrometheusRulesToGrafana(c.SignedInUser.GetOrgID(), namespaceUID, group)
	if err != nil {
		logger.Error("Failed to convert Prometheus rules to Grafana rules", "error", err)
		return nil, err
	}

	return grafanaGroup, nil
}

// parseBooleanHeader parses a boolean header value, returning an error if the header
// is present but invalid. If the header is not present, returns (false, nil).
func parseBooleanHeader(header string, headerName string) (bool, error) {
	if header == "" {
		return false, nil
	}
	val, err := strconv.ParseBool(header)
	if err != nil {
		return false, errInvalidHeaderValue(headerName)
	}
	return val, nil
}
