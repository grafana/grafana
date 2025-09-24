package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	amconfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	prommodel "github.com/prometheus/common/model"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/api/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// datasourceUIDHeader is the name of the header that specifies the UID of the datasource to be used for the rules.
	datasourceUIDHeader = "X-Grafana-Alerting-Datasource-UID"
	// targetDatasourceUIDHeader is the name of the header that specifies the UID of the target datasource to be used for recording rules.
	targetDatasourceUIDHeader = "X-Grafana-Alerting-Target-Datasource-UID"

	// If the folderUIDHeader is present, namespaces and rule groups will be created in the specified folder.
	// If not, the root folder will be used as the default.
	folderUIDHeader = "X-Grafana-Alerting-Folder-UID"

	// These headers control the paused state of newly created rules. By default, rules are not paused.
	recordingRulesPausedHeader = "X-Grafana-Alerting-Recording-Rules-Paused"
	alertRulesPausedHeader     = "X-Grafana-Alerting-Alert-Rules-Paused"

	// notificationSettingsHeader is the header that specifies the notification settings to be used for the rules.
	// The value should be a JSON-encoded AlertRuleNotificationSettings object.
	notificationSettingsHeader = "X-Grafana-Alerting-Notification-Settings"

	// mergeMatchersHeader is the header that specifies the merge matchers for imported Alertmanager config.
	// The value should be comma-separated key=value pairs, e.g., "environment=production,team=alerting".
	mergeMatchersHeader = "X-Grafana-Alerting-Merge-Matchers"

	// extraLabelsHeader is the header that specifies extra labels to be added to all imported rules.
	// The value should be comma-separated key=value pairs, e.g., "environment=production,team=alerting".
	extraLabelsHeader = "X-Grafana-Alerting-Extra-Labels"

	// configIdentifierHeader is the header that specifies the identifier for imported Alertmanager config.
	configIdentifierHeader  = "X-Grafana-Alerting-Config-Identifier"
	defaultConfigIdentifier = "default"
)

var (
	errDatasourceUIDHeaderMissing = errutil.ValidationFailed(
		"alerting.datasourceUIDHeaderMissing",
		errutil.WithPublicMessage(fmt.Sprintf("Missing datasource UID header: %s", datasourceUIDHeader)),
	).Errorf("missing datasource UID header")

	errInvalidHeaderValueMsg  = "Invalid value for header {{.Public.Header}}: {{.Public.Error}}"
	errInvalidHeaderValueBase = errutil.ValidationFailed("alerting.invalidHeaderValue").MustTemplate(errInvalidHeaderValueMsg, errutil.WithPublic(errInvalidHeaderValueMsg))

	errRecordingRulesNotEnabled = errutil.ValidationFailed(
		"alerting.recordingRulesNotEnabled",
		errutil.WithPublicMessage("Cannot import recording rules: Feature not enabled."),
	).Errorf("recording rules not enabled")
)

