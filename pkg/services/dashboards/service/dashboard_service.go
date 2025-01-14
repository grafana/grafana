package service

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"golang.org/x/exp/slices"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	k8sUser "k8s.io/apiserver/pkg/authentication/user"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util"
)

var (
	provisionerPermissions = []accesscontrol.Permission{
		{Action: dashboards.ActionFoldersCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeFoldersAll},
		{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
	}
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService             = (*DashboardServiceImpl)(nil)
	_ dashboards.DashboardProvisioningService = (*DashboardServiceImpl)(nil)
	_ dashboards.PluginService                = (*DashboardServiceImpl)(nil)

	daysInTrash = 24 * 30 * time.Hour
	tracer      = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards/service")
)

type DashboardServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	dashboardStore       dashboards.Store
	folderStore          folder.FolderStore
	folderService        folder.Service
	userService          user.Service
	orgService           org.Service
	features             featuremgmt.FeatureToggles
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	ac                   accesscontrol.AccessControl
	k8sclient            dashboardK8sHandler
	metrics              *dashboardsMetrics
}

// interface to allow for testing
type dashboardK8sHandler interface {
	getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool)
	getNamespace(orgID int64) string
	getSearcher() resource.ResourceIndexClient
}

var _ dashboardK8sHandler = (*dashk8sHandler)(nil)

type dashk8sHandler struct {
	namespacer         request.NamespaceMapper
	gvr                schema.GroupVersionResource
	restConfigProvider apiserver.RestConfigProvider
	searcher           resource.ResourceIndexClient
}

// This is the uber service that implements a three smaller services
func ProvideDashboardServiceImpl(
	cfg *setting.Cfg, dashboardStore dashboards.Store, folderStore folder.FolderStore,
	features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, ac accesscontrol.AccessControl,
	folderSvc folder.Service, fStore folder.Store, r prometheus.Registerer,
	restConfigProvider apiserver.RestConfigProvider, userService user.Service, unified resource.ResourceClient,
	quotaService quota.Service, orgService org.Service,
) (*DashboardServiceImpl, error) {
	k8sHandler := &dashk8sHandler{
		gvr:                v0alpha1.DashboardResourceInfo.GroupVersionResource(),
		namespacer:         request.GetNamespaceMapper(cfg),
		restConfigProvider: restConfigProvider,
		searcher:           unified,
	}

	dashSvc := &DashboardServiceImpl{
		cfg:                  cfg,
		log:                  log.New("dashboard-service"),
		dashboardStore:       dashboardStore,
		features:             features,
		folderPermissions:    folderPermissionsService,
		dashboardPermissions: dashboardPermissionsService,
		ac:                   ac,
		folderStore:          folderStore,
		folderService:        folderSvc,
		orgService:           orgService,
		userService:          userService,
		k8sclient:            k8sHandler,
		metrics:              newDashboardsMetrics(r),
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

	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardIDScopeResolver(folderStore, dashSvc, folderSvc))
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(folderStore, dashSvc, folderSvc))

	if err := folderSvc.RegisterService(dashSvc); err != nil {
		return nil, err
	}

	return dashSvc, nil
}

func (dr *DashboardServiceImpl) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		u := &quota.Map{}
		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return u, err
		}

		total := int64(0)
		for _, org := range orgs {
			ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(org.ID))
			dashs, err := dr.listDashboardsThroughK8s(ctx, org.ID)
			if err != nil {
				return u, err
			}
			orgDashboards := int64(len(dashs))
			total += orgDashboards

			tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.OrgScope)
			if err != nil {
				return nil, err
			}
			u.Set(tag, orgDashboards)
		}

		tag, err := quota.NewTag(dashboards.QuotaTargetSrv, dashboards.QuotaTarget, quota.GlobalScope)
		if err != nil {
			return nil, err
		}
		u.Set(tag, total)

		return u, nil
	}

	return dr.dashboardStore.Count(ctx, scopeParams)
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

