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
	"sync"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/open-feature/go-sdk/openfeature"
	prommodel "github.com/prometheus/common/model"
	"go.yaml.in/yaml/v3"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/api/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	"github.com/grafana/grafana/pkg/setting"
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

	// extraLabelsHeader is the header that specifies extra labels to be added to all imported rules.
	// The value should be comma-separated key=value pairs, e.g., "environment=production,team=alerting".
	extraLabelsHeader = "X-Grafana-Alerting-Extra-Labels"

	// configIdentifierHeader is the header that specifies the identifier for imported Alertmanager config.
	configIdentifierHeader  = "X-Grafana-Alerting-Config-Identifier"
	defaultConfigIdentifier = "imported"
	// configForceReplaceHeader if specified, will forcibly replace existing configuration ignoring same identifier restriction
	configForceReplaceHeader = "X-Grafana-Alerting-Config-Force-Replace"
	// dryRunHeader if specified, will validate the configuration without saving it
	dryRunHeader = "X-Grafana-Alerting-Dry-Run"

	// versionMessageHeader is the header that specifies an optional message for rule versions.
	versionMessageHeader = "X-Grafana-Alerting-Version-Message"
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
	importsAuthz     notifier.ExtraConfigAuthz
	clientGenerator  resource.ClientGenerator

	// Lazy-initialized k8s typed clients, protected by clientsMu. Created on
	// first use when the feature flag is enabled, following the same pattern
	// as K8sRuleSequenceStore.
	clientsMu       sync.Mutex
	alertRuleClient *alertingv0.AlertRuleClient
	recordingClient *alertingv0.RecordingRuleClient
	ruleSeqClient   *alertingv0.RuleSequenceClient
}

type Alertmanager interface {
	DeleteExtraConfiguration(ctx context.Context, org int64, user identity.Requester, authz notifier.ExtraConfigAuthz, identifier string) error
	SaveAndApplyExtraConfiguration(ctx context.Context, org int64, user identity.Requester, authz notifier.ExtraConfigAuthz, extraConfig v1.ExtraConfiguration, replace bool, dryRun bool) (merge.MergeResult, error)
	GetAlertmanagerConfiguration(ctx context.Context, org int64, withAutogen bool) (apimodels.GettableUserConfig, error)
	IsExternalAMSyncConfiguredForOrg(ctx context.Context, orgID int64) (bool, error)
}

