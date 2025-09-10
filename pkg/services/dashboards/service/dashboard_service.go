package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardclient "github.com/grafana/grafana/pkg/services/dashboards/service/client"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/retryer"
)

var (
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService             = (*DashboardServiceImpl)(nil)
	_ dashboards.DashboardProvisioningService = (*DashboardServiceImpl)(nil)
	_ dashboards.PluginService                = (*DashboardServiceImpl)(nil)

	daysInTrash = 24 * 30 * time.Hour
	tracer      = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards/service")
)

const (
	k8sDashboardKvNamespace              = "dashboard-cleanup"
	k8sDashboardKvLastResourceVersionKey = "last-resource-version"
	provisioningConcurrencyLimit         = 10
	listAllDashboardsLimit               = 100000
)

type DashboardServiceImpl struct {
	cfg                    *setting.Cfg
	log                    log.Logger
	dashboardStore         dashboards.Store
	folderService          folder.Service
	orgService             org.Service
	features               featuremgmt.FeatureToggles
	folderPermissions      accesscontrol.FolderPermissionsService
	dashboardPermissions   accesscontrol.DashboardPermissionsService
	ac                     accesscontrol.AccessControl
	acService              accesscontrol.Service
	k8sclient              dashboardclient.K8sHandlerWithFallback
	metrics                *dashboardsMetrics
	publicDashboardService publicdashboards.ServiceWrapper
	serverLockService      *serverlock.ServerLockService
	kvstore                kvstore.KVStore
	dual                   dualwrite.Service

	dashboardPermissionsReady chan struct{}
}

func (dr *DashboardServiceImpl) startK8sDeletedDashboardsCleanupJob(ctx context.Context) chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)

		ticker := time.NewTicker(dr.cfg.K8sDashboardCleanup.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := dr.executeCleanupWithLock(ctx); err != nil {
					dr.log.Error("Failed to execute k8s dashboard cleanup", "error", err)
				}
			}
		}
	}()
	return done
}

func (dr *DashboardServiceImpl) executeCleanupWithLock(ctx context.Context) error {
	// We're taking a leader-like locking approach here. By locking and executing, but never releasing the lock,
	// we ensure that other instances of this service can't run in parallel and hence the cleanup will only happen once
	// per cleanup interval by setting the maxInterval and having the time between executions be the cleanup interval as well.
	return dr.serverLockService.LockAndExecute(
		ctx,
		k8sDashboardKvNamespace,
		dr.cfg.K8sDashboardCleanup.Interval,
		func(ctx context.Context) {
			if err := dr.cleanupK8sDashboardResources(ctx, dr.cfg.K8sDashboardCleanup.BatchSize, dr.cfg.K8sDashboardCleanup.Timeout); err != nil {
				dr.log.Error("Failed to cleanup k8s dashboard resources", "error", err)
			}
		},
	)
}

// cleanupK8sDashboardResources cleans up resources marked for deletion in the k8s API.
// It processes all organizations, finds dashboards with the trash label, and cleans them up.
// batchSize specifies how many dashboards to process in a single batch.
// timeout specifies the timeout duration for the cleanup operation.
func (dr *DashboardServiceImpl) cleanupK8sDashboardResources(ctx context.Context, batchSize int64, timeout time.Duration) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.cleanupK8sDashboardResources")
	defer span.End()

	readingFromLegacy := dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, dr.dual)
	if readingFromLegacy {
		// Legacy does its own cleanup
		return nil
	}

	// Create a timeout context to ensure we complete before the lock expires
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}
	dr.log.Debug("Running k8s dashboard resource cleanup for all orgs", "numOrgs", len(orgs))

	var errs []error
	for _, org := range orgs {
		// Check if we're approaching the timeout
		if ctx.Err() != nil {
			dr.log.Info("Timeout reached during cleanup, stopping processing", "timeout", timeout)
			break
		}

		orgErr := dr.cleanupOrganizationK8sDashboards(ctx, org.ID, batchSize)
		if orgErr != nil {
			errs = append(errs, fmt.Errorf("org %d: %w", org.ID, orgErr))
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	return nil
}

// cleanupOrganizationK8sDashboards handles cleanup for a single organization's Kubernetes dashboards
func (dr *DashboardServiceImpl) cleanupOrganizationK8sDashboards(ctx context.Context, orgID int64, batchSize int64) error {
	dr.log.Debug("Running k8s dashboard resource cleanup for org", "orgID", orgID)

	ctx, span := tracer.Start(ctx, "dashboards.service.cleanupK8sDashboardResources.org")
	defer span.End()
	span.SetAttributes(attribute.Int64("org_id", orgID))

	ctx, _ = identity.WithServiceIdentity(ctx, orgID)

	// Get the last processed resource version
	lastResourceVersion, err := dr.getLastResourceVersion(ctx, orgID)
	if err != nil {
		return err
	}

	var errs []error
	continueToken := ""
	itemsProcessed := 0

	for {
		// Check if we're approaching the timeout
		if ctx.Err() != nil {
			dr.log.Info("Timeout reached during org cleanup, stopping processing", "orgID", orgID)
			break
		}

		// List resources to be cleaned up
		data, listErr, shouldContinue := dr.listResourcesToCleanup(ctx, orgID, lastResourceVersion, continueToken, batchSize)
		if listErr != nil {
			errs = append(errs, fmt.Errorf("failed to list resources: %w", listErr))
			break
		}
		if shouldContinue {
			// Reset and try again with updated resource version
			lastResourceVersion = "0"
			continueToken = ""
			continue
		}

		// Skip the first item if it matches our last resource version (due to NotOlderThan behavior)
		if len(data.Items) > 0 && data.Items[0].GetResourceVersion() == lastResourceVersion {
			data.Items = data.Items[1:]
		}

		if len(data.Items) == 0 {
			dr.log.Debug("No items to clean up in this batch", "orgID", orgID)
			break
		}

		dr.log.Info("Processing dashboard cleanup batch", "orgID", orgID, "count", len(data.Items))

		// Process the batch
		processedItems, processingErrs := dr.processDashboardBatch(ctx, orgID, data.Items)
		if len(processingErrs) > 0 {
			errs = append(errs, processingErrs...)
		}
		itemsProcessed += processedItems

		// Update resource version after the batch
		if len(data.Items) > 0 {
			maxBatchResourceVersion := data.Items[len(data.Items)-1].GetResourceVersion()
			if lastResourceVersion != maxBatchResourceVersion {
				dr.log.Info("Updating resource version after batch", "orgID", orgID,
					"newResourceVersion", maxBatchResourceVersion, "oldResourceVersion", lastResourceVersion)

				if updateErr := dr.kvstore.Set(ctx, orgID, k8sDashboardKvNamespace,
					k8sDashboardKvLastResourceVersionKey, maxBatchResourceVersion); updateErr != nil {
					errs = append(errs, fmt.Errorf("failed to update resource version: %w", updateErr))
				}
			}
		}

		meta, _ := data.Object["metadata"].(map[string]interface{})
		continueToken, _ = meta["continue"].(string)
		if continueToken == "" {
			break
		}
	}

	if itemsProcessed > 0 {
		dr.log.Info("Finished k8s dashboard resources cleanup", "orgID", orgID, "itemsProcessed", itemsProcessed)
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}
	return nil
}

// getLastResourceVersion retrieves the last processed resource version from kvstore
func (dr *DashboardServiceImpl) getLastResourceVersion(ctx context.Context, orgID int64) (string, error) {
	lastResourceVersion, ok, err := dr.kvstore.Get(ctx, orgID, k8sDashboardKvNamespace, k8sDashboardKvLastResourceVersionKey)
	if err != nil {
		return "", fmt.Errorf("failed to get last resource version: %w", err)
	}

	if !ok {
		dr.log.Info("No last resource version found, starting from scratch", "orgID", orgID)
		return "0", nil
	}

	return lastResourceVersion, nil
}

// listResourcesToCleanup lists resources that need to be cleaned up
func (dr *DashboardServiceImpl) listResourcesToCleanup(ctx context.Context, orgID int64, resourceVersion, continueToken string, batchSize int64) (*unstructured.UnstructuredList, error, bool) {
	var listOptions v1.ListOptions
	if continueToken != "" {
		listOptions = v1.ListOptions{
			LabelSelector: utils.LabelKeyGetTrash + "=true",
			Continue:      continueToken,
			Limit:         batchSize,
		}
	} else {
		listOptions = v1.ListOptions{
			LabelSelector:        utils.LabelKeyGetTrash + "=true",
			ResourceVersionMatch: v1.ResourceVersionMatchNotOlderThan,
			ResourceVersion:      resourceVersion,
			Limit:                batchSize,
		}
	}

	data, err := dr.k8sclient.List(ctx, orgID, listOptions)
	if err != nil {
		if strings.Contains(err.Error(), "too old resource version") {
			// If the resource version is too old, start from the current version
			dr.log.Info("Resource version too old, starting from current version", "orgID", orgID)
			return nil, nil, true // Signal to continue with reset version
		}
		return nil, err, false
	}

	return data, nil, false
}

// processDashboardBatch processes a batch of dashboards for cleanup
func (dr *DashboardServiceImpl) processDashboardBatch(ctx context.Context, orgID int64, items []unstructured.Unstructured) (int, []error) {
	var errs []error
	itemsProcessed := 0

	// get users ahead of time to do just one db call, rather than 2 per item in the list
	users, err := dr.getUsersForList(ctx, items, orgID)
	if err != nil {
		return 0, append(errs, err)
	}

	for _, item := range items {
		dash, err := dr.unstructuredToLegacyDashboardWithUsers(&item, orgID, users)
		if err != nil {
			errs = append(errs, fmt.Errorf("failed to convert dashboard: %w", err))
			continue
		}

		meta, _ := item.Object["metadata"].(map[string]interface{})
		deletionTimestamp, _ := meta["deletionTimestamp"].(string)
		resourceVersion, _ := meta["resourceVersion"].(string)

		dr.log.Info("K8s dashboard resource previously got deleted, cleaning up",
			"UID", dash.UID,
			"orgID", orgID,
			"deletionTimestamp", deletionTimestamp,
			"resourceVersion", resourceVersion)

		if err = dr.CleanUpDashboard(ctx, dash.UID, dash.ID, orgID); err != nil {
			errs = append(errs, fmt.Errorf("failed to clean up dashboard %s: %w", dash.UID, err))
		}
		itemsProcessed++
	}

	return itemsProcessed, errs
}

// This gets auto-invoked when grafana starts, part of the BackgroundService interface
func (dr *DashboardServiceImpl) Run(ctx context.Context) error {
	cleanupBackgroundJobStopped := dr.startK8sDeletedDashboardsCleanupJob(ctx)
	<-ctx.Done()
	// Wait for cleanup job to finish
	<-cleanupBackgroundJobStopped
	return ctx.Err()
}

var _ dashboards.PermissionsRegistrationService = (*DashboardServiceImpl)(nil)
var _ registry.BackgroundService = (*DashboardServiceImpl)(nil)

// This is the uber service that implements a three smaller services
func ProvideDashboardServiceImpl(
	cfg *setting.Cfg,
	dashboardStore dashboards.Store,
	features featuremgmt.FeatureToggles,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	ac accesscontrol.AccessControl,
	acService accesscontrol.Service,
	folderSvc folder.Service,
	r prometheus.Registerer,
	quotaService quota.Service,
	orgService org.Service,
	publicDashboardService publicdashboards.ServiceWrapper,
	dual dualwrite.Service,
	serverLockService *serverlock.ServerLockService,
	kvstore kvstore.KVStore,
	k8sClient dashboardclient.K8sHandlerWithFallback,
) (*DashboardServiceImpl, error) {
	dashSvc := &DashboardServiceImpl{
		cfg:                       cfg,
		log:                       log.New("dashboard-service"),
		dashboardStore:            dashboardStore,
		features:                  features,
		folderPermissions:         folderPermissionsService,
		ac:                        ac,
		acService:                 acService,
		folderService:             folderSvc,
		orgService:                orgService,
		k8sclient:                 k8sClient,
		metrics:                   newDashboardsMetrics(r),
		dashboardPermissionsReady: make(chan struct{}),
		publicDashboardService:    publicDashboardService,
		serverLockService:         serverLockService,
		kvstore:                   kvstore,
		dual:                      dual,
	}

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return nil, err
	}
	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     dashboards.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      dashSvc.Count,
	}); err != nil {
		return nil, err
	}

	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardIDScopeResolver(dashSvc, folderSvc))
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(dashSvc, folderSvc))

	if err := folderSvc.RegisterService(dashSvc); err != nil {
		return nil, err
	}

	return dashSvc, nil
}

