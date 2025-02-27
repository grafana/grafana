package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	prommodel "github.com/prometheus/common/model"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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

// ConvertPrometheusSrv converts Prometheus rules to Grafana rules
// and retrieves them in a Prometheus-compatible format.
//
// It is designed to support mimirtool integration, so that rules that work with Mimir
// can be imported into Grafana. It works similarly to the provisioning API,
// where once a rule group is created, it is marked as "provisioned" (via provenance mechanism)
// and is not editable in the UI.
//
// This service returns only rule groups that were initially imported from Prometheus-compatible sources.
// Rule groups not imported from Prometheus are excluded because their original rule definitions are unavailable.
// When a rule group is converted from Prometheus to Grafana, the original definition is preserved alongside
// the Grafana rule and used for reading requests here.
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

// RouteConvertPrometheusGetRules returns all Grafana-managed alert rules in all namespaces (folders)
// that were imported from a Prometheus-compatible source.
// It responds with a YAML containing a mapping of folders to arrays of Prometheus rule groups.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRules(c *contextmodel.ReqContext) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	filterOpts := &provisioning.FilterOptions{
		ImportedPrometheusRule: util.Pointer(true),
	}
	groups, err := srv.alertRuleService.GetAlertGroupsWithFolderFullpath(c.Req.Context(), c.SignedInUser, filterOpts)
	if err != nil {
		logger.Error("Failed to get alert groups", "error", err)
		return errorToResponse(err)
	}

	namespaces, err := grafanaNamespacesToPrometheus(groups)
	if err != nil {
		logger.Error("Failed to convert Grafana rules to Prometheus format", "error", err)
		return errorToResponse(err)
	}

	return response.YAML(http.StatusOK, namespaces)
}

// RouteConvertPrometheusDeleteNamespace deletes all rule groups that were imported from a Prometheus-compatible source
// within a specified namespace.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	logger.Debug("Looking up folder in the root by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceInRootByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return namespaceErrorResponse(err)
	}
	logger.Info("Deleting all Prometheus-imported rule groups", "folder_uid", namespace.UID, "folder_title", namespaceTitle)

	filterOpts := &provisioning.FilterOptions{
		NamespaceUIDs:          []string{namespace.UID},
		ImportedPrometheusRule: util.Pointer(true),
	}
	err = srv.alertRuleService.DeleteRuleGroups(c.Req.Context(), c.SignedInUser, models.ProvenanceConvertedPrometheus, filterOpts)
	if err != nil {
		logger.Error("Failed to delete rule groups", "folder_uid", namespace.UID, "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
}

// RouteConvertPrometheusDeleteRuleGroup deletes a specific rule group if it was imported from a Prometheus-compatible source.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	logger.Debug("Looking up folder in the root by title", "folder_title", namespaceTitle)
	folder, err := srv.ruleStore.GetNamespaceInRootByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		return namespaceErrorResponse(err)
	}
	logger.Info("Deleting Prometheus-imported rule group", "folder_uid", folder.UID, "folder_title", namespaceTitle, "group", group)

	err = srv.alertRuleService.DeleteRuleGroup(c.Req.Context(), c.SignedInUser, folder.UID, group, models.ProvenanceConvertedPrometheus)
	if err != nil {
		logger.Error("Failed to delete rule group", "folder_uid", folder.UID, "group", group, "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
}

// RouteConvertPrometheusGetNamespace returns the Grafana-managed alert rules for a specified namespace (folder).
// It responds with a YAML containing a mapping of a single folder to an array of Prometheus rule groups.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	logger.Debug("Looking up folder in the root by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceInRootByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		logger.Error("Failed to get folder", "error", err)
		return namespaceErrorResponse(err)
	}

	filterOpts := &provisioning.FilterOptions{
		ImportedPrometheusRule: util.Pointer(true),
		NamespaceUIDs:          []string{namespace.UID},
	}
	groups, err := srv.alertRuleService.GetAlertGroupsWithFolderFullpath(c.Req.Context(), c.SignedInUser, filterOpts)
	if err != nil {
		logger.Error("Failed to get alert groups", "error", err)
		return errorToResponse(err)
	}

	ns, err := grafanaNamespacesToPrometheus(groups)
	if err != nil {
		logger.Error("Failed to convert Grafana rules to Prometheus format", "error", err)
		return errorToResponse(err)
	}

	return response.YAML(http.StatusOK, ns)
}