func NewConvertPrometheusSrv(
	cfg *setting.UnifiedAlertingSettings,
	logger log.Logger,
	ruleStore RuleStore,
	datasourceCache datasources.CacheService,
	alertRuleService *provisioning.AlertRuleService,
	featureToggles featuremgmt.FeatureToggles,
	am Alertmanager,
	importsAuthz notifier.ExtraConfigAuthz,
	clientGenerator resource.ClientGenerator,
) *ConvertPrometheusSrv {
	return &ConvertPrometheusSrv{
		cfg:              cfg,
		logger:           logger,
		ruleStore:        ruleStore,
		datasourceCache:  datasourceCache,
		alertRuleService: alertRuleService,
		featureToggles:   featureToggles,
		am:               am,
		importsAuthz:     importsAuthz,
		clientGenerator:  clientGenerator,
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
		HasPrometheusRuleDefinition: new(true),
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
		HasPrometheusRuleDefinition: new(true),
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
	filterOpts := &provisioning.FilterOptions{
		NamespaceUIDs:               []string{folder.UID},
		RuleGroups:                  []string{group},
		HasPrometheusRuleDefinition: new(true),
	}
	err = srv.alertRuleService.DeleteRuleGroups(c.Req.Context(), c.SignedInUser, provenance, filterOpts)
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
		HasPrometheusRuleDefinition: new(true),
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
		HasPrometheusRuleDefinition: new(true),
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
		datasourceUID = srv.cfg.PrometheusConversion.DefaultDatasourceUID
	}
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

	versionMessage, err := parseVersionMessageHeader(c)
	if err != nil {
		logger.Error("Failed to parse version message header", "error", err)
		return errorToResponse(err)
	}
	// 2. Resolve folders for every namespace up front (shared by both paths).
	type nsGroups struct {
		folderUID string
		groups    []apimodels.PrometheusRuleGroup
	}
	resolved := make([]nsGroups, 0, len(promNamespaces))
	for ns, rgs := range promNamespaces {
		logger.Debug("Creating a new namespace", "title", ns)
		namespace, errResp := srv.getOrCreateNamespace(c, ns, logger, workingFolderUID)
		if errResp != nil {
			logger.Error("Failed to create a new namespace", "folder_uid", workingFolderUID)
			return errResp
		}
		resolved = append(resolved, nsGroups{folderUID: namespace.UID, groups: rgs})
	}

	// Gate: check recording-rules enablement for every group before doing any work.
	for _, ns := range resolved {
		for _, rg := range ns.groups {
			if promGroupHasRecordingRules(rg) && !srv.cfg.RecordingRules.Enabled {
				logger.Error("Cannot import recording rules", "error", errRecordingRulesNotEnabled)
				return errorToResponse(errRecordingRulesNotEnabled)
			}
		}
	}

	// 3. Branch: k8s path or legacy path.
	useK8s := openfeature.NewDefaultClient().Boolean(
		c.Req.Context(),
		featuremgmt.FlagAlertingConvertPrometheusViaKubernetesAPI,
		false,
		openfeature.TransactionContext(c.Req.Context()),
	)

	if useK8s {
		k8sGroups := make(map[string][]promGroupWithFolder, len(resolved))
		for _, ns := range resolved {
			for _, rg := range ns.groups {
				pg := toPromGroup(rg)
				k8sGroups[ns.folderUID] = append(k8sGroups[ns.folderUID], promGroupWithFolder{
					folderUID: ns.folderUID,
					group:     pg,
				})
			}
		}
		if notificationSettings != nil {
			logger.Warn("Notification settings header is not supported by the Kubernetes conversion path and will be ignored")
		}
		if versionMessage != "" {
			logger.Warn("Version message header is not supported by the Kubernetes conversion path and will be ignored")
		}
		if err := srv.createRulesViaK8sClient(
			c.Req.Context(), c.GetOrgID(), ds, tds,
			k8sGroups, keepOriginalRuleDefinition, provenance,
			pauseAlertRules, pauseRecordingRules, extraLabels,
			logger,
		); err != nil {
			logger.Error("Failed to create rules via k8s client", "error", err)
			return errorToResponse(err)
		}
		return successfulResponse()
	}

	// Legacy path: convert to GMA domain models and persist via provisioning service.
	grafanaGroups := make([]*models.AlertRuleGroup, 0, len(resolved))
	for _, ns := range resolved {
		for _, rg := range ns.groups {
			grafanaGroup, err := srv.convertToGrafanaRuleGroup(
				c,
				ds,
				tds,
				ns.folderUID,
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
	err = srv.alertRuleService.ReplaceRuleGroups(c.Req.Context(), c.SignedInUser, grafanaGroups, provenance, versionMessage)
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

		folderScope := folder.ScopeFoldersProvider.GetResourceScopeUID(ns.UID)
		if c.Permissions[orgID][folder.ActionFoldersRead] == nil {
			c.Permissions[orgID][folder.ActionFoldersRead] = []string{}
		}
		c.Permissions[orgID][folder.ActionFoldersRead] = append(c.Permissions[orgID][folder.ActionFoldersRead], folderScope)
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
	notificationSettings *models.NotificationSettings,
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
			KeepOriginalRuleDefinition: new(keepOriginalRuleDefinition),
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

// toPromGroup converts an API-level PrometheusRuleGroup to the prom package type.
func toPromGroup(rg apimodels.PrometheusRuleGroup) prom.PrometheusRuleGroup {
	rules := make([]prom.PrometheusRule, len(rg.Rules))
	for i, r := range rg.Rules {
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
	return prom.PrometheusRuleGroup{
		Name:        rg.Name,
		Interval:    rg.Interval,
		Rules:       rules,
		QueryOffset: rg.QueryOffset,
		Limit:       rg.Limit,
		Labels:      rg.Labels,
	}
}

// getK8sClients lazily initializes and returns the typed k8s clients for
// AlertRule, RecordingRule, and RuleSequence. Safe for concurrent use.
func (srv *ConvertPrometheusSrv) getK8sClients() (*alertingv0.AlertRuleClient, *alertingv0.RecordingRuleClient, *alertingv0.RuleSequenceClient, error) {
	srv.clientsMu.Lock()
	defer srv.clientsMu.Unlock()
	if srv.alertRuleClient != nil {
		return srv.alertRuleClient, srv.recordingClient, srv.ruleSeqClient, nil
	}
	if srv.clientGenerator == nil {
		return nil, nil, nil, fmt.Errorf("k8s client generator is not available")
	}
	ac, err := alertingv0.NewAlertRuleClientFromGenerator(srv.clientGenerator)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("building alert rule client: %w", err)
	}
	rc, err := alertingv0.NewRecordingRuleClientFromGenerator(srv.clientGenerator)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("building recording rule client: %w", err)
	}
	sc, err := alertingv0.NewRuleSequenceClientFromGenerator(srv.clientGenerator)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("building rule sequence client: %w", err)
	}
	srv.alertRuleClient = ac
	srv.recordingClient = rc
	srv.ruleSeqClient = sc
	return ac, rc, sc, nil
}

// createRulesViaK8sClient converts each Prometheus rule group into k8s-native
// AlertRule / RecordingRule / RuleSequence resources and upserts them through
// the internal k8s API. Groups containing recording rules also get a
// RuleSequence that references all rules in the group.
func (srv *ConvertPrometheusSrv) createRulesViaK8sClient(
	ctx context.Context,
	orgID int64,
	ds *datasources.DataSource,
	tds *datasources.DataSource,
	namespaces map[string][]promGroupWithFolder,
	keepOriginalRuleDefinition bool,
	provenance models.Provenance,
	pauseAlertRules bool,
	pauseRecordingRules bool,
	extraLabels map[string]string,
	logger log.Logger,
) error {
	arClient, rrClient, seqClient, err := srv.getK8sClients()
	if err != nil {
		return err
	}

	k8sNamespace := authlib.OrgNamespaceFormatter(orgID)

	// FromTimeRange and NoDataState/ExecErrState are left at their zero values
	// so withDefaults() applies the same defaults the legacy converter uses
	// (600s, Ok/Ok). If the legacy path ever allows per-request overrides for
	// these, they should be wired through here as well.
	converter, err := prom.NewK8sConverter(prom.K8sConverterConfig{
		DatasourceUID:        ds.UID,
		DatasourceType:       ds.Type,
		TargetDatasourceUID:  tds.UID,
		TargetDatasourceType: tds.Type,
		DefaultInterval:      srv.cfg.DefaultRuleEvaluationInterval,
		EvaluationOffset:     srv.cfg.PrometheusConversion.RuleQueryOffset,
		PauseAlertRules:      pauseAlertRules,
		PauseRecordingRules:  pauseRecordingRules,
		ExtraLabels:          extraLabels,
	})
	if err != nil {
		return fmt.Errorf("creating k8s converter: %w", err)
	}

	var groupErr error
	for _, groups := range namespaces {
		for _, pg := range groups {
			if err := pg.group.Validate(); err != nil {
				groupErr = errors.Join(groupErr, fmt.Errorf("group %q: %w", pg.group.Name, err))
				continue
			}
			if err := srv.upsertGroupViaK8s(
				ctx, converter,
				arClient, rrClient, seqClient,
				k8sNamespace, pg.folderUID, pg.group,
				keepOriginalRuleDefinition, provenance,
				logger,
			); err != nil {
				groupErr = errors.Join(groupErr, fmt.Errorf("group %q: %w", pg.group.Name, err))
			}
		}
	}
	return groupErr
}

// promGroupWithFolder pairs a Prometheus rule group with its resolved folder UID.
type promGroupWithFolder struct {
	folderUID string
	group     prom.PrometheusRuleGroup
}

func (srv *ConvertPrometheusSrv) upsertGroupViaK8s(
	ctx context.Context,
	converter *prom.K8sConverter,
	arClient *alertingv0.AlertRuleClient,
	rrClient *alertingv0.RecordingRuleClient,
	seqClient *alertingv0.RuleSequenceClient,
	k8sNamespace string,
	folderUID string,
	group prom.PrometheusRuleGroup,
	keepOriginalRuleDefinition bool,
	provenance models.Provenance,
	logger log.Logger,
) error {
	// Pre-compute desired names for all rules in the group. This set drives
	// pruning and must reflect the full input regardless of which upserts
	// succeed, so that a transient upsert failure does not cause the prune
	// step to delete a rule that was healthy from a prior import.
	desiredNames := make(map[string]struct{}, len(group.Rules))
	ruleNames := make([]string, len(group.Rules))
	ruleNameErrs := make([]error, len(group.Rules))
	for idx, rule := range group.Rules {
		name, err := prom.RuleName(k8sNamespace, folderUID, group.Name, idx, rule)
		if err != nil {
			ruleNameErrs[idx] = fmt.Errorf("rule at position %d: %w", idx, err)
			continue
		}
		ruleNames[idx] = name
		desiredNames[name] = struct{}{}
	}

	var recordingRuleNames []string
	var alertRuleNames []string
	var upsertErr error

	for idx, rule := range group.Rules {
		name := ruleNames[idx]
		if name == "" {
			upsertErr = errors.Join(upsertErr, ruleNameErrs[idx])
			continue
		}
		ruleYAML := ""
		if keepOriginalRuleDefinition {
			b, err := yaml.Marshal(rule)
			if err != nil {
				return fmt.Errorf("marshalling original rule definition: %w", err)
			}
			ruleYAML = string(b)
		}

		switch {
		case rule.Record != "":
			spec, err := converter.BuildRecordingRuleSpec(group, rule)
			if err != nil {
				upsertErr = errors.Join(upsertErr, fmt.Errorf("building recording rule spec for %q: %w", rule.Record, err))
				continue
			}
			// Mark as converted from Prometheus, matching the legacy converter's behaviour.
			if spec.Labels == nil {
				spec.Labels = make(map[string]alertingv0.RecordingRuleTemplateString, 1)
			}
			spec.Labels[models.ConvertedPrometheusRuleLabel] = "true"
			obj := &alertingv0.RecordingRule{
				TypeMeta: metav1.TypeMeta{
					APIVersion: alertingv0.GroupVersion.Identifier(),
					Kind:       alertingv0.RecordingRuleKind().Kind(),
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: k8sNamespace,
					Annotations: map[string]string{
						alertingv0.FolderAnnotationKey: folderUID,
					},
					Labels: map[string]string{
						prom.GroupNameLabelKey: group.Name,
					},
				},
				Spec: spec,
			}
			setProvenance(obj.Annotations, provenance)
			setOriginalDefinition(obj.Annotations, ruleYAML)
			if err := upsertResource(ctx, rrClient, obj); err != nil {
				upsertErr = errors.Join(upsertErr, err)
				continue
			}
			recordingRuleNames = append(recordingRuleNames, name)

		case rule.Alert != "":
			spec, err := converter.BuildAlertRuleSpec(group, rule)
			if err != nil {
				upsertErr = errors.Join(upsertErr, fmt.Errorf("building alert rule spec for %q: %w", rule.Alert, err))
				continue
			}
			if spec.Labels == nil {
				spec.Labels = make(map[string]alertingv0.AlertRuleTemplateString, 1)
			}
			spec.Labels[models.ConvertedPrometheusRuleLabel] = "true"
			obj := &alertingv0.AlertRule{
				TypeMeta: metav1.TypeMeta{
					APIVersion: alertingv0.GroupVersion.Identifier(),
					Kind:       alertingv0.AlertRuleKind().Kind(),
				},
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: k8sNamespace,
					Annotations: map[string]string{
						alertingv0.FolderAnnotationKey: folderUID,
					},
					Labels: map[string]string{
						prom.GroupNameLabelKey: group.Name,
					},
				},
				Spec: spec,
			}
			setProvenance(obj.Annotations, provenance)
			setOriginalDefinition(obj.Annotations, ruleYAML)
			if err := upsertResource(ctx, arClient, obj); err != nil {
				upsertErr = errors.Join(upsertErr, err)
				continue
			}
			alertRuleNames = append(alertRuleNames, name)

		default:
			logger.Warn("Skipping rule entry with neither alert nor record set", "position", idx)
		}
	}

	// Always prune, even on partial failure, to remove stale resources from
	// previous imports that are no longer in the desired set. This prevents a
	// transient error from leaving dangling resources indefinitely.

	// Create or prune the RuleSequence for this group. A sequence is needed
	// when the group contains recording rules; otherwise any previous sequence
	// for this group must be removed.
	desiredSeqName := ""
	if len(recordingRuleNames) > 0 {
		seqSpec := converter.BuildRuleSequenceSpec(group, recordingRuleNames, alertRuleNames)
		desiredSeqName = prom.SequenceName(k8sNamespace, folderUID, group.Name)
		obj := &alertingv0.RuleSequence{
			TypeMeta: metav1.TypeMeta{
				APIVersion: alertingv0.GroupVersion.Identifier(),
				Kind:       alertingv0.RuleSequenceKind().Kind(),
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:      desiredSeqName,
				Namespace: k8sNamespace,
				Annotations: map[string]string{
					alertingv0.FolderAnnotationKey: folderUID,
				},
				Labels: map[string]string{
					prom.GroupNameLabelKey: group.Name,
				},
			},
			Spec: seqSpec,
		}
		setProvenance(obj.Annotations, provenance)
		if err := upsertResource(ctx, seqClient, obj); err != nil {
			upsertErr = errors.Join(upsertErr, fmt.Errorf("upserting rule sequence: %w", err))
		}
	}
	if err := pruneStaleRuleSequences(ctx, seqClient, k8sNamespace, folderUID, group.Name, desiredSeqName, logger); err != nil {
		upsertErr = errors.Join(upsertErr, fmt.Errorf("pruning stale rule sequences: %w", err))
	}

	// Prune stale rules from previous imports of this group. desiredNames was
	// pre-computed from the full input above, so a transient upsert failure
	// does not cause a healthy rule from a prior import to be deleted.
	if err := pruneStaleAlertRules(ctx, arClient, k8sNamespace, folderUID, group.Name, desiredNames, logger); err != nil {
		upsertErr = errors.Join(upsertErr, fmt.Errorf("pruning stale alert rules: %w", err))
	}
	if err := pruneStaleRecordingRules(ctx, rrClient, k8sNamespace, folderUID, group.Name, desiredNames, logger); err != nil {
		upsertErr = errors.Join(upsertErr, fmt.Errorf("pruning stale recording rules: %w", err))
	}

	return upsertErr
}

func setProvenance(annotations map[string]string, provenance models.Provenance) {
	if provenance != "" {
		annotations[alertingv0.ProvenanceStatusAnnotationKey] = string(provenance)
	}
}

func setOriginalDefinition(annotations map[string]string, ruleYAML string) {
	if ruleYAML != "" {
		annotations[alertingv0.PrometheusRuleDefinitionAnnotationKey] = ruleYAML
	}
}

// upsertMaxRetries is the maximum number of attempts for an upsert operation
// when a conflict (stale ResourceVersion) is encountered.
const upsertMaxRetries = 3

// k8sResource is the minimal interface satisfied by the generated k8s resource
// objects (AlertRule, RecordingRule, RuleSequence) that upsertResource needs.
// GetObjectKind is provided by metav1.TypeMeta and supplies the Kind string
// for error messages.
type k8sResource interface {
	GetName() string
	GetNamespace() string
	GetResourceVersion() string
	SetResourceVersion(string)
	GetObjectKind() schema.ObjectKind
}

// k8sClient is the minimal interface for a typed k8s client that supports
// Get, Create, and Update. All three generated clients satisfy this.
type k8sClient[T k8sResource] interface {
	Get(ctx context.Context, id resource.Identifier) (T, error)
	Create(ctx context.Context, obj T, opts resource.CreateOptions) (T, error)
	Update(ctx context.Context, obj T, opts resource.UpdateOptions) (T, error)
}

// upsertResource performs a Get-then-Create-or-Update with retry on conflict.
// It clears ResourceVersion before Create to avoid issues from prior retry
// iterations that set it during an Update attempt. The Kind for error messages
// is derived from the object's TypeMeta.
func upsertResource[T k8sResource](ctx context.Context, c k8sClient[T], desired T) error {
	kind := desired.GetObjectKind().GroupVersionKind().Kind
	ident := resource.Identifier{Namespace: desired.GetNamespace(), Name: desired.GetName()}
	for attempt := range upsertMaxRetries {
		existing, err := c.Get(ctx, ident)
		if apierrors.IsNotFound(err) {
			desired.SetResourceVersion("") // Clear stale RV from prior retry iterations.
			if _, createErr := c.Create(ctx, desired, resource.CreateOptions{}); createErr != nil {
				// Another writer may have created it between our Get and Create.
				if apierrors.IsAlreadyExists(createErr) && attempt < upsertMaxRetries-1 {
					continue
				}
				return fmt.Errorf("creating %s %q: %w", kind, desired.GetName(), createErr)
			}
			return nil
		}
		if err != nil {
			return fmt.Errorf("fetching %s %q: %w", kind, desired.GetName(), err)
		}
		desired.SetResourceVersion(existing.GetResourceVersion())
		if _, err = c.Update(ctx, desired, resource.UpdateOptions{}); err != nil {
			if apierrors.IsConflict(err) && attempt < upsertMaxRetries-1 {
				continue
			}
			return fmt.Errorf("updating %s %q: %w", kind, desired.GetName(), err)
		}
		return nil
	}
	return fmt.Errorf("%s %q: exceeded %d upsert retries", kind, desired.GetName(), upsertMaxRetries)
}

// groupLabelFilter returns the label selector string for the group-name label.
// Note: the folder UID is stored as an annotation, which cannot be filtered
// server-side via label selectors. The caller must filter by folder client-side.
func groupLabelFilter(groupName string) string {
	return prom.GroupNameLabelKey + "=" + groupName
}

func pruneStaleAlertRules(ctx context.Context, c *alertingv0.AlertRuleClient, namespace, folderUID, groupName string, desired map[string]struct{}, logger log.Logger) error {
	list, err := c.List(ctx, namespace, resource.ListOptions{
		LabelFilters: []string{groupLabelFilter(groupName)},
	})
	if err != nil {
		return fmt.Errorf("listing alert rules for prune: %w", err)
	}
	for _, rule := range list.Items {
		// Skip resources whose folder annotation is missing or belongs to a
		// different folder. A missing annotation means the resource was not
		// created by this code path (or the API returned a partial object);
		// deleting it would be a false positive.
		ruleFolder := rule.Annotations[alertingv0.FolderAnnotationKey]
		if ruleFolder == "" || ruleFolder != folderUID {
			continue
		}
		if _, keep := desired[rule.Name]; keep {
			continue
		}
		logger.Info("Pruning stale alert rule", "name", rule.Name)
		if err := c.Delete(ctx, resource.Identifier{Namespace: namespace, Name: rule.Name}, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("deleting stale alert rule %q: %w", rule.Name, err)
		}
	}
	return nil
}

func pruneStaleRecordingRules(ctx context.Context, c *alertingv0.RecordingRuleClient, namespace, folderUID, groupName string, desired map[string]struct{}, logger log.Logger) error {
	list, err := c.List(ctx, namespace, resource.ListOptions{
		LabelFilters: []string{groupLabelFilter(groupName)},
	})
	if err != nil {
		return fmt.Errorf("listing recording rules for prune: %w", err)
	}
	for _, rule := range list.Items {
		ruleFolder := rule.Annotations[alertingv0.FolderAnnotationKey]
		if ruleFolder == "" || ruleFolder != folderUID {
			continue
		}
		if _, keep := desired[rule.Name]; keep {
			continue
		}
		logger.Info("Pruning stale recording rule", "name", rule.Name)
		if err := c.Delete(ctx, resource.Identifier{Namespace: namespace, Name: rule.Name}, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("deleting stale recording rule %q: %w", rule.Name, err)
		}
	}
	return nil
}

// pruneStaleRuleSequences deletes RuleSequences for this group that are no
// longer needed (e.g. the group no longer contains recording rules). If
// desiredSeqName is empty, all sequences matching the group label are removed.
func pruneStaleRuleSequences(ctx context.Context, c *alertingv0.RuleSequenceClient, namespace, folderUID, groupName, desiredSeqName string, logger log.Logger) error {
	list, err := c.List(ctx, namespace, resource.ListOptions{
		LabelFilters: []string{groupLabelFilter(groupName)},
	})
	if err != nil {
		return fmt.Errorf("listing rule sequences for prune: %w", err)
	}
	for _, seq := range list.Items {
		seqFolder := seq.Annotations[alertingv0.FolderAnnotationKey]
		if seqFolder == "" || seqFolder != folderUID {
			continue
		}
		if seq.Name == desiredSeqName {
			continue
		}
		logger.Info("Pruning stale rule sequence", "name", seq.Name)
		if err := c.Delete(ctx, resource.Identifier{Namespace: namespace, Name: seq.Name}, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("deleting stale rule sequence %q: %w", seq.Name, err)
		}
	}
	return nil
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusPostAlertmanagerConfig(c *contextmodel.ReqContext, amCfg apimodels.AlertmanagerUserConfig) response.Response {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies) ||
		!srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())
	ctx := c.Req.Context()

	// Refuse manual imports when external Alertmanager sync is configured for
	// this org (either via the operator-level ini setting or per-org admin
	// config): the sync worker would overwrite the imported config on its next
	// tick.
	syncConfigured, err := srv.am.IsExternalAMSyncConfiguredForOrg(ctx, c.GetOrgID())
	if err != nil {
		logger.Error("Failed to check external AM sync configuration", "error", err)
		return response.Error(http.StatusInternalServerError, "failed to check external alertmanager sync configuration", err)
	}
	if syncConfigured {
		return response.Error(http.StatusConflict, "alertmanager configuration import is disabled while external alertmanager sync is configured for this organization", nil)
	}

	dryRun, err := parseBooleanHeader(c.Req.Header.Get(dryRunHeader), dryRunHeader)
	if err != nil {
		logger.Error("Failed to parse dry run header", "error", err)
		return errorToResponse(err)
	}

	identifier, err := parseConfigIdentifierHeader(c)
	if err != nil {
		logger.Error("Failed to parse config identifier header", "error", err)
		return errorToResponse(err)
	}

	ec := v1.ExtraConfiguration{
		Identifier:         identifier,
		TemplateFiles:      amCfg.TemplateFiles,
		AlertmanagerConfig: amCfg.AlertmanagerConfig,
	}
	err = ec.Validate()
	if err != nil {
		logger.Error("Invalid alertmanager configuration", "error", err, "identifier", identifier)
		return errorToResponse(err)
	}

	replace, err := parseBooleanHeader(c.Req.Header.Get(configForceReplaceHeader), configForceReplaceHeader)
	if err != nil {
		logger.Error("Failed to parse boolean header", "error", err, "header", configForceReplaceHeader)
		return errorToResponse(err)
	}

	result, err := srv.am.SaveAndApplyExtraConfiguration(c.Req.Context(), c.GetOrgID(), c.SignedInUser, srv.importsAuthz, ec, replace, dryRun)
	if err != nil {
		logger.Error("Failed to save alertmanager configuration", "error", err, "identifier", identifier)
		return errorToResponse(fmt.Errorf("failed to save alertmanager configuration: %w", err))
	}

	apiResp := buildConvertResponse(result)

	if dryRun {
		logger.Info("Dry run: alertmanager configuration validated successfully", "identifier", identifier, "replace", replace)
		return response.JSON(http.StatusOK, apiResp)
	}

	logger.Info("Successfully updated alertmanager configuration with imported Prometheus config", "identifier", identifier, "replace", replace)
	return response.JSON(http.StatusAccepted, apiResp)
}