func errInvalidHeaderValue(header string, err error) error {
	return errInvalidHeaderValueBase.Build(errutil.TemplateData{Public: map[string]any{"Header": header, "Error": err}})
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
//
// Folder Structure Handling:
// mimirtool does not support nested folder structures, while Grafana allows folder nesting.
// To keep compatibility, this service only returns direct child folders of the working folder
// as namespaces, and rule groups and rules that are directly in these child folders.
//
// For example, given this folder structure in Grafana:
//
//	grafana/
//	├── production/
//	│   ├── service1/
//	│   │   └── alerts/
//	│   └── service2/
//	└── testing/
//	    └── service3/
//
// If the working folder is "grafana":
//   - Only namespaces "production" and "testing" are returned
//   - Only rule groups directly within these folders are included
//
// If the working folder is "production":
//   - Only namespaces "service1" and "service2" are returned
//   - Only rule groups directly within these folders are included
//
// The "working folder" is specified by the X-Grafana-Alerting-Folder-UID header, which can be set to any folder UID,
// and defaults to the root folder if not provided.
type ConvertPrometheusSrv struct {
	cfg              *setting.UnifiedAlertingSettings
	logger           log.Logger
	ruleStore        RuleStore
	datasourceCache  datasources.CacheService
	alertRuleService *provisioning.AlertRuleService
	featureToggles   featuremgmt.FeatureToggles
	am               Alertmanager
}

type Alertmanager interface {
	DeleteExtraConfiguration(ctx context.Context, org int64, identifier string) error
	SaveAndApplyExtraConfiguration(ctx context.Context, org int64, extraConfig apimodels.ExtraConfiguration) error
	GetAlertmanagerConfiguration(ctx context.Context, org int64, withAutogen bool, withMergedExtraConfig bool) (apimodels.GettableUserConfig, error)
}

func NewConvertPrometheusSrv(
	cfg *setting.UnifiedAlertingSettings,
	logger log.Logger,
	ruleStore RuleStore,
	datasourceCache datasources.CacheService,
	alertRuleService *provisioning.AlertRuleService,
	featureToggles featuremgmt.FeatureToggles,
	am Alertmanager,
) *ConvertPrometheusSrv {
	return &ConvertPrometheusSrv{
		cfg:              cfg,
		logger:           logger,
		ruleStore:        ruleStore,
		datasourceCache:  datasourceCache,
		alertRuleService: alertRuleService,
		featureToggles:   featureToggles,
		am:               am,
	}
}

// RouteConvertPrometheusGetRules returns all Grafana-managed alert rules in all namespaces (folders)
// that were imported from a Prometheus-compatible source.
// It responds with JSON or YAML containing a mapping of folders to arrays of Prometheus rule groups.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRules(c *contextmodel.ReqContext) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	folders, err := srv.ruleStore.GetNamespaceChildren(c.Req.Context(), workingFolderUID, c.GetOrgID(), c.SignedInUser)
	if len(folders) == 0 || errors.Is(err, dashboards.ErrFolderNotFound) {
		// If there is no such folder or no children, return empty response
		// because mimirtool expects 200 OK response in this case.
		return convertPrometheusResponse(c, http.StatusOK, map[string][]apimodels.PrometheusRuleGroup{})
	}
	if err != nil {
		logger.Error("Failed to get folders", "error", err)
		return errorToResponse(err)
	}
	folderUIDs := make([]string, 0, len(folders))
	for _, f := range folders {
		folderUIDs = append(folderUIDs, f.UID)
	}

	filterOpts := &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: util.Pointer(true),
		NamespaceUIDs:               folderUIDs,
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

	return convertPrometheusResponse(c, http.StatusOK, namespaces)
}

// RouteConvertPrometheusDeleteNamespace deletes all rule groups that were imported from a Prometheus-compatible source
// within a specified namespace.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	logger.Debug("Looking up folder by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.GetOrgID(), c.SignedInUser, workingFolderUID)
	if err != nil {
		return namespaceErrorResponse(err)
	}
	logger.Info("Deleting all Prometheus-imported rule groups", "folder_uid", namespace.UID, "folder_title", namespaceTitle)

	provenance := getProvenance(c)
	filterOpts := &provisioning.FilterOptions{
		NamespaceUIDs:               []string{namespace.UID},
		HasPrometheusRuleDefinition: util.Pointer(true),
	}
	err = srv.alertRuleService.DeleteRuleGroups(c.Req.Context(), c.SignedInUser, provenance, filterOpts)
	if errors.Is(err, models.ErrAlertRuleGroupNotFound) {
		return response.Empty(http.StatusNotFound)
	}
	if err != nil {
		logger.Error("Failed to delete rule groups", "folder_uid", namespace.UID, "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
}

// RouteConvertPrometheusDeleteRuleGroup deletes a specific rule group if it was imported from a Prometheus-compatible source.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	logger.Debug("Looking up folder by title", "folder_title", namespaceTitle)
	folder, err := srv.ruleStore.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.GetOrgID(), c.SignedInUser, workingFolderUID)
	if err != nil {
		return namespaceErrorResponse(err)
	}
	logger.Info("Deleting Prometheus-imported rule group", "folder_uid", folder.UID, "folder_title", namespaceTitle, "group", group)

	provenance := getProvenance(c)
	err = srv.alertRuleService.DeleteRuleGroup(c.Req.Context(), c.SignedInUser, folder.UID, group, provenance)
	if errors.Is(err, models.ErrAlertRuleGroupNotFound) {
		return response.Empty(http.StatusNotFound)
	}
	if err != nil {
		logger.Error("Failed to delete rule group", "folder_uid", folder.UID, "group", group, "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
}

// RouteConvertPrometheusGetNamespace returns the Grafana-managed alert rules for a specified namespace (folder).
// It responds with JSON or YAML containing a mapping of a single folder to an array of Prometheus rule groups.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetNamespace(c *contextmodel.ReqContext, namespaceTitle string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	logger.Debug("Looking up folder by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.GetOrgID(), c.SignedInUser, workingFolderUID)
	if err != nil {
		logger.Error("Failed to get folder", "error", err)
		return namespaceErrorResponse(err)
	}

	filterOpts := &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: util.Pointer(true),
		NamespaceUIDs:               []string{namespace.UID},
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

	return convertPrometheusResponse(c, http.StatusOK, ns)
}