func getDashboardBackgroundRequester(orgId int64) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:   claims.TypeServiceAccount,
		UserID: 1,
		OrgID:  orgId,
		Name:   "dashboard-background",
		Login:  "dashboard-background",
		Permissions: map[int64]map[string][]string{
			orgId: {
				"*": {"*"},
			},
		},
	}
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return nil, err
		}

		results := []*dashboards.DashboardProvisioning{}
		var mu sync.Mutex
		g, ctx := errgroup.WithContext(ctx)
		for _, org := range orgs {
			func(orgID int64) {
				g.Go(func() error {
					res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, dashboards.FindPersistedDashboardsQuery{
						ProvisionedRepo: name,
						OrgId:           orgID,
					})
					if err != nil {
						return err
					}

					mu.Lock()
					for _, r := range res {
						results = append(results, &r.DashboardProvisioning)
					}
					mu.Unlock()
					return nil
				})
			}(org.ID)
		}

		if err := g.Wait(); err != nil {
			return nil, err
		}

		return results, nil
	}

	return dr.dashboardStore.GetProvisionedDashboardData(ctx, name)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioning, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		// if dashboard id is 0, it is a new dashboard
		if dashboardID == 0 {
			return nil, nil
		}

		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return nil, err
		}

		for _, org := range orgs {
			res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, dashboards.FindPersistedDashboardsQuery{
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

	return dr.dashboardStore.GetProvisionedDataByDashboardID(ctx, dashboardID)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioning, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		if dashboardUID == "" {
			return nil, nil
		}

		res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, dashboards.FindPersistedDashboardsQuery{
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

	return dr.dashboardStore.GetProvisionedDataByDashboardUID(ctx, orgID, dashboardUID)
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

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if dash.IsFolder && dash.FolderID > 0 {
		return nil, dashboards.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, dashboards.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if !util.IsValidShortUID(dash.UID) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(dash.UID) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dash); err != nil {
		return nil, err
	}

	// Validate folder
	if dash.FolderUID != "" {
		if !dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesFoldersServiceV2) {
			folder, err := dr.folderStore.GetFolderByUID(ctx, dash.OrgID, dash.FolderUID)
			if err != nil {
				return nil, err
			}
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
			// nolint:staticcheck
			dash.FolderID = folder.ID
		}
	} else if dash.FolderID != 0 { // nolint:staticcheck
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		folder, err := dr.folderStore.GetFolderByID(ctx, dash.OrgID, dash.FolderID)
		if err != nil {
			return nil, err
		}
		dash.FolderUID = folder.UID
	}

	isParentFolderChanged, err := dr.ValidateDashboardBeforeSave(ctx, dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		// Check that the user is allowed to add a dashboard to the folder
		guardian, err := guardian.NewByDashboard(ctx, dash, dto.OrgID, dto.User)
		if err != nil {
			return nil, err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		if canSave, err := guardian.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canSave {
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

	guard, err := getGuardianForSavePermissionCheck(ctx, dash, dto.User)
	if err != nil {
		return nil, err
	}

	if dash.ID == 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		if canCreate, err := guard.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	} else {
		if canSave, err := guard.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	var userID int64
	if id, err := identity.UserIdentifier(dto.User.GetID()); err == nil {
		userID = id
	} else {
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

func (dr *DashboardServiceImpl) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *dashboards.DeleteOrphanedProvisionedDashboardsCommand) error {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		// check each org for orphaned provisioned dashboards
		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return err
		}

		for _, org := range orgs {
			// find all dashboards in the org that have a file repo set that is not in the given readers list
			foundDashs, err := dr.searchProvisionedDashboardsThroughK8s(ctx, dashboards.FindPersistedDashboardsQuery{
				ProvisionedReposNotIn: cmd.ReaderNames,
				OrgId:                 org.ID,
			})
			if err != nil {
				return err
			}

			// delete them
			for _, foundDash := range foundDashs {
				ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(org.ID))
				if err = dr.deleteDashboard(ctx, foundDash.DashboardID, foundDash.DashboardUID, org.ID, false); err != nil {
					return err
				}
			}
		}
		return nil
	}

	return dr.dashboardStore.DeleteOrphanedProvisionedDashboards(ctx, cmd)
}

// getGuardianForSavePermissionCheck returns the guardian to be used for checking permission of dashboard
// It replaces deleted Dashboard.GetDashboardIdForSavePermissionCheck()
func getGuardianForSavePermissionCheck(ctx context.Context, d *dashboards.Dashboard, user identity.Requester) (guardian.DashboardGuardian, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getGuardianForSavePermissionCheck")
	defer span.End()

	newDashboard := d.ID == 0

	if newDashboard {
		// if it's a new dashboard/folder check the parent folder permissions
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		guard, err := guardian.New(ctx, d.FolderID, d.OrgID, user)
		if err != nil {
			return nil, err
		}
		return guard, nil
	}
	guard, err := guardian.NewByDashboard(ctx, d, d.OrgID, user)
	if err != nil {
		return nil, err
	}
	return guard, nil
}

func validateDashboardRefreshInterval(minRefreshInterval string, dash *dashboards.Dashboard) error {
	if minRefreshInterval == "" {
		return nil
	}

	refresh := dash.Data.Get("refresh").MustString("")
	if refresh == "" || refresh == "auto" {
		// since no refresh is set it is a valid refresh rate
		return nil
	}

	minRefreshIntervalDur, err := gtime.ParseDuration(minRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing min refresh interval %q failed: %w", minRefreshInterval, err)
	}
	d, err := gtime.ParseDuration(refresh)
	if err != nil {
		return fmt.Errorf("parsing refresh duration %q failed: %w", refresh, err)
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

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	dto.User = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)
	ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(dto.OrgID))

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false)
	if err != nil {
		return nil, err
	}

	var dash *dashboards.Dashboard
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		// save the dashboard but then do NOT return
		// we want to save the provisioning data to the dashboard_provisioning table still
		// to ensure we can safely rollback to mode2 if needed
		dash, err = dr.saveProvisionedDashboardThroughK8s(ctx, cmd, provisioning, false)
		if err != nil {
			return nil, err
		}
	} else {
		dash, err = dr.saveDashboard(ctx, cmd)
		if err != nil {
			return nil, err
		}
	}

	err = dr.dashboardStore.SaveProvisionedDashboard(ctx, dash, provisioning)
	if err != nil {
		return nil, err
	}

	if dto.Dashboard.ID == 0 {
		dr.setDefaultPermissions(ctx, dto, dash, true)
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *folder.CreateFolderCommand) (*folder.Folder, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveFolderForProvisionedDashboards")
	defer span.End()

	dto.SignedInUser = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)
	ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(dto.OrgID))

	f, err := dr.folderService.Create(ctx, dto)
	if err != nil {
		dr.log.Error("failed to create folder for provisioned dashboards", "folder", dto.Title, "org", dto.OrgID, "err", err)
		return nil, err
	}

	dr.setDefaultFolderPermissions(ctx, dto, f, true)
	return f, nil
}