func (dr *DashboardServiceImpl) RegisterDashboardPermissions(service accesscontrol.DashboardPermissionsService) {
	dr.dashboardPermissions = service
	close(dr.dashboardPermissionsReady)
}

func (dr *DashboardServiceImpl) getPermissionsService(isFolder bool) accesscontrol.PermissionsService {
	if isFolder {
		return dr.folderPermissions
	}
	<-dr.dashboardPermissionsReady
	return dr.dashboardPermissions
}

func (dr *DashboardServiceImpl) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return u, err
	}

	total := int64(0)
	for _, org := range orgs {
		ctx, _ := identity.WithServiceIdentity(ctx, org.ID)
		orgDashboards, err := dr.CountDashboardsInOrg(ctx, org.ID)
		if err != nil {
			return nil, err
		}
		total += orgDashboards

		if scopeParams != nil && scopeParams.OrgID == org.ID {
			tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
			if err != nil {
				return nil, err
			}
			u.Set(tag, orgDashboards)
		}
	}

	tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return nil, err
	}
	u.Set(tag, total)

	return u, nil
}

func (dr *DashboardServiceImpl) GetDashboardsByLibraryPanelUID(ctx context.Context, libraryPanelUID string, orgID int64) ([]*dashboards.DashboardRef, error) {
	res, err := dr.k8sclient.Search(ctx, orgID, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{
					Key:      search.DASHBOARD_LIBRARY_PANEL_REFERENCE,
					Operator: string(selection.Equals),
					Values:   []string{libraryPanelUID},
				},
			},
		},
		Limit: listAllDashboardsLimit,
	})
	if err != nil {
		return nil, err
	}

	results, err := dashboardsearch.ParseResults(res, 0)
	if err != nil {
		return nil, err
	}

	dashes := make([]*dashboards.DashboardRef, 0, len(results.Hits))
	for _, row := range results.Hits {
		dashes = append(dashes, &dashboards.DashboardRef{
			UID:       row.Name,
			FolderUID: row.Folder,
			ID:        row.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID), // nolint:staticcheck
		})
	}
	return dashes, nil
}

func (dr *DashboardServiceImpl) CountDashboardsInOrg(ctx context.Context, orgID int64) (int64, error) {
	resp, err := dr.k8sclient.GetStats(ctx, orgID)
	if err != nil {
		return 0, err
	}

	if len(resp.Stats) != 1 {
		return 0, fmt.Errorf("expected 1 stat, got %d", len(resp.Stats))
	}

	return resp.Stats[0].Count, nil
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return &quota.Map{}, err
	}
	orgQuotaTag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
	if err != nil {
		return &quota.Map{}, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.Dashboard)
	limits.Set(orgQuotaTag, cfg.Quota.Org.Dashboard)
	return limits, nil
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return nil, err
	}

	results := []*dashboards.DashboardProvisioning{}
	for _, org := range orgs {
		res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			ManagedBy:       utils.ManagerKindClassicFP, // nolint:staticcheck
			ManagerIdentity: name,
			OrgId:           org.ID,
		})
		if err != nil {
			return nil, err
		}

		for _, r := range res {
			results = append(results, &r.DashboardProvisioning)
		}
	}

	return results, nil
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioning, error) {
	// if dashboard id is 0, it is a new dashboard
	if dashboardID == 0 {
		return nil, nil
	}

	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return nil, err
	}

	for _, org := range orgs {
		res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			ManagedBy:    utils.ManagerKindClassicFP, // nolint:staticcheck
			OrgId:        org.ID,
			DashboardIds: []int64{dashboardID},
		})
		if err != nil {
			return nil, err
		}

		if len(res) == 1 {
			return &res[0].DashboardProvisioning, nil
		} else if len(res) > 1 {
			return nil, fmt.Errorf("found more than one provisioned dashboard with ID %d", dashboardID)
		}
	}

	return nil, nil
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioning, error) {
	if dashboardUID == "" {
		return nil, nil
	}

	res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		ManagedBy:     utils.ManagerKindClassicFP, // nolint:staticcheck
		OrgId:         orgID,
		DashboardUIDs: []string{dashboardUID},
	})
	if err != nil {
		return nil, err
	}

	if len(res) == 1 {
		return &res[0].DashboardProvisioning, nil
	} else if len(res) > 1 {
		return nil, fmt.Errorf("found more than one provisioned dashboard with UID %s", dashboardUID)
	}

	return nil, nil
}