// RouteConvertPrometheusGetRuleGroup retrieves a single rule group for a given namespace (folder)
// in Prometheus-compatible JSON or YAML format if it was imported from a Prometheus-compatible source.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, group string) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	logger.Debug("Looking up folder by title", "folder_title", namespaceTitle)
	namespace, err := srv.ruleStore.GetNamespaceByTitle(c.Req.Context(), namespaceTitle, c.GetOrgID(), c.SignedInUser, workingFolderUID)
	if err != nil {
		logger.Error("Failed to get folder", "error", err)
		return namespaceErrorResponse(err)
	}
	if namespace == nil {
		return response.Error(http.StatusNotFound, "Folder not found", nil)
	}

	filterOpts := &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: util.Pointer(true),
		NamespaceUIDs:               []string{namespace.UID},
		RuleGroups:                  []string{group},
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

	return convertPrometheusResponse(c, http.StatusOK, promGroup)
}

// RouteConvertPrometheusPostRuleGroup converts a Prometheus rule group into a Grafana rule group
// and creates or updates it within the specified namespace (folder).
//
// If the group already exists and was not imported from a Prometheus-compatible source initially,
// it will not be replaced and an error will be returned.
func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostRuleGroup(c *contextmodel.ReqContext, namespaceTitle string, promGroup apimodels.PrometheusRuleGroup) response.Response {
	return srv.RouteConvertPrometheusPostRuleGroups(c, map[string][]apimodels.PrometheusRuleGroup{namespaceTitle: {promGroup}})
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostRuleGroups(c *contextmodel.ReqContext, promNamespaces map[string][]apimodels.PrometheusRuleGroup) response.Response {
	logger := srv.logger.FromContext(c.Req.Context())

	// 1. Parse the appropriate headers
	workingFolderUID := getWorkingFolderUID(c)
	logger = logger.New("working_folder_uid", workingFolderUID)

	pauseRecordingRules, err := parseBooleanHeader(c.Req.Header.Get(recordingRulesPausedHeader), recordingRulesPausedHeader)
	if err != nil {
		return errorToResponse(err)
	}

	pauseAlertRules, err := parseBooleanHeader(c.Req.Header.Get(alertRulesPausedHeader), alertRulesPausedHeader)
	if err != nil {
		return errorToResponse(err)
	}

	datasourceUID := strings.TrimSpace(c.Req.Header.Get(datasourceUIDHeader))
	if datasourceUID == "" {
		return response.Err(errDatasourceUIDHeaderMissing)
	}
	ds, err := srv.datasourceCache.GetDatasourceByUID(c.Req.Context(), datasourceUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		logger.Error("Failed to get datasource", "datasource_uid", datasourceUID, "error", err)
		return errorToResponse(fmt.Errorf("failed to get datasource: %w", err))
	}

	// By default the target datasource is the same as the query datasource,
	// but if the header "X-Grafana-Alerting-Target-Datasource-UID" is present, we use that instead.
	tds := ds
	if uid := strings.TrimSpace(c.Req.Header.Get(targetDatasourceUIDHeader)); uid != "" {
		tds, err = srv.datasourceCache.GetDatasourceByUID(c.Req.Context(), uid, c.SignedInUser, c.SkipDSCache)
		if err != nil {
			logger.Error("Failed to get target datasource for recording rules", "datasource_uid", uid, "error", err)
			return errorToResponse(fmt.Errorf("failed to get recording rules target datasource: %w", err))
		}
	}

	provenance := getProvenance(c)

	// If the provenance is not ConvertedPrometheus, we don't keep the original rule definition.
	// This is because the rules can be modified through the UI, which may break compatibility
	// with the Prometheus format. We only preserve the original rule definition
	// to ensure we can return them in this API in Prometheus format.
	keepOriginalRuleDefinition := provenance == models.ProvenanceConvertedPrometheus

	notificationSettings, err := parseNotificationSettingsHeader(c)
	if err != nil {
		logger.Error("Failed to parse notification settings header", "error", err)
		return errorToResponse(err)
	}

	extraLabels, err := parseExtraLabelsHeader(c)
	if err != nil {
		logger.Error("Failed to parse extra labels header", "error", err)
		return errorToResponse(err)
	}

	// 2. Convert Prometheus Rules to GMA
	grafanaGroups := make([]*models.AlertRuleGroup, 0, len(promNamespaces))
	for ns, rgs := range promNamespaces {
		logger.Debug("Creating a new namespace", "title", ns)
		namespace, errResp := srv.getOrCreateNamespace(c, ns, logger, workingFolderUID)
		if errResp != nil {
			logger.Error("Failed to create a new namespace", "folder_uid", workingFolderUID)
			return errResp
		}

		for _, rg := range rgs {
			// If we're importing recording rules, we can only import them if the feature is enabled,
			// and the feature flag that enables configuring target datasources per-rule is also enabled.
			if promGroupHasRecordingRules(rg) {
				if !srv.cfg.RecordingRules.Enabled {
					logger.Error("Cannot import recording rules", "error", errRecordingRulesNotEnabled)
					return errorToResponse(errRecordingRulesNotEnabled)
				}
			}

			grafanaGroup, err := srv.convertToGrafanaRuleGroup(
				c,
				ds,
				tds,
				namespace.UID,
				rg,
				pauseRecordingRules,
				pauseAlertRules,
				keepOriginalRuleDefinition,
				notificationSettings,
				extraLabels,
				logger,
			)
			if err != nil {
				logger.Error("Failed to convert Prometheus rules to Grafana rules", "error", err)
				return errorToResponse(err)
			}
			grafanaGroups = append(grafanaGroups, grafanaGroup)
		}
	}

	// 3. Update the GMA Rules in the DB
	err = srv.alertRuleService.ReplaceRuleGroups(c.Req.Context(), c.SignedInUser, grafanaGroups, provenance)
	if err != nil {
		logger.Error("Failed to replace rule groups", "error", err)
		return errorToResponse(err)
	}

	return successfulResponse()
}

func (srv *ConvertPrometheusSrv) getOrCreateNamespace(c *contextmodel.ReqContext, title string, logger log.Logger, workingFolderUID string) (*folder.FolderReference, response.Response) {
	logger.Debug("Getting or creating a new folder")

	ns, created, err := srv.ruleStore.GetOrCreateNamespaceByTitle(
		c.Req.Context(),
		title,
		c.GetOrgID(),
		c.SignedInUser,
		workingFolderUID,
	)
	if err != nil {
		logger.Error("Failed to get or create a new folder", "error", err)
		return nil, namespaceErrorResponse(err)
	}

	// Not all users have global-scoped permissions, even if they can create folders.
	// For example, Editor users can create folders, but they have UID-scoped folder permissions.
	// Permissions are populated in a middleware before this handler, and the folder we just created
	// is not included in the permissions yet. We add it manually.
	if created {
		orgID := c.GetOrgID()
		if c.Permissions == nil {
			c.Permissions = make(map[int64]map[string][]string)
		}
		if c.Permissions[orgID] == nil {
			c.Permissions[orgID] = make(map[string][]string)
		}

		folderScope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(ns.UID)
		if c.Permissions[orgID][dashboards.ActionFoldersRead] == nil {
			c.Permissions[orgID][dashboards.ActionFoldersRead] = []string{}
		}
		c.Permissions[orgID][dashboards.ActionFoldersRead] = append(c.Permissions[orgID][dashboards.ActionFoldersRead], folderScope)
	}

	logger.Debug("Using folder for the converted rules", "folder_uid", ns.UID)

	return ns, nil
}

func (srv *ConvertPrometheusSrv) convertToGrafanaRuleGroup(
	c *contextmodel.ReqContext,
	ds *datasources.DataSource,
	tds *datasources.DataSource,
	namespaceUID string,
	promGroup apimodels.PrometheusRuleGroup,
	pauseRecordingRules bool,
	pauseAlertRules bool,
	keepOriginalRuleDefinition bool,
	notificationSettings []models.NotificationSettings,
	extraLabels map[string]string,
	logger log.Logger,
) (*models.AlertRuleGroup, error) {
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
		Name:        promGroup.Name,
		Interval:    promGroup.Interval,
		Rules:       rules,
		QueryOffset: promGroup.QueryOffset,
		Limit:       promGroup.Limit,
		Labels:      promGroup.Labels,
	}

	converter, err := prom.NewConverter(
		prom.Config{
			DatasourceUID:        ds.UID,
			DatasourceType:       ds.Type,
			TargetDatasourceUID:  tds.UID,
			TargetDatasourceType: tds.Type,
			DefaultInterval:      srv.cfg.DefaultRuleEvaluationInterval,
			RecordingRules: prom.RulesConfig{
				IsPaused: pauseRecordingRules,
			},
			AlertRules: prom.RulesConfig{
				IsPaused: pauseAlertRules,
			},
			KeepOriginalRuleDefinition: util.Pointer(keepOriginalRuleDefinition),
			EvaluationOffset:           &srv.cfg.PrometheusConversion.RuleQueryOffset,
			NotificationSettings:       notificationSettings,
			ExtraLabels:                extraLabels,
		},
	)
	if err != nil {
		logger.Error("Failed to create Prometheus converter", "datasource_uid", ds.UID, "datasource_type", ds.Type, "error", err)
		return nil, err
	}

	grafanaGroup, err := converter.PrometheusRulesToGrafana(c.GetOrgID(), namespaceUID, group)
	if err != nil {
		logger.Error("Failed to convert Prometheus rules to Grafana rules", "error", err)
		return nil, err
	}

	return grafanaGroup, nil
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostAlertmanagerConfig(c *contextmodel.ReqContext, amCfg apimodels.AlertmanagerUserConfig) response.Response {
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())

	identifier := parseConfigIdentifierHeader(c)

	mergeMatchers, err := parseMergeMatchersHeader(c)
	if err != nil {
		logger.Error("Failed to parse merge matchers header", "error", err, "identifier", identifier)
		return errorToResponse(err)
	}

	ec := apimodels.ExtraConfiguration{
		Identifier:         identifier,
		MergeMatchers:      mergeMatchers,
		TemplateFiles:      amCfg.TemplateFiles,
		AlertmanagerConfig: amCfg.AlertmanagerConfig,
	}
	err = ec.Validate()
	if err != nil {
		logger.Error("Invalid alertmanager configuration", "error", err, "identifier", identifier)
		return errorToResponse(err)
	}

	err = srv.am.SaveAndApplyExtraConfiguration(c.Req.Context(), c.GetOrgID(), ec)
	if err != nil {
		logger.Error("Failed to save alertmanager configuration", "error", err, "identifier", identifier)
		return errorToResponse(fmt.Errorf("failed to save alertmanager configuration: %w", err))
	}

	logger.Info("Successfully updated alertmanager configuration with imported Prometheus config", "identifier", identifier)
	return successfulResponse()
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetAlertmanagerConfig(c *contextmodel.ReqContext) response.Response {
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())
	ctx := c.Req.Context()

	identifier := parseConfigIdentifierHeader(c)

	cfg, err := srv.am.GetAlertmanagerConfiguration(ctx, c.GetOrgID(), false, false)
	if err != nil {
		logger.Error("failed to get alertmanager configuration", "err", err)
		return errorToResponse(err)
	}

	var extraCfg *apimodels.ExtraConfiguration
	for i := range cfg.ExtraConfigs {
		if cfg.ExtraConfigs[i].Identifier == identifier {
			extraCfg = &cfg.ExtraConfigs[i]
			break
		}
	}

	if extraCfg == nil {
		return response.Error(http.StatusNotFound, "Alertmanager configuration not found", nil)
	}

	sanitizedConfig, err := extraCfg.GetSanitizedAlertmanagerConfigYAML()
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid Alertmanager configuration format", err)
	}

	respBody := apimodels.AlertmanagerUserConfig{
		AlertmanagerConfig: sanitizedConfig,
		TemplateFiles:      extraCfg.TemplateFiles,
	}

	resp := convertPrometheusResponse(c, http.StatusOK, respBody)
	resp.SetHeader(configIdentifierHeader, extraCfg.Identifier)
	resp.SetHeader(mergeMatchersHeader, formatMergeMatchers(extraCfg.MergeMatchers))

	return resp
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteAlertmanagerConfig(c *contextmodel.ReqContext) response.Response {
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())

	identifier := parseConfigIdentifierHeader(c)

	err := srv.am.DeleteExtraConfiguration(c.Req.Context(), c.GetOrgID(), identifier)
	if err != nil {
		logger.Error("Failed to delete alertmanager configuration", "error", err, "identifier", identifier)
		return errorToResponse(fmt.Errorf("failed to delete alertmanager configuration: %w", err))
	}

	logger.Info("Successfully deleted extra alertmanager configuration", "identifier", identifier)
	return successfulResponse()
}