func (dr *DashboardServiceImpl) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	allowUiUpdate bool) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveDashboard")
	defer span.End()

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
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
		dr.setDefaultPermissions(ctx, dto, dash, false)
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) saveDashboard(ctx context.Context, cmd *dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.saveDashboardThroughK8s(ctx, cmd, cmd.OrgID)
	}

	return dr.dashboardStore.SaveDashboard(ctx, *cmd)
}

func (dr *DashboardServiceImpl) GetSoftDeletedDashboard(ctx context.Context, orgID int64, uid string) (*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.getDashboardThroughK8s(ctx, &dashboards.GetDashboardQuery{OrgID: orgID, UID: uid, IncludeDeleted: true})
	}

	return dr.dashboardStore.GetSoftDeletedDashboard(ctx, orgID, uid)
}

func (dr *DashboardServiceImpl) RestoreDashboard(ctx context.Context, dashboard *dashboards.Dashboard, user identity.Requester, optionalFolderUID string) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.RestoreDashboard")
	defer span.End()

	if !dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return fmt.Errorf("feature flag %s is not enabled", featuremgmt.FlagDashboardRestore)
	}

	// if the optionalFolder is provided we need to check if the folder exists and user has access to it
	if optionalFolderUID != "" {
		restoringFolder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{
			UID:          &optionalFolderUID,
			OrgID:        dashboard.OrgID,
			SignedInUser: user,
		})
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return dashboards.ErrFolderRestoreNotFound
			}
			return folder.ErrInternal.Errorf("failed to fetch parent folder from store: %w", err)
		}

		return dr.dashboardStore.RestoreDashboard(ctx, dashboard.OrgID, dashboard.UID, restoringFolder)
	}

	// if the optionalFolder is not provided we need to restore the dashboard to the original folder
	// we check for permissions and the folder existence before restoring
	restoringFolder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{
		UID:          &dashboard.FolderUID,
		OrgID:        dashboard.OrgID,
		SignedInUser: user,
	})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return dashboards.ErrFolderRestoreNotFound
		}
		return folder.ErrInternal.Errorf("failed to fetch parent folder from store: %w", err)
	}

	// TODO: once restore in k8s is finalized, add functionality here under the feature toggle

	return dr.dashboardStore.RestoreDashboard(ctx, dashboard.OrgID, dashboard.UID, restoringFolder)
}

func (dr *DashboardServiceImpl) SoftDeleteDashboard(ctx context.Context, orgID int64, dashboardUID string) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.SoftDeleteDashboard")
	defer span.End()

	if !dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return fmt.Errorf("feature flag %s is not enabled", featuremgmt.FlagDashboardRestore)
	}

	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		// deletes in unistore are soft deletes, so we can just delete in the same way
		return dr.deleteDashboardThroughK8s(ctx, &dashboards.DeleteDashboardCommand{OrgID: orgID, UID: dashboardUID}, true)
	}

	provisionedData, _ := dr.GetProvisionedDashboardDataByDashboardUID(ctx, orgID, dashboardUID)
	if provisionedData != nil && provisionedData.ID != 0 {
		return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
	}

	return dr.dashboardStore.SoftDeleteDashboard(ctx, orgID, dashboardUID)
}

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *DashboardServiceImpl) DeleteDashboard(ctx context.Context, dashboardId int64, dashboardUID string, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, dashboardUID, orgId, true)
}

// DeleteAllDashboards will delete all dashboards within a given org.
func (dr *DashboardServiceImpl) DeleteAllDashboards(ctx context.Context, orgId int64) error {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.deleteAllDashboardThroughK8s(ctx, orgId)
	}

	return dr.dashboardStore.DeleteAllDashboards(ctx, orgId)
}

func (dr *DashboardServiceImpl) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*dashboards.Dashboard, error) {
	return nil, nil
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *DashboardServiceImpl) DeleteProvisionedDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(orgId))
	return dr.deleteDashboard(ctx, dashboardId, "", orgId, false)
}

func (dr *DashboardServiceImpl) deleteDashboard(ctx context.Context, dashboardId int64, dashboardUID string, orgId int64, validateProvisionedDashboard bool) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.deleteDashboard")
	defer span.End()

	cmd := &dashboards.DeleteDashboardCommand{OrgID: orgId, ID: dashboardId, UID: dashboardUID}

	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		err := dr.deleteDashboardThroughK8s(ctx, cmd, validateProvisionedDashboard)
		if err != nil {
			return err
		}
		// cleanup things related to dashboards that are not stored in unistore yet
		return dr.dashboardStore.CleanupAfterDelete(ctx, cmd)
	}

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(ctx, dashboardId)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to check if dashboard is provisioned", err)
		}

		if provisionedData != nil {
			return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
		}
	}

	return dr.dashboardStore.DeleteDashboard(ctx, cmd)
}