func (dr *DashboardServiceImpl) ValidateBasicDashboardProperties(title string, uid string, message string) error {
	if title == "" {
		return dashboards.ErrDashboardTitleEmpty
	}

	if len(title) > 5000 {
		return dashboards.ErrDashboardTitleTooLong
	}

	// Validate message
	if message != "" && len(message) > 500 {
		return dashboards.ErrDashboardMessageTooLong
	}

	if !util.IsValidShortUID(uid) {
		return dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(uid) {
		return dashboards.ErrDashboardUidTooLong
	}

	return nil
}

//nolint:gocyclo
func (dr *DashboardServiceImpl) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	validateProvisionedDashboard bool) (*dashboards.SaveDashboardCommand, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.BuildSaveDashboardcommand")
	defer span.End()

	dash := dto.Dashboard

	dash.OrgID = dto.OrgID
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUID(strings.TrimSpace(dash.UID))

	if err := dr.ValidateBasicDashboardProperties(dash.Title, dash.UID, dto.Message); err != nil {
		return nil, err
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if dash.IsFolder && dash.FolderID > 0 {
		return nil, dashboards.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, dashboards.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if err := dr.ValidateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dash.Data.Get("refresh").MustString("")); err != nil {
		return nil, err
	}

	// Validate folder
	if dash.FolderID != 0 || dash.FolderUID != "" { // nolint:staticcheck
		folder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{
			OrgID:        dash.OrgID,
			UID:          &dash.FolderUID,
			ID:           &dash.FolderID, // nolint:staticcheck
			SignedInUser: dto.User,
		})
		if err != nil {
			return nil, err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		dash.FolderID = folder.ID
		dash.FolderUID = folder.UID
	}

	isParentFolderChanged, err := dr.ValidateDashboardBeforeSave(ctx, dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		if canCreate, err := dr.canCreateDashboard(ctx, dto.User, dash); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	if dash.ID == 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		if canCreate, err := dr.canCreateDashboard(ctx, dto.User, dash); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	} else {
		if canSave, err := dr.canSaveDashboard(ctx, dto.User, dash); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(ctx, dash.ID)
		if err != nil {
			return nil, err
		}

		if provisionedData != nil {
			return nil, dashboards.ErrDashboardCannotSaveProvisionedDashboard
		}
	}

	var userID int64
	if id, err := identity.UserIdentifier(dto.User.GetID()); err == nil {
		userID = id
	} else if !identity.IsServiceIdentity(ctx) {
		dr.log.Debug("User does not belong to a user or service account namespace, using 0 as user ID", "id", dto.User.GetID())
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	cmd := &dashboards.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgID:     dto.OrgID,
		Overwrite: dto.Overwrite,
		UserID:    userID,
		FolderID:  dash.FolderID, // nolint:staticcheck
		FolderUID: dash.FolderUID,
		IsFolder:  dash.IsFolder,
		PluginID:  dash.PluginID,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardServiceImpl) ValidateDashboardBeforeSave(ctx context.Context, dashboard *dashboards.Dashboard, overwrite bool) (bool, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.ValidateDashboardBeforesave")
	defer span.End()

	isParentFolderChanged := false

	var existingById *dashboards.Dashboard
	var err error
	if dashboard.ID > 0 {
		// if ID is set and the dashboard is not found, ErrDashboardNotFound will be returned
		existingById, err = dr.GetDashboard(ctx, &dashboards.GetDashboardQuery{OrgID: dashboard.OrgID, ID: dashboard.ID})
		if err != nil {
			return false, err
		}

		if dashboard.UID == "" {
			dashboard.SetUID(existingById.UID)
		}
	}
	dashWithIdExists := (existingById != nil)

	var existingByUid *dashboards.Dashboard
	if dashboard.UID != "" {
		existingByUid, err = dr.GetDashboard(ctx, &dashboards.GetDashboardQuery{OrgID: dashboard.OrgID, UID: dashboard.UID})
		if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
			return false, err
		}
	}
	dashWithUidExists := (existingByUid != nil)

	if !dashWithIdExists && !dashWithUidExists {
		return false, nil
	}

	if dashWithIdExists && dashWithUidExists && existingById.ID != existingByUid.ID {
		return false, dashboards.ErrDashboardWithSameUIDExists
	}

	existing := existingById

	if !dashWithIdExists && dashWithUidExists {
		dashboard.SetID(existingByUid.ID)
		dashboard.SetUID(existingByUid.UID)
		existing = existingByUid
	}

	if (existing.IsFolder && !dashboard.IsFolder) ||
		(!existing.IsFolder && dashboard.IsFolder) {
		return isParentFolderChanged, dashboards.ErrDashboardTypeMismatch
	}

	if !dashboard.IsFolder && dashboard.FolderUID != existing.FolderUID {
		isParentFolderChanged = true
	}

	// check for is someone else has written in between
	if dashboard.Version != existing.Version {
		if overwrite {
			dashboard.SetVersion(existing.Version)
		} else {
			return isParentFolderChanged, dashboards.ErrDashboardVersionMismatch
		}
	}

	// do not allow plugin dashboard updates without overwrite flag
	if existing.PluginID != "" && !overwrite {
		return isParentFolderChanged, dashboards.UpdatePluginDashboardError{PluginId: existing.PluginID}
	}

	return isParentFolderChanged, nil
}

func (dr *DashboardServiceImpl) canSaveDashboard(ctx context.Context, user identity.Requester, dash *dashboards.Dashboard) (bool, error) {
	action := dashboards.ActionDashboardsWrite
	if dash.IsFolder {
		action = dashboards.ActionFoldersWrite
	}
	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID)
	if dash.IsFolder {
		scope = dashboards.ScopeFoldersProvider.GetResourceScopeUID(dash.UID)
	}
	return dr.ac.Evaluate(ctx, user, accesscontrol.EvalPermission(action, scope))
}

func (dr *DashboardServiceImpl) canCreateDashboard(ctx context.Context, user identity.Requester, dash *dashboards.Dashboard) (bool, error) {
	action := dashboards.ActionDashboardsCreate
	if dash.IsFolder {
		action = dashboards.ActionFoldersCreate
	}
	scope := dashboards.ScopeFoldersProvider.GetResourceScopeUID(dash.FolderUID)
	if dash.FolderUID == "" {
		scope = dashboards.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	}
	return dr.ac.Evaluate(ctx, user, accesscontrol.EvalPermission(action, scope))
}

// waitForSearchQuery waits for the search query to return the expected number of hits.
// Since US doesn't offer search-after-write guarantees, we can use this to wait after writes until the indexer is up to date.
func (dr *DashboardServiceImpl) waitForSearchQuery(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery, maxRetries int, expectedHits int64) error {
	return retryer.Retry(func() (retryer.RetrySignal, error) {
		results, err := dr.searchDashboardsThroughK8sRaw(ctx, query)
		dr.log.Debug("waitForSearchQuery", "dashboardUIDs", strings.Join(query.DashboardUIDs, ","), "total_hits", results.TotalHits, "err", err)
		if err != nil {
			return retryer.FuncError, err
		}
		if results.TotalHits == expectedHits {
			return retryer.FuncComplete, nil
		}
		return retryer.FuncFailure, nil
	}, maxRetries, 1*time.Second, 5*time.Second)
}