// parseBooleanHeader parses a boolean header value, returning an error if the header
// is present but invalid. If the header is not present, returns (false, nil).
func parseBooleanHeader(header string, headerName string) (bool, error) {
	if header == "" {
		return false, nil
	}
	val, err := strconv.ParseBool(header)
	if err != nil {
		return false, errInvalidHeaderValue(headerName, errors.New("must be 'true' or 'false'"))
	}
	return val, nil
}

func grafanaNamespacesToPrometheus(groups []models.AlertRuleGroupWithFolderFullpath) (map[string][]apimodels.PrometheusRuleGroup, error) {
	result := map[string][]apimodels.PrometheusRuleGroup{}

	for _, group := range groups {
		// Since the folder can be nested but mimirtool does not support nested paths,
		// we need to use only the last folder in the full path.
		// For example, if the current working folder is "general" and the full path is "grafana/some folder/general/production",
		// we should use the "production" folder.
		folder := filepath.Base(group.FolderFullpath)

		promGroup, err := grafanaRuleGroupToPrometheus(group.Title, group.Rules)
		if err != nil {
			return nil, err
		}
		result[folder] = append(result[folder], promGroup)
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
		promDefinition, err := rule.PrometheusRuleDefinition()
		if err != nil {
			return apimodels.PrometheusRuleGroup{}, fmt.Errorf("failed to get the Prometheus definition of the rule with UID %s: %w", rule.UID, err)
		}
		var r apimodels.PrometheusRule
		if err := yaml.Unmarshal([]byte(promDefinition), &r); err != nil {
			return apimodels.PrometheusRuleGroup{}, fmt.Errorf("failed to unmarshal Prometheus rule definition of the rule with UID %s: %w", rule.UID, err)
		}
		promGroup.Rules[i] = r
	}

	return promGroup, nil
}