func (dr *DashboardServiceImpl) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (
	*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.ImportDashboard")
	defer span.End()

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
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

	dr.setDefaultPermissions(ctx, dto, dash, false)

	return dash, nil
}

// UnprovisionDashboard removes info about dashboard being provisioned. Used after provisioning configs are changed
// and provisioned dashboards are left behind but not deleted.
func (dr *DashboardServiceImpl) UnprovisionDashboard(ctx context.Context, dashboardId int64) error {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return err
		}

		for _, org := range orgs {
			ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(org.ID))
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

			return err
		}

		return dashboards.ErrDashboardNotFound
	}

	return dr.dashboardStore.UnprovisionDashboard(ctx, dashboardId)
}

func (dr *DashboardServiceImpl) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			OrgId:           query.OrgID,
			ProvisionedRepo: pluginIDRepoName,
			ProvisionedPath: query.PluginID,
		})
	}
	return dr.dashboardStore.GetDashboardsByPluginID(ctx, query)
}

func (dr *DashboardServiceImpl) setDefaultPermissions(ctx context.Context, dto *dashboards.SaveDashboardDTO, dash *dashboards.Dashboard, provisioned bool) {
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
	// nolint:staticcheck
	inFolder := dash.FolderID > 0
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

	if !inFolder {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	svc := dr.dashboardPermissions
	if dash.IsFolder {
		svc = dr.folderPermissions
	}

	if _, err := svc.SetPermissions(ctx, dto.OrgID, dash.UID, permissions...); err != nil {
		dr.log.Error("Could not set default permissions", "dashboard", dash.Title, "error", err)
	}
}

func (dr *DashboardServiceImpl) setDefaultFolderPermissions(ctx context.Context, cmd *folder.CreateFolderCommand, f *folder.Folder, provisioned bool) {
	ctx, span := tracer.Start(ctx, "dashboards.service.setDefaultFolderPermissions")
	defer span.End()

	if !dr.cfg.RBAC.PermissionsOnCreation("folder") {
		return
	}

	inFolder := f.ParentUID != ""
	var permissions []accesscontrol.SetResourcePermissionCommand

	if !provisioned && cmd.SignedInUser.IsIdentityType(claims.TypeUser) {
		userID, err := cmd.SignedInUser.GetInternalID()
		if err != nil {
			dr.log.Error("Could not make user admin", "folder", cmd.Title, "id", cmd.SignedInUser.GetID())
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
			})
		}
	}

	if !inFolder {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	if _, err := dr.folderPermissions.SetPermissions(ctx, cmd.OrgID, f.UID, permissions...); err != nil {
		dr.log.Error("Could not set default folder permissions", "folder", f.Title, "error", err)
	}
}

func (dr *DashboardServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.getDashboardThroughK8s(ctx, query)
	}

	return dr.dashboardStore.GetDashboard(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
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

		if len(result) != 1 {
			return nil, fmt.Errorf("unexpected number of dashboards found: %d. desired: 1", len(result))
		}

		return &dashboards.DashboardRef{UID: result[0].UID, Slug: result[0].Slug}, nil
	}

	return dr.dashboardStore.GetDashboardUIDByID(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		if query.OrgID == 0 {
			requester, err := identity.GetRequester(ctx)
			if err != nil {
				return nil, err
			}
			query.OrgID = requester.GetOrgID()
		}

		return dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			DashboardIds:  query.DashboardIDs,
			OrgId:         query.OrgID,
			DashboardUIDs: query.DashboardUIDs,
		})
	}

	return dr.dashboardStore.GetDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*dashboards.Dashboard, error) {
	return dr.getDashboardsSharedWithUser(ctx, user)
}

func (dr *DashboardServiceImpl) getDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getDashboardsSharedWithUser")
	defer span.End()

	permissions := user.GetPermissions()
	dashboardPermissions := permissions[dashboards.ActionDashboardsRead]
	sharedDashboards := make([]*dashboards.Dashboard, 0)
	dashboardUids := make([]string, 0)
	for _, p := range dashboardPermissions {
		if dashboardUid, found := strings.CutPrefix(p, dashboards.ScopeDashboardsPrefix); found {
			if !slices.Contains(dashboardUids, dashboardUid) {
				dashboardUids = append(dashboardUids, dashboardUid)
			}
		}
	}

	if len(dashboardUids) == 0 {
		return sharedDashboards, nil
	}

	dashboardsQuery := &dashboards.GetDashboardsQuery{
		DashboardUIDs: dashboardUids,
		OrgID:         user.GetOrgID(),
	}
	sharedDashboards, err := dr.GetDashboards(ctx, dashboardsQuery)
	if err != nil {
		return nil, err
	}
	return dr.filterUserSharedDashboards(ctx, user, sharedDashboards)
}