func (dr *DashboardServiceImpl) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *dashboards.DeleteOrphanedProvisionedDashboardsCommand) error {
	// check each org for orphaned provisioned dashboards
	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		ctx, _ := identity.WithServiceIdentity(ctx, org.ID)
		// find all dashboards in the org that have a file repo set that is not in the given readers list
		foundDashs, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			ManagedBy:            utils.ManagerKindClassicFP, //nolint:staticcheck
			ManagerIdentityNotIn: cmd.ReaderNames,
			OrgId:                org.ID,
		})
		if err != nil {
			return err
		}
		dr.log.Debug("Found dashboards to be deleted", "orgId", org.ID, "count", len(foundDashs))

		// delete them
		var deletedUids []string
		for _, foundDash := range foundDashs {
			if err = dr.deleteDashboard(ctx, foundDash.DashboardID, foundDash.DashboardUID, org.ID, false); err != nil {
				return err
			}
			deletedUids = append(deletedUids, foundDash.DashboardUID)
		}
		if len(deletedUids) > 0 {
			// wait for deleted dashboards to be removed from the index
			err = dr.waitForSearchQuery(ctx, &dashboards.FindPersistedDashboardsQuery{OrgId: org.ID, DashboardUIDs: deletedUids}, 5, 0)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (dr *DashboardServiceImpl) ValidateDashboardRefreshInterval(minRefreshInterval string, targetRefreshInterval string) error {
	if minRefreshInterval == "" {
		return nil
	}

	if targetRefreshInterval == "" || targetRefreshInterval == "auto" {
		// since no refresh is set it is a valid refresh rate
		return nil
	}

	minRefreshIntervalDur, err := gtime.ParseDuration(minRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing min refresh interval %q failed: %w", minRefreshInterval, err)
	}
	d, err := gtime.ParseDuration(targetRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing refresh duration %q failed: %w", targetRefreshInterval, err)
	}

	if d < minRefreshIntervalDur {
		return dashboards.ErrDashboardRefreshIntervalTooShort
	}

	return nil
}

func (dr *DashboardServiceImpl) SaveProvisionedDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveProvisionedDashboard")
	defer span.End()

	if err := dr.ValidateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard.Data.Get("refresh").MustString("")); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	ctx, ident := identity.WithServiceIdentity(ctx, dto.OrgID)
	dto.User = ident

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false)
	if err != nil {
		return nil, err
	}
	if cmd == nil {
		return nil, fmt.Errorf("failed to build save dashboard command. cmd is nil")
	}

	dash, err := dr.saveProvisionedDashboardThroughK8s(ctx, cmd, provisioning, false)
	if err != nil {
		return nil, err
	}

	if dto.Dashboard.ID == 0 {
		dr.SetDefaultPermissions(ctx, dto, dash, true)
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *folder.CreateFolderCommand, readerName string) (*folder.Folder, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveFolderForProvisionedDashboards")
	defer span.End()

	ctx, ident := identity.WithServiceIdentity(ctx, dto.OrgID)
	dto.SignedInUser = ident

	// The readerName is the identifier for the file provisioning manager
	dto.ManagerKindClassicFP = readerName // nolint:staticcheck

	f, err := dr.folderService.Create(ctx, dto)
	if err != nil {
		dr.log.Error("failed to create folder for provisioned dashboards", "folder", dto.Title, "org", dto.OrgID, "err", err)
		return nil, err
	}

	return f, nil
}

func (dr *DashboardServiceImpl) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	allowUiUpdate bool) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveDashboard")
	defer span.End()

	if err := dr.ValidateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard.Data.Get("refresh").MustString("")); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval",
			dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, !allowUiUpdate)
	if err != nil {
		return nil, err
	}

	dash, err := dr.saveDashboard(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// new dashboard created
	if dto.Dashboard.ID == 0 {
		dr.SetDefaultPermissions(ctx, dto, dash, false)
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) saveDashboard(ctx context.Context, cmd *dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	return dr.saveDashboardThroughK8s(ctx, cmd, cmd.OrgID)
}

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *DashboardServiceImpl) DeleteDashboard(ctx context.Context, dashboardId int64, dashboardUID string, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, dashboardUID, orgId, true)
}

// DeleteAllDashboards will delete all dashboards within a given org.
func (dr *DashboardServiceImpl) DeleteAllDashboards(ctx context.Context, orgId int64) error {
	return dr.deleteAllDashboardThroughK8s(ctx, orgId)
}

func (dr *DashboardServiceImpl) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*dashboards.Dashboard, error) {
	return nil, nil
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *DashboardServiceImpl) DeleteProvisionedDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	ctx, _ = identity.WithServiceIdentity(ctx, orgId)
	return dr.deleteDashboard(ctx, dashboardId, "", orgId, false)
}

func (dr *DashboardServiceImpl) deleteDashboard(ctx context.Context, dashboardId int64, dashboardUID string, orgId int64, validateProvisionedDashboard bool) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.deleteDashboard")
	defer span.End()

	cmd := &dashboards.DeleteDashboardCommand{OrgID: orgId, ID: dashboardId, UID: dashboardUID}

	return dr.deleteDashboardThroughK8s(ctx, cmd, validateProvisionedDashboard)
}

func (dr *DashboardServiceImpl) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (
	*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.ImportDashboard")
	defer span.End()

	if err := dr.ValidateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard.Data.Get("refresh").MustString("")); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title,
			"minRefreshInterval", dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, true)
	if err != nil {
		return nil, err
	}

	dash, err := dr.saveDashboard(ctx, cmd)
	if err != nil {
		return nil, err
	}

	dr.SetDefaultPermissions(ctx, dto, dash, false)

	return dash, nil
}

// UnprovisionDashboard removes info about dashboard being provisioned. Used after provisioning configs are changed
// and provisioned dashboards are left behind but not deleted.
func (dr *DashboardServiceImpl) UnprovisionDashboard(ctx context.Context, dashboardId int64) error {
	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		ctx, _ = identity.WithServiceIdentity(ctx, org.ID)
		dash, err := dr.getDashboardThroughK8s(ctx, &dashboards.GetDashboardQuery{OrgID: org.ID, ID: dashboardId})
		if err != nil {
			// if we can't find it in this org, try the next one
			continue
		}

		_, err = dr.saveProvisionedDashboardThroughK8s(ctx, &dashboards.SaveDashboardCommand{
			OrgID:     org.ID,
			PluginID:  dash.PluginID,
			FolderUID: dash.FolderUID,
			FolderID:  dash.FolderID, // nolint:staticcheck
			UpdatedAt: time.Now(),
			Dashboard: dash.Data,
		}, nil, true)
		if err != nil {
			return err
		}

		return dr.dashboardStore.UnprovisionDashboard(ctx, dashboardId)
	}

	return dashboards.ErrDashboardNotFound
}

func (dr *DashboardServiceImpl) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		OrgId:           query.OrgID,
		ManagedBy:       utils.ManagerKindPlugin,
		ManagerIdentity: query.PluginID,
	})
	if err != nil {
		return nil, err
	}

	// search only returns the metadata, need to get the dashboard.Data too
	results := make([]*dashboards.Dashboard, len(dashs))
	for i, d := range dashs {
		dash, err := dr.GetDashboard(ctx, &dashboards.GetDashboardQuery{OrgID: d.OrgID, UID: d.UID})
		if err != nil {
			return nil, err
		}
		results[i] = dash
	}

	return results, nil
}