func buildConvertResponse(result merge.MergeResult) apimodels.ConvertAlertmanagerResponse {
	resp := apimodels.ConvertAlertmanagerResponse{
		Status: "success",
		Stats: &apimodels.MergeStats{
			AddedRoute:           result.AddedRoute,
			AddedReceivers:       result.AddedReceivers,
			AddedTimeIntervals:   result.AddedTimeIntervals,
			AddedTemplates:       result.AddedTemplates,
			AddedInhibitionRules: result.AddedInhibitionRules,
		},
	}
	if len(result.Receivers) > 0 || len(result.TimeIntervals) > 0 {
		resp.RenameResources = &apimodels.RenameResources{
			Receivers:     result.Receivers,
			TimeIntervals: result.TimeIntervals,
		}
	}
	return resp
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusGetAlertmanagerConfig(c *contextmodel.ReqContext) response.Response {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies) ||
		!srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())
	ctx := c.Req.Context()

	identifier, err := parseConfigIdentifierHeader(c)
	if err != nil {
		logger.Error("Failed to parse config identifier header", "error", err)
		return errorToResponse(err)
	}

	cfg, err := srv.am.GetAlertmanagerConfiguration(ctx, c.GetOrgID(), false)
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

	return resp
}

func (srv *ConvertPrometheusSrv) RouteConvertPrometheusDeleteAlertmanagerConfig(c *contextmodel.ReqContext) response.Response {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingMultiplePolicies) ||
		!srv.featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
		return response.Error(http.StatusNotImplemented, "Not Implemented", nil)
	}

	logger := srv.logger.FromContext(c.Req.Context())

	identifier, err := parseConfigIdentifierHeader(c)
	if err != nil {
		logger.Error("Failed to parse config identifier header", "error", err)
		return errorToResponse(err)
	}

	err = srv.am.DeleteExtraConfiguration(c.Req.Context(), c.GetOrgID(), c.SignedInUser, srv.importsAuthz, identifier)
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
	return folder.LegacyRootFolderUID //nolint:staticcheck
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