// RouteConvertPrometheusGetRuleGroup retrieves a single rule group for a given namespace (folder)
// in Prometheus-compatible YAML format if it was imported from a Prometheus-compatible source.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	logger.Debug("Looking up folder in the root by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceInRootByTitle(c.Req.Context(), namespaceTitle, c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		logger.Error("Failed to get folder", "error", err)
		return namespaceErrorResponse(err)
	}

	filterOpts := &provisioning.FilterOptions{
		ImportedPrometheusRule: util.Pointer(true),
		NamespaceUIDs:          []string{namespace.UID},
		RuleGroups:             []string{group},
	}
	groupsWithFolders, err := srv.alertRuleService.GetAlertGroupsWithFolderFullpath(c.Req.Context(), c.SignedInUser, filterOpts)
	if err != nil {
		logger.Error("Failed to get alert group", "error", err)
		return errorToResponse(err)
	}
	if len(groupsWithFolders) == 0 {
		return response.Error(http.StatusNotFound, "Rule group not found", nil)
	}
	if len(groupsWithFolders) > 1 {
		logger.Error("Multiple rule groups found when only one was expected", "folder_title", namespaceTitle, "group", group)
		// It shouldn't happen, but if we get more than 1 group, we return an error.
		return response.Error(http.StatusInternalServerError, "Multiple rule groups found", nil)
	}

	promGroup, err := grafanaRuleGroupToPrometheus(groupsWithFolders[0].Title, groupsWithFolders[0].Rules)
	if err != nil {
		logger.Error("Failed to convert Grafana rule to Prometheus format", "error", err)
		return errorToResponse(err)
	}

	return response.YAML(http.StatusOK, promGroup)
}

// RouteConvertPrometheusPostRuleGroup converts a Prometheus rule group into a Grafana rule group
// and creates or updates it within the specified namespace (folder).
//
// If the group already exists and was not imported from a Prometheus-compatible source initially,
// it will not be replaced and an error will be returned.
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
		logger.Error("Failed to convert Prometheus rules to Grafana rules", "error", err)
		return errorToResponse(err)
	}

	err = srv.alertRuleService.ReplaceRuleGroup(c.Req.Context(), c.SignedInUser, *group, models.ProvenanceConvertedPrometheus)
	if err != nil {
		logger.Error("Failed to replace rule group", "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
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

func grafanaNamespacesToPrometheus(groups []models.AlertRuleGroupWithFolderFullpath) (map[string][]apimodels.PrometheusRuleGroup, error) {
	result := map[string][]apimodels.PrometheusRuleGroup{}

	for _, group := range groups {
		promGroup, err := grafanaRuleGroupToPrometheus(group.Title, group.Rules)
		if err != nil {
			return nil, err
		}
		result[group.FolderFullpath] = append(result[group.FolderFullpath], promGroup)
	}

	return result, nil
}

func grafanaRuleGroupToPrometheus(group string, rules []models.AlertRule) (apimodels.PrometheusRuleGroup, error) {
	if len(rules) == 0 {
		return apimodels.PrometheusRuleGroup{}, nil
	}

	interval := time.Duration(rules[0].IntervalSeconds) * time.Second
	promGroup := apimodels.PrometheusRuleGroup{
		Name:     group,
		Interval: prommodel.Duration(interval),
		Rules:    make([]apimodels.PrometheusRule, len(rules)),
	}

	for i, rule := range rules {
		promDefinition := rule.PrometheusRuleDefinition()
		if promDefinition == "" {
			return apimodels.PrometheusRuleGroup{}, fmt.Errorf("failed to get the Prometheus definition of the rule with UID %s", rule.UID)
		}
		var r apimodels.PrometheusRule
		if err := yaml.Unmarshal([]byte(promDefinition), &r); err != nil {
			return apimodels.PrometheusRuleGroup{}, fmt.Errorf("failed to unmarshal Prometheus rule definition of the rule with UID %s: %w", rule.UID, err)
		}
		promGroup.Rules[i] = r
	}

	return promGroup, nil
}

func namespaceErrorResponse(err error) response.Response {
	if errors.Is(err, dashboards.ErrFolderAccessDenied) {
		// If there is no such folder, the error is ErrFolderAccessDenied.
		// We should return 404 in this case, otherwise mimirtool does not work correctly.
		return response.Empty(http.StatusNotFound)
	}

	return toNamespaceErrorResponse(err)
}

func successfulResponse() response.Response {
	return response.JSON(http.StatusAccepted, apimodels.ConvertPrometheusResponse{
		Status: "success",
	})
}