// filterUserSharedDashboards filter dashboards directly assigned to user, but not located in folders with view permissions
func (dr *DashboardServiceImpl) filterUserSharedDashboards(ctx context.Context, user identity.Requester, userDashboards []*dashboards.Dashboard) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.filterUserSharedDashboards")
	defer span.End()

	filteredDashboards := make([]*dashboards.Dashboard, 0)

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

	if dr.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && len(query.FolderUIDs) > 0 && slices.Contains(query.FolderUIDs, folder.SharedWithMeFolderUID) {
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

	if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesCliDashboards) {
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

		finalResults := make([]dashboards.DashboardSearchProjection, len(response.Hits))
		for i, hit := range response.Hits {
			finalResults[i] = dashboards.DashboardSearchProjection{
				UID:       hit.Name,
				OrgID:     query.OrgId,
				Title:     hit.Title,
				Slug:      slugify.Slugify(hit.Title),
				IsFolder:  false,
				FolderUID: hit.Folder,
				Tags:      hit.Tags,
			}
		}

		return finalResults, nil
	}

	return dr.dashboardStore.FindDashboards(ctx, query)
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

func (dr *DashboardServiceImpl) GetAllDashboards(ctx context.Context) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		return dr.listDashboardsThroughK8s(ctx, requester.GetOrgID())
	}

	return dr.dashboardStore.GetAllDashboards(ctx)
}

func (dr *DashboardServiceImpl) GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return dr.listDashboardsThroughK8s(ctx, orgID)
	}

	return dr.dashboardStore.GetAllDashboardsByOrgId(ctx, orgID)
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
	hits := make(map[string]*model.Hit)

	for _, item := range res {
		key := fmt.Sprintf("%s-%d", item.UID, item.OrgID)
		hit, exists := hits[key]
		if !exists {
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
			hit = &model.Hit{
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

			// when searching through unified storage, the dashboard will come as one
			// item, when searching through legacy, the dashboard will come multiple times
			// per tag. So we need to add the array here for unified, and the term below for legacy.
			if item.Tags != nil {
				hit.Tags = item.Tags
			}

			// nolint:staticcheck
			if item.FolderID > 0 {
				hit.FolderURL = dashboards.GetFolderURL(item.FolderUID, item.FolderSlug)
			}

			if query.Sort.MetaName != "" {
				hit.SortMeta = item.SortMeta
				hit.SortMetaName = query.Sort.MetaName
			}

			hitList = append(hitList, hit)
			hits[key] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
		if item.Deleted != nil {
			deletedDate := (*item.Deleted).Add(daysInTrash)
			hit.IsDeleted = true
			hit.PermanentlyDeleteDate = &deletedDate
		}
	}
	return hitList
}

func (dr *DashboardServiceImpl) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesCliDashboards) {
		res, err := dr.k8sclient.getSearcher().Search(ctx, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: dr.k8sclient.getNamespace(query.OrgID),
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
			},
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
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

	return dr.dashboardStore.GetDashboardTags(ctx, query)
}