// (sometimes) called by the k8s storage engine after creating an object
func (dr *DashboardServiceImpl) SetDefaultPermissionsAfterCreate(ctx context.Context, key *resourcepb.ResourceKey, id claims.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.SetDefaultPermissionsAfterCreate")
	defer span.End()

	logger := logging.FromContext(ctx)

	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	uid, err := user.GetInternalID()
	if err != nil {
		return err
	}
	permissions := []accesscontrol.SetResourcePermissionCommand{}
	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
			UserID: uid, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
		})
	}
	isNested := obj.GetFolder() != ""
	if !dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesDashboards) {
		// legacy behavior
		if !isNested {
			permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
				{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
				{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
			}...)
		}
	} else {
		// Don't set any permissions for nested dashboards
		if isNested {
			return nil
		}
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}
	svc := dr.getPermissionsService(key.Resource == "folders")
	if _, err := svc.SetPermissions(ctx, ns.OrgID, obj.GetName(), permissions...); err != nil {
		logger.Error("Could not set default permissions", "error", err)
		return err
	}

	// Clear permission cache for the user who created the dashboard, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	if user.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		dr.acService.ClearUserPermissionCache(user)
	}

	return nil
}

func (dr *DashboardServiceImpl) SetDefaultPermissions(ctx context.Context, dto *dashboards.SaveDashboardDTO, dash *dashboards.Dashboard, provisioned bool) {
	ctx, span := tracer.Start(ctx, "dashboards.service.setDefaultPermissions")
	defer span.End()

	resource := "dashboard"
	if dash.IsFolder {
		resource = "folder"
	}

	if !dr.cfg.RBAC.PermissionsOnCreation(resource) {
		return
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()

	var permissions []accesscontrol.SetResourcePermissionCommand
	if !provisioned && dto.User.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := dto.User.GetInternalID()
		if err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "id", dto.User.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
			})
		}
	}

	if dash.FolderUID == "" {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	svc := dr.getPermissionsService(dash.IsFolder)
	if _, err := svc.SetPermissions(ctx, dto.OrgID, dash.UID, permissions...); err != nil {
		dr.log.Error("Could not set default permissions", "dashboard", dash.Title, "error", err)
	}

	// Clear permission cache for the user who created the dashboard, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	if !provisioned && dto.User.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		dr.acService.ClearUserPermissionCache(dto.User)
	}
}

func (dr *DashboardServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return dr.getDashboardThroughK8s(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	result, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		OrgId:        requester.GetOrgID(),
		DashboardIds: []int64{query.ID},
	})
	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return nil, dashboards.ErrDashboardNotFound
	} else if len(result) > 1 {
		return nil, fmt.Errorf("unexpected number of dashboards found: %d. desired: 1", len(result))
	}

	return &dashboards.DashboardRef{UID: result[0].UID, Slug: result[0].Slug, FolderUID: result[0].FolderUID}, nil
}

// expensive query in new flow !! use sparingly - only if you truly need dashboard.Data
func (dr *DashboardServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	if query.OrgID == 0 {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		query.OrgID = requester.GetOrgID()
	}

	dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		DashboardIds:  query.DashboardIDs,
		OrgId:         query.OrgID,
		DashboardUIDs: query.DashboardUIDs,
	})
	if err != nil {
		return nil, err
	}

	// search only returns the metadata, need to get the dashboard.Data too
	results := make([]*dashboards.Dashboard, len(dashs))
	for i, d := range dashs {
		dash, err := dr.GetDashboard(ctx, &dashboards.GetDashboardQuery{OrgID: d.OrgID, UID: d.UID})
		if err != nil {
			return nil, err
		}
		results[i] = dash
	}

	return results, nil
}

func (dr *DashboardServiceImpl) getDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*dashboards.DashboardRef, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getDashboardsSharedWithUser")
	defer span.End()

	permissions := user.GetPermissions()
	dashboardPermissions := permissions[dashboards.ActionDashboardsRead]
	dashboardUids := make([]string, 0)
	for _, p := range dashboardPermissions {
		if dashboardUid, found := strings.CutPrefix(p, dashboards.ScopeDashboardsPrefix); found {
			if !slices.Contains(dashboardUids, dashboardUid) {
				dashboardUids = append(dashboardUids, dashboardUid)
			}
		}
	}

	if len(dashboardUids) == 0 {
		return []*dashboards.DashboardRef{}, nil
	}

	dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		DashboardUIDs: dashboardUids,
		OrgId:         user.GetOrgID(),
	})
	if err != nil {
		return nil, err
	}

	sharedDashboards := make([]*dashboards.DashboardRef, len(dashs))
	for i, d := range dashs {
		sharedDashboards[i] = &dashboards.DashboardRef{UID: d.UID, Slug: d.Slug, FolderUID: d.FolderUID}
	}

	return dr.filterUserSharedDashboards(ctx, user, sharedDashboards)
}

// filterUserSharedDashboards filter dashboards directly assigned to user, but not located in folders with view permissions
func (dr *DashboardServiceImpl) filterUserSharedDashboards(ctx context.Context, user identity.Requester, userDashboards []*dashboards.DashboardRef) ([]*dashboards.DashboardRef, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.filterUserSharedDashboards")
	defer span.End()

	filteredDashboards := make([]*dashboards.DashboardRef, 0)
	folderUIDs := make([]string, 0)
	for _, dashboard := range userDashboards {
		folderUIDs = append(folderUIDs, dashboard.FolderUID)
	}

	// GetFolders return only folders available to user. So we can use is to check access.
	userDashFolders, err := dr.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:         folderUIDs,
		OrgID:        user.GetOrgID(),
		OrderByTitle: true,
		SignedInUser: user,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch parent folders from store: %w", err)
	}

	dashFoldersMap := make(map[string]*folder.Folder, 0)
	for _, f := range userDashFolders {
		dashFoldersMap[f.UID] = f
	}

	for _, dashboard := range userDashboards {
		// Filter out dashboards if user has access to parent folder
		if dashboard.FolderUID == "" {
			continue
		}

		_, hasAccess := dashFoldersMap[dashboard.FolderUID]
		if !hasAccess {
			filteredDashboards = append(filteredDashboards, dashboard)
		}
	}
	return filteredDashboards, nil
}

func (dr *DashboardServiceImpl) getUserSharedDashboardUIDs(ctx context.Context, user identity.Requester) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getUserSharedDashboardsUIDs")
	defer span.End()

	userDashboards, err := dr.getDashboardsSharedWithUser(ctx, user)
	if err != nil {
		return nil, err
	}
	userDashboardUIDs := make([]string, 0)
	for _, dashboard := range userDashboards {
		userDashboardUIDs = append(userDashboardUIDs, dashboard.UID)
	}
	return userDashboardUIDs, nil
}

func (dr *DashboardServiceImpl) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.FindDashboards")
	defer span.End()

	if len(query.FolderUIDs) > 0 && slices.Contains(query.FolderUIDs, folder.SharedWithMeFolderUID) {
		start := time.Now()
		userDashboardUIDs, err := dr.getUserSharedDashboardUIDs(ctx, query.SignedInUser)
		if err != nil {
			dr.metrics.sharedWithMeFetchDashboardsRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
			return nil, err
		}
		if len(userDashboardUIDs) == 0 {
			return []dashboards.DashboardSearchProjection{}, nil
		}
		query.DashboardUIDs = userDashboardUIDs
		query.FolderUIDs = []string{}

		defer func(t time.Time) {
			dr.metrics.sharedWithMeFetchDashboardsRequestsDuration.WithLabelValues("success").Observe(time.Since(start).Seconds())
		}(time.Now())
	}

	if query.OrgId == 0 {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		query.OrgId = requester.GetOrgID()
	}

	response, err := dr.searchDashboardsThroughK8sRaw(ctx, query)
	if err != nil {
		return nil, err
	}

	folderNames, err := dr.fetchFolderNames(ctx, query, response.Hits)
	if err != nil {
		return nil, err
	}

	finalResults := make([]dashboards.DashboardSearchProjection, len(response.Hits))
	for i, hit := range response.Hits {
		folderTitle := ""
		folderID := int64(0)
		if f, ok := folderNames[hit.Folder]; ok {
			folderTitle = f.Title
			folderID = f.ID
		}

		result := dashboards.DashboardSearchProjection{
			ID:          hit.Field.GetNestedInt64(resource.SEARCH_FIELD_LEGACY_ID),
			UID:         hit.Name,
			OrgID:       query.OrgId,
			Title:       hit.Title,
			Slug:        slugify.Slugify(hit.Title),
			Description: hit.Description,
			IsFolder:    false,
			FolderUID:   hit.Folder,
			FolderTitle: folderTitle,
			FolderID:    folderID,
			FolderSlug:  slugify.Slugify(folderTitle),
			Tags:        hit.Tags,
		}

		if hit.Field != nil && query.Sort.Name != "" {
			fieldName, _, err := legacysearcher.ParseSortName(query.Sort.Name)
			if err != nil {
				return nil, err
			}
			result.SortMeta = hit.Field.GetNestedInt64(fieldName)
		}

		if hit.Resource == folderv1.RESOURCE {
			result.IsFolder = true
		}

		finalResults[i] = result
	}

	return finalResults, nil
}