func successfulResponse() response.Response {
	return response.JSON(http.StatusAccepted, apimodels.ConvertPrometheusResponse{
		Status: "success",
	})
}

// getWorkingFolderUID returns the value of the folderUIDHeader
// if present. Otherwise, it returns the UID of the root folder.
func getWorkingFolderUID(c *contextmodel.ReqContext) string {
	folderUID := strings.TrimSpace(c.Req.Header.Get(folderUIDHeader))
	if folderUID != "" {
		return folderUID
	}
	return folder.RootFolderUID
}

func namespaceErrorResponse(err error) response.Response {
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.Empty(http.StatusNotFound)
	}

	return toNamespaceErrorResponse(err)
}

func promGroupHasRecordingRules(promGroup apimodels.PrometheusRuleGroup) bool {
	for _, rule := range promGroup.Rules {
		if rule.Record != "" {
			return true
		}
	}
	return false
}

// getProvenance determines the provenance value to use for rules created via the Prometheus conversion API.
// If the X-Disable-Provenance header is present in the request, returns ProvenanceNone,
// otherwise returns ProvenanceConvertedPrometheus.
func getProvenance(ctx *contextmodel.ReqContext) models.Provenance {
	if _, disabled := ctx.Req.Header[disableProvenanceHeaderName]; disabled {
		return models.ProvenanceNone
	}
	return models.ProvenanceConvertedPrometheus
}