func (dr DashboardServiceImpl) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) (int64, error) {
	return dr.dashboardStore.CountDashboardsInFolders(ctx, &dashboards.CountDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.DeleteInFolders")
	defer span.End()

	if dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return dr.dashboardStore.SoftDeleteDashboardsInFolders(ctx, orgID, folderUIDs)
	}

	return dr.dashboardStore.DeleteDashboardsInFolders(ctx, &dashboards.DeleteDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) Kind() string { return entity.StandardKindDashboard }

func (dr *DashboardServiceImpl) CleanUpDeletedDashboards(ctx context.Context) (int64, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.CleanUpDeletedDashboards")
	defer span.End()

	var deletedDashboardsCount int64
	deletedDashboards, err := dr.dashboardStore.GetSoftDeletedExpiredDashboards(ctx, daysInTrash)
	if err != nil {
		return 0, err
	}
	for _, dashboard := range deletedDashboards {
		err = dr.DeleteDashboard(ctx, dashboard.ID, dashboard.UID, dashboard.OrgID)
		if err != nil {
			dr.log.Warn("Failed to cleanup deleted dashboard", "dashboardUid", dashboard.UID, "error", err)
			break
		}
		deletedDashboardsCount++
	}

	return deletedDashboardsCount, nil
}

// -----------------------------------------------------------------------------------------
// Dashboard k8s functions
// -----------------------------------------------------------------------------------------

func (dk8s *dashk8sHandler) getClient(ctx context.Context, orgID int64) (dynamic.ResourceInterface, bool) {
	cfg := dk8s.restConfigProvider.GetRestConfig(ctx)
	if cfg == nil {
		return nil, false
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, false
	}

	return dyn.Resource(dk8s.gvr).Namespace(dk8s.getNamespace(orgID)), true
}

func (dk8s *dashk8sHandler) getNamespace(orgID int64) string {
	return dk8s.namespacer(orgID)
}

func (dk8s *dashk8sHandler) getSearcher() resource.ResourceIndexClient {
	return dk8s.searcher
}

func (dr *DashboardServiceImpl) getK8sContext(ctx context.Context) (context.Context, context.CancelFunc, error) {
	requester, requesterErr := identity.GetRequester(ctx)
	if requesterErr != nil {
		return nil, nil, requesterErr
	}

	user, exists := k8sRequest.UserFrom(ctx)
	if !exists {
		// add in k8s user if not there yet
		var ok bool
		user, ok = requester.(k8sUser.Info)
		if !ok {
			return nil, nil, fmt.Errorf("could not convert user to k8s user")
		}
	}

	newCtx := k8sRequest.WithUser(context.Background(), user)
	newCtx = log.WithContextualAttributes(newCtx, log.FromContext(ctx))
	// TODO: after GLSA token workflow is removed, make this return early
	// and move the else below to be unconditional
	if requesterErr == nil {
		newCtxWithRequester := identity.WithRequester(newCtx, requester)
		newCtx = newCtxWithRequester
	}

	// inherit the deadline from the original context, if it exists
	deadline, ok := ctx.Deadline()
	if ok {
		var newCancel context.CancelFunc
		newCtx, newCancel = context.WithTimeout(newCtx, time.Until(deadline))
		return newCtx, newCancel, nil
	}

	return newCtx, nil, nil
}

func (dr *DashboardServiceImpl) getDashboardThroughK8s(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, query.OrgID)
	if !ok {
		return nil, nil
	}

	// if including deleted dashboards for restore, use the /latest subresource
	subresource := ""
	if query.IncludeDeleted && dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesRestore) {
		subresource = "latest"
	}

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

	out, err := client.Get(newCtx, query.UID, v1.GetOptions{}, subresource)
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

	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return nil, nil
	}

	obj, err := LegacySaveCommandToUnstructured(cmd, dr.k8sclient.getNamespace(cmd.OrgID))
	if err != nil {
		return nil, err
	}

	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	if unprovision {
		delete(annotations, utils.AnnoKeyRepoName)
		delete(annotations, utils.AnnoKeyRepoPath)
		delete(annotations, utils.AnnoKeyRepoHash)
		delete(annotations, utils.AnnoKeyRepoTimestamp)
	} else {
		annotations[utils.AnnoKeyRepoName] = provisionedFileNameWithPrefix(provisioning.Name)
		annotations[utils.AnnoKeyRepoPath] = provisioning.ExternalID
		annotations[utils.AnnoKeyRepoHash] = provisioning.CheckSum
		annotations[utils.AnnoKeyRepoTimestamp] = time.Unix(provisioning.Updated, 0).UTC().Format(time.RFC3339)
	}
	obj.SetAnnotations(annotations)

	var out *unstructured.Unstructured
	current, err := client.Get(newCtx, obj.GetName(), v1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if current == nil || (err != nil && apierrors.IsNotFound(err)) {
		out, err = client.Create(newCtx, &obj, v1.CreateOptions{})
		if err != nil {
			return nil, err
		}
	} else {
		out, err = client.Update(newCtx, &obj, v1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
	}

	finalDash, err := dr.UnstructuredToLegacyDashboard(ctx, out, cmd.OrgID)
	if err != nil {
		return nil, err
	}

	return finalDash, nil
}

func (dr *DashboardServiceImpl) saveDashboardThroughK8s(ctx context.Context, cmd *dashboards.SaveDashboardCommand, orgID int64) (*dashboards.Dashboard, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return nil, nil
	}

	obj, err := LegacySaveCommandToUnstructured(cmd, dr.k8sclient.getNamespace(orgID))
	if err != nil {
		return nil, err
	}

	setPluginID(obj, cmd.PluginID)

	var out *unstructured.Unstructured
	current, err := client.Get(newCtx, obj.GetName(), v1.GetOptions{})
	if current == nil || err != nil {
		out, err = client.Create(newCtx, &obj, v1.CreateOptions{})
		if err != nil {
			return nil, err
		}
	} else {
		out, err = client.Update(newCtx, &obj, v1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
	}

	finalDash, err := dr.UnstructuredToLegacyDashboard(ctx, out, orgID)
	if err != nil {
		return nil, err
	}

	return finalDash, nil
}

func (dr *DashboardServiceImpl) deleteAllDashboardThroughK8s(ctx context.Context, orgID int64) error {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return fmt.Errorf("could not get k8s client")
	}

	err = client.DeleteCollection(newCtx, v1.DeleteOptions{}, v1.ListOptions{})
	if err != nil {
		return err
	}

	return nil
}

func (dr *DashboardServiceImpl) deleteDashboardThroughK8s(ctx context.Context, cmd *dashboards.DeleteDashboardCommand, validateProvisionedDashboard bool) error {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, cmd.OrgID)
	if !ok {
		return fmt.Errorf("could not get k8s client")
	}

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

	err = client.Delete(newCtx, cmd.UID, v1.DeleteOptions{
		GracePeriodSeconds: gracePeriod,
	})
	if err != nil {
		return err
	}

	return nil
}

func (dr *DashboardServiceImpl) listDashboardsThroughK8s(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, orgID)
	if !ok {
		return nil, nil
	}

	out, err := client.List(newCtx, v1.ListOptions{})
	if err != nil {
		return nil, err
	} else if out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	dashboards := make([]*dashboards.Dashboard, 0)
	for _, item := range out.Items {
		dash, err := dr.UnstructuredToLegacyDashboard(ctx, &item, orgID)
		if err != nil {
			return nil, err
		}
		dashboards = append(dashboards, dash)
	}

	return dashboards, nil
}