type folderRes struct {
	Title string
	ID    int64
}

func (dr *DashboardServiceImpl) fetchFolderNames(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery, hits []dashboardv0.DashboardHit) (map[string]folderRes, error) {
	// call this with elevated permissions so we can get folder names where user does not have access
	// some dashboards are shared directly with user, but the folder is not accessible via the folder permissions
	serviceCtx, serviceIdent := identity.WithServiceIdentity(ctx, query.OrgId)
	search := folder.SearchFoldersQuery{
		UIDs:         getFolderUIDs(hits),
		OrgID:        query.OrgId,
		SignedInUser: serviceIdent,
	}

	folders, err := dr.folderService.SearchFolders(serviceCtx, search)
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch parent folders: %w", err)
	}

	folderNames := make(map[string]folderRes)
	for _, f := range folders {
		folderNames[f.UID] = folderRes{
			Title: f.Title,
			ID:    f.ID,
		}
	}
	return folderNames, nil
}

func (dr *DashboardServiceImpl) SearchDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (model.HitList, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SearchDashboards")
	defer span.End()

	res, err := dr.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	hits := makeQueryResult(query, res)
	return hits, nil
}

func (dr *DashboardServiceImpl) GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	return dr.listDashboardsThroughK8s(ctx, orgID)
}

func getHitType(item dashboards.DashboardSearchProjection) model.HitType {
	var hitType model.HitType
	if item.IsFolder {
		hitType = model.DashHitFolder
	} else {
		hitType = model.DashHitDB
	}

	return hitType
}

func makeQueryResult(query *dashboards.FindPersistedDashboardsQuery, res []dashboards.DashboardSearchProjection) model.HitList {
	hitList := make([]*model.Hit, 0)

	for _, item := range res {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		hit := &model.Hit{
			ID:          item.ID,
			UID:         item.UID,
			OrgID:       item.OrgID,
			Title:       item.Title,
			URI:         "db/" + item.Slug,
			URL:         dashboards.GetDashboardFolderURL(item.IsFolder, item.UID, item.Slug),
			Type:        getHitType(item),
			FolderID:    item.FolderID, // nolint:staticcheck
			FolderUID:   item.FolderUID,
			FolderTitle: item.FolderTitle,
			Tags:        []string{},
		}

		if item.Tags != nil {
			hit.Tags = item.Tags
		}

		// nolint:staticcheck
		if item.FolderID > 0 || item.FolderUID != "" {
			hit.FolderURL = dashboards.GetFolderURL(item.FolderUID, item.FolderSlug)
		}

		if query.Sort.MetaName != "" {
			hit.SortMeta = item.SortMeta
			hit.SortMetaName = query.Sort.MetaName
		}

		if item.Deleted != nil {
			deletedDate := (*item.Deleted).Add(daysInTrash)
			hit.IsDeleted = true
			hit.PermanentlyDeleteDate = &deletedDate
		}

		hitList = append(hitList, hit)
	}
	return hitList
}

func (dr *DashboardServiceImpl) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	res, err := dr.k8sclient.Search(ctx, query.OrgID, &resourcepb.ResourceSearchRequest{
		Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
			"tags": {
				Field: "tags",
				Limit: 100000,
			},
		},
		Limit: 100000})
	if err != nil {
		return nil, err
	}
	facet, ok := res.Facet["tags"]
	if !ok {
		return []*dashboards.DashboardTagCloudItem{}, nil
	}

	results := make([]*dashboards.DashboardTagCloudItem, len(facet.Terms))
	for i, item := range facet.Terms {
		results[i] = &dashboards.DashboardTagCloudItem{
			Term:  item.Term,
			Count: int(item.Count),
		}
	}

	return results, nil
}

func (dr DashboardServiceImpl) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) (int64, error) {
	dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
		OrgId:      orgID,
		FolderUIDs: folderUIDs,
	})
	if err != nil {
		return 0, err
	}

	return int64(len(dashs)), nil
}

func (dr *DashboardServiceImpl) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.DeleteInFolders")
	defer span.End()

	// We need a list of dashboard uids inside the folder to delete related public dashboards
	dashes, err := dr.dashboardStore.FindDashboards(ctx, &dashboards.FindPersistedDashboardsQuery{
		SignedInUser: u,
		FolderUIDs:   folderUIDs,
		OrgId:        orgID,
		Type:         searchstore.TypeDashboard,
	})
	if err != nil {
		return folder.ErrInternal.Errorf("failed to fetch dashboards: %w", err)
	}

	dashboardUIDs := make([]string, 0, len(dashes))
	for _, dashboard := range dashes {
		dashboardUIDs = append(dashboardUIDs, dashboard.UID)
	}

	err = dr.publicDashboardService.DeleteByDashboardUIDs(ctx, orgID, dashboardUIDs)
	if err != nil {
		return err
	}

	return dr.dashboardStore.DeleteDashboardsInFolders(ctx, &dashboards.DeleteDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) Kind() string { return entity.StandardKindDashboard }

func (dr *DashboardServiceImpl) CleanUpDashboard(ctx context.Context, dashboardUID string, dashboardID int64, orgId int64) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.CleanUpDashboard")
	defer span.End()

	// cleanup things related to dashboards that are not stored in unistore yet
	var err = dr.publicDashboardService.DeleteByDashboardUIDs(ctx, orgId, []string{dashboardUID})
	if err != nil {
		return err
	}

	return dr.dashboardStore.CleanupAfterDelete(ctx, &dashboards.DeleteDashboardCommand{OrgID: orgId, UID: dashboardUID, ID: dashboardID})
}

// -----------------------------------------------------------------------------------------
// Dashboard k8s functions
// -----------------------------------------------------------------------------------------

func (dr *DashboardServiceImpl) getDashboardThroughK8s(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	// get uid if not passed in
	if query.UID == "" {
		result, err := dr.GetDashboardUIDByID(ctx, &dashboards.GetDashboardRefByIDQuery{
			ID: query.ID,
		})
		if err != nil {
			return nil, err
		}

		query.UID = result.UID
	}

	out, err := dr.k8sclient.Get(ctx, query.UID, query.OrgID, v1.GetOptions{}, "")
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if err != nil || out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	return dr.UnstructuredToLegacyDashboard(ctx, out, query.OrgID)
}