func parseNotificationSettingsHeader(ctx *contextmodel.ReqContext) ([]models.NotificationSettings, error) {
	var notificationSettings []models.NotificationSettings
	notificationSettingsJSON := ctx.Req.Header.Get(notificationSettingsHeader)

	if notificationSettingsJSON != "" {
		var settings apimodels.AlertRuleNotificationSettings
		var err error

		if err := json.Unmarshal([]byte(notificationSettingsJSON), &settings); err != nil {
			return nil, errInvalidHeaderValue(notificationSettingsHeader, errors.New("invalid JSON"))
		}
		notificationSettings, err = validation.ValidateNotificationSettings(&settings)
		if err != nil {
			return nil, errInvalidHeaderValue(notificationSettingsHeader, err)
		}
	}

	return notificationSettings, nil
}

// parseKeyValuePairs parses a comma-separated list of key=value pairs.
// Expected format: "key1=value1,key2=value2"
func parseKeyValuePairs(input string, headerName string) (map[string]string, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, nil
	}

	result := make(map[string]string)

	for pair := range strings.SplitSeq(input, ",") {
		parts := strings.SplitN(strings.TrimSpace(pair), "=", 2)
		if len(parts) != 2 {
			return nil, errInvalidHeaderValue(headerName, errors.New("format should be 'key=value,key2=value2'"))
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		if key == "" || value == "" {
			return nil, errInvalidHeaderValue(headerName, errors.New("keys and values cannot be empty"))
		}

		result[key] = value
	}

	return result, nil
}