func (dr *DashboardServiceImpl) searchDashboardsThroughK8sRaw(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (*v0alpha1.SearchResults, error) {
	dashboardskey := &resource.ResourceKey{
		Namespace: dr.k8sclient.getNamespace(query.OrgId),
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key:    dashboardskey,
			Fields: []*resource.Requirement{},
			Labels: []*resource.Requirement{},
		},
		Limit: 100000}

	if len(query.DashboardUIDs) > 0 {
		request.Options.Fields = []*resource.Requirement{{
			Key:      "key.name",
			Operator: string(selection.In),
			Values:   query.DashboardUIDs,
		}}
	} else if len(query.DashboardIds) > 0 {
		values := make([]string, len(query.DashboardIds))
		for i, id := range query.DashboardIds {
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resource.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if len(query.FolderUIDs) > 0 {
		req := []*resource.Requirement{{
			Key:      "folder",
			Operator: string(selection.In),
			Values:   query.FolderUIDs,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if query.ProvisionedRepo != "" {
		req := []*resource.Requirement{{
			Key:      "repo.name",
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedRepo},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if len(query.ProvisionedReposNotIn) > 0 {
		req := []*resource.Requirement{{
			Key:      "repo.name",
			Operator: string(selection.NotIn),
			Values:   query.ProvisionedReposNotIn,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}
	if query.ProvisionedPath != "" {
		req := []*resource.Requirement{{
			Key:      "repo.path",
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedPath},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	// note: this does not allow for partial matching
	//
	// partial matching will be allowed through the api layer for the frontend,
	// but is currently not needed by other services in the backend
	if query.Title != "" {
		req := []*resource.Requirement{{
			Key:      "title",
			Operator: string(selection.In),
			Values:   []string{query.Title},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if len(query.Tags) > 0 {
		req := []*resource.Requirement{{
			Key:      "tags",
			Operator: string(selection.In),
			Values:   query.Tags,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	res, err := dr.k8sclient.getSearcher().Search(ctx, request)
	if err != nil {
		return nil, err
	}

	return ParseResults(res, 0)
}

type dashboardProvisioningWithUID struct {
	dashboards.DashboardProvisioning
	DashboardUID string
}

func (dr *DashboardServiceImpl) searchProvisionedDashboardsThroughK8s(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]*dashboardProvisioningWithUID, error) {
	ctx = identity.WithRequester(ctx, getDashboardBackgroundRequester(query.OrgId))

	if query.ProvisionedRepo != "" {
		query.ProvisionedRepo = provisionedFileNameWithPrefix(query.ProvisionedRepo)
	}

	if len(query.ProvisionedReposNotIn) > 0 {
		repos := make([]string, len(query.ProvisionedReposNotIn))
		for i, v := range query.ProvisionedReposNotIn {
			repos[i] = provisionedFileNameWithPrefix(v)
		}
		query.ProvisionedReposNotIn = repos
	}

	searchResults, err := dr.searchDashboardsThroughK8sRaw(ctx, &query)
	if err != nil {
		return nil, err
	}

	newCtx, cancel, err := dr.getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := dr.k8sclient.getClient(newCtx, query.OrgId)
	if !ok {
		return nil, nil
	}

	// loop through all hits concurrently to get the repo information (if set due to file provisioning)
	dashs := make([]*dashboardProvisioningWithUID, 0)
	var mu sync.Mutex
	g, ctx := errgroup.WithContext(ctx)
	for _, h := range searchResults.Hits {
		func(hit v0alpha1.DashboardHit) {
			g.Go(func() error {
				out, err := client.Get(ctx, hit.Name, v1.GetOptions{}, "")
				if err != nil {
					return err
				} else if out == nil {
					return dashboards.ErrDashboardNotFound
				}

				meta, err := utils.MetaAccessor(out)
				if err != nil {
					return err
				}

				// ensure the repo is set due to file provisioning, otherwise skip it
				fileRepo, found := getProvisionedFileNameFromMeta(meta)
				if !found {
					return nil
				}

				provisioning := &dashboardProvisioningWithUID{
					DashboardUID: hit.Name,
				}
				provisioning.Name = fileRepo
				provisioning.ExternalID = meta.GetRepositoryPath()
				provisioning.CheckSum = meta.GetRepositoryHash()
				provisioning.DashboardID = meta.GetDeprecatedInternalID() // nolint:staticcheck

				updated, err := meta.GetRepositoryTimestamp()
				if err != nil {
					return err
				}
				if updated != nil {
					provisioning.Updated = updated.Unix()
				}

				mu.Lock()
				dashs = append(dashs, provisioning)
				mu.Unlock()

				return nil
			})
		}(h)
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return dashs, nil
}

func (dr *DashboardServiceImpl) searchDashboardsThroughK8s(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]*dashboards.Dashboard, error) {
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

func ParseResults(result *resource.ResourceSearchResponse, offset int64) (*v0alpha1.SearchResults, error) {
	if result == nil {
		return nil, nil
	} else if result.Error != nil {
		return nil, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return nil, nil
	}

	titleIDX := 0
	folderIDX := 1
	tagsIDX := -1
	scoreIDX := 0
	explainIDX := 0

	for i, v := range result.Results.Columns {
		switch v.Name {
		case resource.SEARCH_FIELD_EXPLAIN:
			explainIDX = i
		case resource.SEARCH_FIELD_SCORE:
			scoreIDX = i
		case "title":
			titleIDX = i
		case "folder":
			folderIDX = i
		case "tags":
			tagsIDX = i
		}
	}

	sr := &v0alpha1.SearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.DashboardHit, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		hit := &v0alpha1.DashboardHit{
			Resource: row.Key.Resource, // folders | dashboards
			Name:     row.Key.Name,     // The Grafana UID
			Title:    string(row.Cells[titleIDX]),
			Folder:   string(row.Cells[folderIDX]),
		}
		if tagsIDX > 0 && row.Cells[tagsIDX] != nil {
			_ = json.Unmarshal(row.Cells[tagsIDX], &hit.Tags)
		}
		if explainIDX > 0 && row.Cells[explainIDX] != nil {
			_ = json.Unmarshal(row.Cells[explainIDX], &hit.Explain)
		}
		if scoreIDX > 0 && row.Cells[scoreIDX] != nil {
			_, _ = binary.Decode(row.Cells[scoreIDX], binary.BigEndian, &hit.Score)
		}

		sr.Hits[i] = *hit
	}

	// Add facet results
	if result.Facet != nil {
		sr.Facets = make(map[string]v0alpha1.FacetResult)
		for k, v := range result.Facet {
			sr.Facets[k] = v0alpha1.FacetResult{
				Field:   v.Field,
				Total:   v.Total,
				Missing: v.Missing,
				Terms:   make([]v0alpha1.TermFacet, len(v.Terms)),
			}
			for j, t := range v.Terms {
				sr.Facets[k].Terms[j] = v0alpha1.TermFacet{
					Term:  t.Term,
					Count: t.Count,
				}
			}
		}
	}

	return sr, nil
}

func (dr *DashboardServiceImpl) UnstructuredToLegacyDashboard(ctx context.Context, item *unstructured.Unstructured, orgID int64) (*dashboards.Dashboard, error) {
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

	dashVersion := 0
	if version, ok := spec["version"].(int64); ok {
		dashVersion = int(version)
	}

	out := dashboards.Dashboard{
		OrgID:     orgID,
		ID:        obj.GetDeprecatedInternalID(), // nolint:staticcheck
		UID:       uid,
		Slug:      obj.GetSlug(),
		FolderUID: obj.GetFolder(),
		Version:   dashVersion,
		Data:      simplejson.NewFromAny(spec),
	}

	out.Created = obj.GetCreationTimestamp().Time
	updated, err := obj.GetUpdatedTimestamp()
	if err == nil && updated != nil {
		out.Updated = *updated
	} else {
		// by default, set updated to created
		out.Updated = out.Created
	}

	deleted := obj.GetDeletionTimestamp()
	if deleted != nil {
		out.Deleted = obj.GetDeletionTimestamp().Time
	}

	out.PluginID = GetPluginIDFromMeta(obj)

	creator, err := dr.getUserFromMeta(ctx, obj.GetCreatedBy())
	if err != nil {
		return nil, err
	}
	out.CreatedBy = creator.ID

	updater, err := dr.getUserFromMeta(ctx, obj.GetUpdatedBy())
	if err != nil {
		return nil, err
	}
	out.UpdatedBy = updater.ID

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

func (dr *DashboardServiceImpl) getUserFromMeta(ctx context.Context, userMeta string) (*user.User, error) {
	if userMeta == "" || toUID(userMeta) == "" {
		return &user.User{}, nil
	}
	usr, err := dr.getUser(ctx, toUID(userMeta))
	if err != nil && errors.Is(err, user.ErrUserNotFound) {
		return &user.User{}, nil
	}
	return usr, err
}

func (dr *DashboardServiceImpl) getUser(ctx context.Context, uid string) (*user.User, error) {
	userId, err := strconv.ParseInt(uid, 10, 64)
	if err == nil {
		return dr.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userId})
	}
	return dr.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: uid})
}

var pluginIDRepoName = "plugin"
var fileProvisionedRepoPrefix = "file:"

func setPluginID(obj unstructured.Unstructured, pluginID string) {
	if pluginID == "" {
		return
	}

	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[utils.AnnoKeyRepoName] = pluginIDRepoName
	annotations[utils.AnnoKeyRepoPath] = pluginID
	obj.SetAnnotations(annotations)
}

func provisionedFileNameWithPrefix(name string) string {
	if name == "" {
		return ""
	}

	return fileProvisionedRepoPrefix + name
}

func getProvisionedFileNameFromMeta(obj utils.GrafanaMetaAccessor) (string, bool) {
	return strings.CutPrefix(obj.GetRepositoryName(), fileProvisionedRepoPrefix)
}

func GetPluginIDFromMeta(obj utils.GrafanaMetaAccessor) string {
	if obj.GetRepositoryName() == pluginIDRepoName {
		return obj.GetRepositoryPath()
	}
	return ""
}

func LegacySaveCommandToUnstructured(cmd *dashboards.SaveDashboardCommand, namespace string) (unstructured.Unstructured, error) {
	uid := cmd.GetDashboardModel().UID
	if uid == "" {
		uid = uuid.NewString()
	}

	finalObj := unstructured.Unstructured{
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
	finalObj.SetGroupVersionKind(v0alpha1.DashboardResourceInfo.GroupVersionKind())

	return finalObj, nil
}

func toUID(rawIdentifier string) string {
	parts := strings.Split(rawIdentifier, ":")
	if len(parts) < 2 {
		return ""
	}
	return parts[1]
}