func (dr *DashboardServiceImpl) saveProvisionedDashboardThroughK8s(ctx context.Context, cmd *dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning, unprovision bool) (*dashboards.Dashboard, error) {
	// default to 1 if not set
	if cmd.OrgID == 0 {
		cmd.OrgID = 1
	}

	obj, err := LegacySaveCommandToUnstructured(cmd, dr.k8sclient.GetNamespace(cmd.OrgID))
	if err != nil {
		return nil, err
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	m := utils.ManagerProperties{}
	s := utils.SourceProperties{}
	if !unprovision {
		// TODO: the path should be relative to the root
		// HOWEVER, maybe OK to leave this for now and "fix" it by using file provisioning for mode 4
		m.Kind = utils.ManagerKindClassicFP // nolint:staticcheck
		m.Identity = provisioning.Name
		s.Path = provisioning.ExternalID
		s.Checksum = provisioning.CheckSum
		s.TimestampMillis = time.Unix(provisioning.Updated, 0).UnixMilli()
	}
	meta.SetManagerProperties(m)
	meta.SetSourceProperties(s)

	out, err := dr.k8sclient.Update(ctx, obj, cmd.OrgID, v1.UpdateOptions{
		FieldValidation: v1.FieldValidationIgnore,
	})
	if err != nil && apierrors.IsNotFound(err) {
		// Create if it doesn't already exist.
		out, err = dr.k8sclient.Create(ctx, obj, cmd.OrgID, v1.CreateOptions{
			FieldValidation: v1.FieldValidationIgnore,
		})
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	return dr.UnstructuredToLegacyDashboard(ctx, out, cmd.OrgID)
}

func (dr *DashboardServiceImpl) saveDashboardThroughK8s(ctx context.Context, cmd *dashboards.SaveDashboardCommand, orgID int64) (*dashboards.Dashboard, error) {
	obj, err := LegacySaveCommandToUnstructured(cmd, dr.k8sclient.GetNamespace(orgID))
	if err != nil {
		return nil, err
	}
	dashboard.SetPluginIDMeta(obj, cmd.PluginID)

	out, err := dr.k8sclient.Update(ctx, obj, orgID, v1.UpdateOptions{
		FieldValidation: v1.FieldValidationIgnore,
	})
	if err != nil && apierrors.IsNotFound(err) {
		// Create if it doesn't already exist.
		out, err = dr.k8sclient.Create(ctx, obj, orgID, v1.CreateOptions{
			FieldValidation: v1.FieldValidationIgnore,
		})
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	return dr.UnstructuredToLegacyDashboard(ctx, out, orgID)
}

func (dr *DashboardServiceImpl) deleteAllDashboardThroughK8s(ctx context.Context, orgID int64) error {
	return dr.k8sclient.DeleteCollection(ctx, orgID)
}

func (dr *DashboardServiceImpl) deleteDashboardThroughK8s(ctx context.Context, cmd *dashboards.DeleteDashboardCommand, validateProvisionedDashboard bool) error {
	// get uid if not passed in
	if cmd.UID == "" {
		result, err := dr.GetDashboardUIDByID(ctx, &dashboards.GetDashboardRefByIDQuery{
			ID: cmd.ID,
		})
		if err != nil {
			return err
		}

		cmd.UID = result.UID
	}

	// use a grace period of 0 to indicate to skip the check of deleting provisioned dashboards
	var gracePeriod *int64
	if !validateProvisionedDashboard {
		noGracePeriod := int64(0)
		gracePeriod = &noGracePeriod
	}

	return dr.k8sclient.Delete(ctx, cmd.UID, cmd.OrgID, v1.DeleteOptions{
		GracePeriodSeconds: gracePeriod,
	})
}

func (dr *DashboardServiceImpl) listDashboardsThroughK8s(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	dashes := make([]*dashboards.Dashboard, 0)

	for continueToken := ""; true; {
		out, err := dr.k8sclient.List(ctx, orgID, v1.ListOptions{
			Limit:    listAllDashboardsLimit,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		} else if out == nil {
			return nil, dashboards.ErrDashboardNotFound
		}

		// get users ahead of time to do just one db call, rather than 2 per item in the list
		users, err := dr.getUsersForList(ctx, out.Items, orgID)
		if err != nil {
			return nil, err
		}

		for _, item := range out.Items {
			dash, err := dr.unstructuredToLegacyDashboardWithUsers(&item, orgID, users)
			if err != nil {
				return nil, err
			}
			dashes = append(dashes, dash)
		}

		continueToken = out.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return dashes, nil
}

func (dr *DashboardServiceImpl) searchDashboardsThroughK8sRaw(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (dashboardv0.SearchResults, error) {
	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{},
			Labels: []*resourcepb.Requirement{},
		},
		Limit: 100000}

	if len(query.DashboardUIDs) > 0 {
		request.Options.Fields = []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   query.DashboardUIDs,
		}}
	} else if len(query.DashboardIds) > 0 {
		values := make([]string, len(query.DashboardIds))
		for i, id := range query.DashboardIds {
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resourcepb.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if len(query.FolderUIDs) > 0 {
		// Grafana frontend issues a call to search for dashboards in "general" folder. General folder doesn't exists and
		// should return all dashboards without a parent folder.
		// We do something similar in the old sql search query https://github.com/grafana/grafana/blob/a58564a35efe8c05a21d8190b283af5bc0979d2a/pkg/services/sqlstore/searchstore/filters.go#L103
		for i := range query.FolderUIDs {
			if query.FolderUIDs[i] == folder.GeneralFolderUID {
				query.FolderUIDs[i] = ""
				break
			}
		}

		req := []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_FOLDER,
			Operator: string(selection.In),
			Values:   query.FolderUIDs,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	} else if len(query.FolderIds) > 0 { // nolint:staticcheck
		values := make([]string, len(query.FolderIds)) // nolint:staticcheck
		for i, id := range query.FolderIds {           // nolint:staticcheck
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resourcepb.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if query.ManagedBy != "" {
		request.Options.Fields = append(request.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_MANAGER_KIND,
			Operator: string(selection.Equals),
			Values:   []string{string(query.ManagedBy)},
		})
	}

	if query.ManagerIdentity != "" {
		request.Options.Fields = append(request.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_MANAGER_ID,
			Operator: string(selection.In),
			Values:   []string{query.ManagerIdentity},
		})
	}

	if len(query.ManagerIdentityNotIn) > 0 {
		request.Options.Fields = append(request.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_MANAGER_ID,
			Operator: string(selection.NotIn),
			Values:   query.ManagerIdentityNotIn,
		})
	}
	if query.SourcePath != "" {
		request.Options.Fields = append(request.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_SOURCE_PATH,
			Operator: string(selection.In),
			Values:   []string{query.SourcePath},
		})
	}

	if query.Title != "" {
		// allow wildcard search
		request.Query = "*" + strings.ToLower(query.Title) + "*"
	}

	if len(query.Tags) > 0 {
		req := []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_TAGS,
			Operator: string(selection.In),
			Values:   query.Tags,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if query.IsDeleted {
		request.IsDeleted = query.IsDeleted
	}

	if query.Permission > 0 {
		request.Permission = int64(query.Permission)
	}

	if query.Limit < 1 {
		query.Limit = 1000
	}

	if query.Page < 1 {
		query.Page = 1
	}

	request.Limit = query.Limit
	request.Page = query.Page
	request.Offset = (query.Page - 1) * query.Limit // only relevant when running in modes 3+
	request.Fields = dashboardsearch.IncludeFields

	namespace := dr.k8sclient.GetNamespace(query.OrgId)
	var err error
	var federate *resourcepb.ResourceKey
	switch query.Type {
	case "":
		// When no type specified, search for dashboards
		request.Options.Key, err = resource.AsResourceKey(namespace, dashboardv0.DASHBOARD_RESOURCE)
		// Currently a search query is across folders and dashboards
		if err == nil {
			federate, err = resource.AsResourceKey(namespace, folderv1.RESOURCE)
		}
	case searchstore.TypeDashboard, searchstore.TypeAnnotation:
		request.Options.Key, err = resource.AsResourceKey(namespace, dashboardv0.DASHBOARD_RESOURCE)
	case searchstore.TypeFolder, searchstore.TypeAlertFolder:
		request.Options.Key, err = resource.AsResourceKey(namespace, folderv1.RESOURCE)
	default:
		err = fmt.Errorf("bad type request")
	}

	if err != nil {
		return dashboardv0.SearchResults{}, err
	}

	if federate != nil {
		request.Federated = []*resourcepb.ResourceKey{federate}
	}

	if query.Sort.Name != "" {
		sortName, isDesc, err := legacysearcher.ParseSortName(query.Sort.Name)
		if err != nil {
			return dashboardv0.SearchResults{}, err
		}
		request.SortBy = append(request.SortBy, &resourcepb.ResourceSearchRequest_Sort{Field: sortName, Desc: isDesc})
		// include the sort field in the response so we can populate SortMeta
		if !slices.Contains(request.Fields, sortName) {
			request.Fields = append(request.Fields, sortName)
		}
	}

	res, err := dr.k8sclient.Search(ctx, query.OrgId, request)
	if err != nil {
		return dashboardv0.SearchResults{}, err
	}

	return dashboardsearch.ParseResults(res, 0)
}

type dashboardProvisioningWithUID struct {
	dashboards.DashboardProvisioning
	DashboardUID string
}

func (dr *DashboardServiceImpl) searchProvisionedDashboardsThroughK8s(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]*dashboardProvisioningWithUID, error) {
	ctx, span := tracing.Start(ctx, "searchProvisionedDashboardsThroughK8s")
	defer span.End()

	if query == nil {
		return nil, errors.New("query cannot be nil")
	}

	ctx, _ = identity.WithServiceIdentity(ctx, query.OrgId)

	query.Type = searchstore.TypeDashboard

	searchResults, err := dr.searchDashboardsThroughK8sRaw(ctx, query)
	if err != nil {
		return nil, err
	}

	span.SetAttributes(attribute.Int("hits", len(searchResults.Hits)))

	dashs := make([]*dashboardProvisioningWithUID, 0)
	for _, hit := range searchResults.Hits {
		if utils.ParseManagerKindString(hit.Field.GetNestedString(resource.SEARCH_FIELD_MANAGER_KIND)) != utils.ManagerKindClassicFP { // nolint:staticcheck
			continue
		}

		provisioning := &dashboardProvisioningWithUID{
			DashboardProvisioning: dashboards.DashboardProvisioning{
				Name:        hit.Field.GetNestedString(resource.SEARCH_FIELD_MANAGER_ID),
				ExternalID:  hit.Field.GetNestedString(resource.SEARCH_FIELD_SOURCE_PATH),
				CheckSum:    hit.Field.GetNestedString(resource.SEARCH_FIELD_SOURCE_CHECKSUM),
				Updated:     hit.Field.GetNestedInt64(resource.SEARCH_FIELD_SOURCE_TIME),
				DashboardID: hit.Field.GetNestedInt64(utils.LabelKeyDeprecatedInternalID), // nolint:staticcheck
			},
			DashboardUID: hit.Name,
		}
		dashs = append(dashs, provisioning)
	}

	return dashs, nil
}

func (dr *DashboardServiceImpl) searchDashboardsThroughK8s(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]*dashboards.Dashboard, error) {
	if query == nil {
		return nil, errors.New("query cannot be nil")
	}
	query.Type = searchstore.TypeDashboard

	response, err := dr.searchDashboardsThroughK8sRaw(ctx, query)
	if err != nil {
		return nil, err
	}
	result := make([]*dashboards.Dashboard, len(response.Hits))
	for i, hit := range response.Hits {
		result[i] = &dashboards.Dashboard{
			OrgID:     query.OrgId,
			UID:       hit.Name,
			Slug:      slugify.Slugify(hit.Title),
			Title:     hit.Title,
			FolderUID: hit.Folder,
		}
	}

	return result, nil
}

func (dr *DashboardServiceImpl) getUsersForList(ctx context.Context, items []unstructured.Unstructured, orgID int64) (map[string]*user.User, error) {
	userMeta := []string{}
	for _, item := range items {
		obj, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, err
		}
		if obj.GetCreatedBy() != "" {
			userMeta = append(userMeta, obj.GetCreatedBy())
		}
		if obj.GetUpdatedBy() != "" {
			userMeta = append(userMeta, obj.GetUpdatedBy())
		}
	}

	return dr.k8sclient.GetUsersFromMeta(ctx, userMeta)
}