// parseMergeMatchersHeader parses the merge matchers header value.
// Expected format: "key1=value1,key2=value2"
func parseMergeMatchersHeader(c *contextmodel.ReqContext) (amconfig.Matchers, error) {
	matchersStr := strings.TrimSpace(c.Req.Header.Get(mergeMatchersHeader))

	if matchersStr == "" {
		return amconfig.Matchers{}, errInvalidHeaderValue(mergeMatchersHeader, errors.New("value cannot be empty"))
	}

	kvPairs, err := parseKeyValuePairs(matchersStr, mergeMatchersHeader)
	if err != nil {
		return nil, err
	}

	matchers := amconfig.Matchers{}
	for key, value := range kvPairs {
		matchers = append(matchers, &labels.Matcher{
			Type:  labels.MatchEqual,
			Name:  key,
			Value: value,
		})
	}

	return matchers, nil
}

// parseExtraLabelsHeader parses the extra labels header value.
// Expected format: "key1=value1,key2=value2"
func parseExtraLabelsHeader(c *contextmodel.ReqContext) (map[string]string, error) {
	labelsStr := strings.TrimSpace(c.Req.Header.Get(extraLabelsHeader))
	return parseKeyValuePairs(labelsStr, extraLabelsHeader)
}

func formatMergeMatchers(matchers amconfig.Matchers) string {
	var pairs []string
	for _, matcher := range matchers {
		if matcher.Type == labels.MatchEqual {
			pairs = append(pairs, fmt.Sprintf("%s=%s", matcher.Name, matcher.Value))
		}
	}
	return strings.Join(pairs, ",")
}

func parseConfigIdentifierHeader(c *contextmodel.ReqContext) string {
	identifier := strings.TrimSpace(c.Req.Header.Get(configIdentifierHeader))
	if identifier == "" {
		return defaultConfigIdentifier
	}
	return identifier
}

// convertPrometheusResponse returns a JSON or YAML response based on the Accept header.
// Default is YAML for backward compatibility with mimirtool.
func convertPrometheusResponse(c *contextmodel.ReqContext, status int, body interface{}) *response.NormalResponse {
	acceptHeader := c.Req.Header.Get("Accept")

	for _, accept := range strings.Split(acceptHeader, ",") {
		mediaType, _, err := mime.ParseMediaType(accept)
		if err != nil {
			continue
		}

		if mediaType == "application/json" {
			return response.JSON(status, body)
		}
	}

	return response.YAML(status, body)
}