func parseNotificationSettingsHeader(ctx *contextmodel.ReqContext) (*models.NotificationSettings, error) {
	var notificationSettings *models.NotificationSettings
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

// parseExtraLabelsHeader parses the extra labels header value.
// Expected format: "key1=value1,key2=value2"
func parseExtraLabelsHeader(c *contextmodel.ReqContext) (map[string]string, error) {
	labelsStr := strings.TrimSpace(c.Req.Header.Get(extraLabelsHeader))
	return parseKeyValuePairs(labelsStr, extraLabelsHeader)
}

// parseVersionMessageHeader obtains and validates the message header value.
func parseVersionMessageHeader(c *contextmodel.ReqContext) (string, error) {
	str := strings.TrimSpace(c.Req.Header.Get(versionMessageHeader))
	// Limit message to the same as the dashboards message.
	if len(str) > 500 {
		return "", errInvalidHeaderValue(versionMessageHeader, errors.New("must be less than 500 characters"))
	}
	return str, nil
}

func readConfigIdentifierHeader(c *contextmodel.ReqContext) string {
	if id := strings.TrimSpace(c.Req.Header.Get(configIdentifierHeader)); id != "" {
		return id
	}
	return defaultConfigIdentifier
}

func parseConfigIdentifierHeader(c *contextmodel.ReqContext) (string, error) {
	identifier := readConfigIdentifierHeader(c)
	if errs := k8svalidation.IsDNS1123Subdomain(identifier); len(errs) > 0 {
		return "", errInvalidHeaderValue(configIdentifierHeader, errors.New(strings.Join(errs, ",")))
	}
	if len(identifier) > ualert.UIDMaxLength {
		return "", errInvalidHeaderValue(configIdentifierHeader,
			fmt.Errorf("must be less than %d characters", ualert.UIDMaxLength))
	}
	return identifier, nil
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