func (dr *DashboardServiceImpl) UnstructuredToLegacyDashboard(ctx context.Context, item *unstructured.Unstructured, orgID int64) (*dashboards.Dashboard, error) {
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}

	users, err := dr.k8sclient.GetUsersFromMeta(ctx, []string{obj.GetCreatedBy(), obj.GetUpdatedBy()})
	if err != nil {
		return nil, err
	}
	return dr.unstructuredToLegacyDashboardWithUsers(item, orgID, users)
}

func (dr *DashboardServiceImpl) unstructuredToLegacyDashboardWithUsers(item *unstructured.Unstructured, orgID int64, users map[string]*user.User) (*dashboards.Dashboard, error) {
	spec, ok := item.Object["spec"].(map[string]any)
	if !ok {
		return nil, errors.New("error parsing dashboard from k8s response")
	}
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	uid := obj.GetName()
	spec["uid"] = uid

	dashVersion := obj.GetGeneration()
	spec["version"] = dashVersion

	title, _, _ := unstructured.NestedString(spec, "title")
	out := dashboards.Dashboard{
		OrgID:      orgID,
		ID:         obj.GetDeprecatedInternalID(), // nolint:staticcheck
		UID:        uid,
		Slug:       slugify.Slugify(title),
		FolderUID:  obj.GetFolder(),
		Version:    int(dashVersion),
		Data:       simplejson.NewFromAny(spec),
		APIVersion: strings.TrimPrefix(item.GetAPIVersion(), dashboardv0.GROUP+"/"),
	}

	out.Created = obj.GetCreationTimestamp().Time
	updated, err := obj.GetUpdatedTimestamp()
	if err == nil && updated != nil {
		// old apis return in local time, created is already doing that
		localTime := updated.Local()
		out.Updated = localTime
	} else {
		// by default, set updated to created
		out.Updated = out.Created
	}

	deleted := obj.GetDeletionTimestamp()
	if deleted != nil {
		out.Deleted = obj.GetDeletionTimestamp().Time
	}

	out.PluginID = dashboard.GetPluginIDFromMeta(obj)

	if creator, ok := users[obj.GetCreatedBy()]; ok {
		out.CreatedBy = creator.ID
	}
	if updater, ok := users[obj.GetUpdatedBy()]; ok {
		out.UpdatedBy = updater.ID
	}

	// any dashboards that have already been synced to unified storage will have the id in the spec
	// and not as a label. We will need to support this conversion until they have all been updated
	// to labels
	if id, ok := spec["id"].(int64); ok {
		out.ID = id
		out.Data.Del("id")
	}

	if gnetID, ok := spec["gnet_id"].(int64); ok {
		out.GnetID = gnetID
	}

	if isFolder, ok := spec["is_folder"].(bool); ok {
		out.IsFolder = isFolder
	}

	if hasACL, ok := spec["has_acl"].(bool); ok {
		out.HasACL = hasACL
	}

	if title, ok := spec["title"].(string); ok {
		out.Title = title
		// if slug isn't in the metadata, add it via the title
		if out.Slug == "" {
			out.UpdateSlug()
		}
	}

	return &out, nil
}

func LegacySaveCommandToUnstructured(cmd *dashboards.SaveDashboardCommand, namespace string) (*unstructured.Unstructured, error) {
	uid := cmd.GetDashboardModel().UID
	if uid == "" {
		uid = uuid.NewString()
	}

	finalObj := &unstructured.Unstructured{
		Object: map[string]interface{}{},
	}

	obj := map[string]interface{}{}
	body, err := cmd.Dashboard.ToDB()
	if err != nil {
		return finalObj, err
	}

	err = json.Unmarshal(body, &obj)
	if err != nil {
		return finalObj, err
	}

	// update the version
	version, ok := obj["version"].(float64)
	if !ok || version == 0 {
		obj["version"] = 1
	} else if !cmd.Overwrite {
		obj["version"] = version + 1
	}

	finalObj.Object["spec"] = obj
	finalObj.SetName(uid)
	finalObj.SetNamespace(namespace)
	finalObj.SetGroupVersionKind(dashboardv0.DashboardResourceInfo.GroupVersionKind())

	meta, err := utils.MetaAccessor(finalObj)
	if err != nil {
		return finalObj, err
	}

	if cmd.FolderUID != "" {
		meta.SetFolder(cmd.FolderUID)
	}

	if cmd.Message != "" {
		meta.SetMessage(cmd.Message)
	}

	return finalObj, nil
}

func getFolderUIDs(hits []dashboardv0.DashboardHit) []string {
	folderSet := map[string]bool{}
	for _, hit := range hits {
		if hit.Folder != "" && !folderSet[hit.Folder] {
			folderSet[hit.Folder] = true
		}
	}
	return maps.Keys(folderSet)
}
