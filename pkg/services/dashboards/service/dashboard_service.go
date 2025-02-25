package service

import (
	"context"
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
	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util"
)

var (
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService             = (*DashboardServiceImpl)(nil)
	_ dashboards.DashboardProvisioningService = (*DashboardServiceImpl)(nil)
	_ dashboards.PluginService                = (*DashboardServiceImpl)(nil)

	daysInTrash = 24 * 30 * time.Hour
	tracer      = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards/service")
)

type DashboardServiceImpl struct {
	cfg                    *setting.Cfg
	log                    log.Logger
	dashboardStore         dashboards.Store
	folderStore            folder.FolderStore
	folderService          folder.Service
	orgService             org.Service
	features               featuremgmt.FeatureToggles
	folderPermissions      accesscontrol.FolderPermissionsService
	dashboardPermissions   accesscontrol.DashboardPermissionsService
	ac                     accesscontrol.AccessControl
	k8sclient              client.K8sHandler
	metrics                *dashboardsMetrics
	publicDashboardService publicdashboards.ServiceWrapper

	dashboardPermissionsReady chan struct{}
}

var _ dashboards.PermissionsRegistrationService = (*DashboardServiceImpl)(nil)

// This is the uber service that implements a three smaller services
func ProvideDashboardServiceImpl(
	cfg *setting.Cfg, dashboardStore dashboards.Store, folderStore folder.FolderStore,
	features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	ac accesscontrol.AccessControl, folderSvc folder.Service, fStore folder.Store, r prometheus.Registerer,
	restConfigProvider apiserver.RestConfigProvider, userService user.Service,
	quotaService quota.Service, orgService org.Service, publicDashboardService publicdashboards.ServiceWrapper,
	resourceClient resource.ResourceClient, dual dualwrite.Service, sorter sort.Service,
) (*DashboardServiceImpl, error) {
	k8sHandler := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), dashboardv0alpha1.DashboardResourceInfo.GroupVersionResource(), restConfigProvider.GetRestConfig, dashboardStore, userService, resourceClient, sorter)

	dashSvc := &DashboardServiceImpl{
		cfg:                       cfg,
		log:                       log.New("dashboard-service"),
		dashboardStore:            dashboardStore,
		features:                  features,
		folderPermissions:         folderPermissionsService,
		ac:                        ac,
		folderStore:               folderStore,
		folderService:             folderSvc,
		orgService:                orgService,
		k8sclient:                 k8sHandler,
		metrics:                   newDashboardsMetrics(r),
		dashboardPermissionsReady: make(chan struct{}),
		publicDashboardService:    publicDashboardService,
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

func (dr *DashboardServiceImpl) CountDashboardsInOrg(ctx context.Context, orgID int64) (int64, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		resp, err := dr.k8sclient.GetStats(ctx, orgID)
		if err != nil {
			return 0, err
		}

		if len(resp.Stats) != 1 {
			return 0, fmt.Errorf("expected 1 stat, got %d", len(resp.Stats))
		}

		return resp.Stats[0].Count, nil
	}

	return dr.dashboardStore.CountInOrg(ctx, orgID)
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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
					res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		if dashboardUID == "" {
			return nil, nil
		}

		res, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
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

	if len(dto.Message) > 500 {
		return nil, dashboards.ErrDashboardMessageTooLong
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) && (dash.FolderID != 0 || dash.FolderUID != "") { // nolint:staticcheck
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
	} else if dash.FolderUID != "" {
		folder, err := dr.folderStore.GetFolderByUID(ctx, dash.OrgID, dash.FolderUID)
		if err != nil {
			return nil, err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		dash.FolderID = folder.ID
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		// check each org for orphaned provisioned dashboards
		orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return err
		}

		for _, org := range orgs {
			ctx, _ := identity.WithServiceIdentity(ctx, org.ID)
			// find all dashboards in the org that have a file repo set that is not in the given readers list
			foundDashs, err := dr.searchProvisionedDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
				ProvisionedReposNotIn: cmd.ReaderNames,
				OrgId:                 org.ID,
			})
			if err != nil {
				return err
			}

			// delete them
			for _, foundDash := range foundDashs {
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
		guard, err := guardian.NewByFolder(ctx, &folder.Folder{
			ID:    d.FolderID, // nolint:staticcheck
			OrgID: d.OrgID,
		}, d.OrgID, user)
		if err != nil {
			return nil, err
		}
		return guard, nil
	}

	if d.IsFolder {
		guard, err := guardian.NewByFolder(ctx, &folder.Folder{
			ID:    d.ID, // nolint:staticcheck
			UID:   d.UID,
			OrgID: d.OrgID,
		}, d.OrgID, user)
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

	ctx, ident := identity.WithServiceIdentity(ctx, dto.OrgID)
	dto.User = ident

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false)
	if err != nil {
		return nil, err
	}

	var dash *dashboards.Dashboard
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

	ctx, ident := identity.WithServiceIdentity(ctx, dto.OrgID)
	dto.SignedInUser = ident

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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		return dr.saveDashboardThroughK8s(ctx, cmd, cmd.OrgID)
	}

	return dr.dashboardStore.SaveDashboard(ctx, *cmd)
}

func (dr *DashboardServiceImpl) GetSoftDeletedDashboard(ctx context.Context, orgID int64, uid string) (*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		return dr.deleteAllDashboardThroughK8s(ctx, orgId)
	}

	return dr.dashboardStore.DeleteAllDashboards(ctx, orgId)
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

	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		err := dr.deleteDashboardThroughK8s(ctx, cmd, validateProvisionedDashboard)
		if err != nil {
			return err
		}

		// cleanup things related to dashboards that are not stored in unistore yet
		err = dr.publicDashboardService.DeleteByDashboardUIDs(ctx, orgId, []string{dashboardUID})
		if err != nil {
			return err
		}

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

	// deletes all related public dashboard entities
	err := dr.publicDashboardService.DeleteByDashboardUIDs(ctx, orgId, []string{dashboardUID})
	if err != nil {
		return err
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

			return err
		}

		return dashboards.ErrDashboardNotFound
	}

	return dr.dashboardStore.UnprovisionDashboard(ctx, dashboardId)
}

func (dr *DashboardServiceImpl) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			OrgId:           query.OrgID,
			ProvisionedRepo: dashboard.PluginIDRepoName,
			ProvisionedPath: query.PluginID,
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
}

func (dr *DashboardServiceImpl) setDefaultFolderPermissions(ctx context.Context, cmd *folder.CreateFolderCommand, f *folder.Folder, provisioned bool) {
	ctx, span := tracer.Start(ctx, "dashboards.service.setDefaultFolderPermissions")
	defer span.End()

	if !dr.cfg.RBAC.PermissionsOnCreation("folder") {
		return
	}

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

	if f.ParentUID == "" {
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		return dr.getDashboardThroughK8s(ctx, query)
	}

	return dr.dashboardStore.GetDashboard(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

		return &dashboards.DashboardRef{UID: result[0].UID, Slug: result[0].Slug}, nil
	}

	return dr.dashboardStore.GetDashboardUIDByID(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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

	if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesClientDashboardsFolders) {
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
			result := dashboards.DashboardSearchProjection{
				ID:          hit.Field.GetNestedInt64(search.DASHBOARD_LEGACY_ID),
				UID:         hit.Name,
				OrgID:       query.OrgId,
				Title:       hit.Title,
				Slug:        slugify.Slugify(hit.Title),
				IsFolder:    false,
				FolderUID:   hit.Folder,
				FolderTitle: folderNames[hit.Folder],
				Tags:        hit.Tags,
			}

			if hit.Resource == folderv0alpha1.RESOURCE {
				result.IsFolder = true
			}

			finalResults[i] = result
		}

		return finalResults, nil
	}

	return dr.dashboardStore.FindDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) fetchFolderNames(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery, hits []dashboardv0alpha1.DashboardHit) (map[string]string, error) {
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

	folderNames := make(map[string]string)
	for _, f := range folders {
		folderNames[f.UID] = f.Title
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

func (dr *DashboardServiceImpl) GetAllDashboards(ctx context.Context) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		return dr.listDashboardsThroughK8s(ctx, requester.GetOrgID())
	}

	return dr.dashboardStore.GetAllDashboards(ctx)
}

func (dr *DashboardServiceImpl) GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error) {
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
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
	if dr.features.IsEnabled(ctx, featuremgmt.FlagKubernetesClientDashboardsFolders) {
		res, err := dr.k8sclient.Search(ctx, query.OrgID, &resource.ResourceSearchRequest{
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
	if dr.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		dashs, err := dr.searchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			OrgId:      orgID,
			FolderUIDs: folderUIDs,
		})
		if err != nil {
			return 0, err
		}

		return int64(len(dashs)), nil
	}

	return dr.dashboardStore.CountDashboardsInFolders(ctx, &dashboards.CountDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.DeleteInFolders")
	defer span.End()

	if dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return dr.dashboardStore.SoftDeleteDashboardsInFolders(ctx, orgID, folderUIDs)
	}

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

func (dr *DashboardServiceImpl) getDashboardThroughK8s(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
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

	out, err := dr.k8sclient.Get(ctx, query.UID, query.OrgID, v1.GetOptions{}, subresource)
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
		annotations[utils.AnnoKeyRepoName] = dashboard.ProvisionedFileNameWithPrefix(provisioning.Name)
		annotations[utils.AnnoKeyRepoPath] = provisioning.ExternalID
		annotations[utils.AnnoKeyRepoHash] = provisioning.CheckSum
		annotations[utils.AnnoKeyRepoTimestamp] = time.Unix(provisioning.Updated, 0).UTC().Format(time.RFC3339)
	}
	obj.SetAnnotations(annotations)

	out, err := dr.createOrUpdateDash(ctx, obj, cmd.OrgID)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (dr *DashboardServiceImpl) saveDashboardThroughK8s(ctx context.Context, cmd *dashboards.SaveDashboardCommand, orgID int64) (*dashboards.Dashboard, error) {
	obj, err := LegacySaveCommandToUnstructured(cmd, dr.k8sclient.GetNamespace(orgID))
	if err != nil {
		return nil, err
	}

	dashboard.SetPluginIDMeta(obj, cmd.PluginID)

	out, err := dr.createOrUpdateDash(ctx, obj, orgID)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (dr *DashboardServiceImpl) createOrUpdateDash(ctx context.Context, obj unstructured.Unstructured, orgID int64) (*dashboards.Dashboard, error) {
	var out *unstructured.Unstructured
	current, err := dr.k8sclient.Get(ctx, obj.GetName(), orgID, v1.GetOptions{})
	if current == nil || err != nil {
		out, err = dr.k8sclient.Create(ctx, &obj, orgID)
		if err != nil {
			return nil, err
		}
	} else {
		out, err = dr.k8sclient.Update(ctx, &obj, orgID)
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
	out, err := dr.k8sclient.List(ctx, orgID, v1.ListOptions{})
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

func (dr *DashboardServiceImpl) searchDashboardsThroughK8sRaw(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (dashboardv0alpha1.SearchResults, error) {
	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Fields: []*resource.Requirement{},
			Labels: []*resource.Requirement{},
		},
		Limit: 100000}

	if len(query.DashboardUIDs) > 0 {
		request.Options.Fields = []*resource.Requirement{{
			Key:      resource.SEARCH_FIELD_NAME,
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
		// Grafana frontend issues a call to search for dashboards in "general" folder. General folder doesn't exists and
		// should return all dashboards without a parent folder.
		// We do something similar in the old sql search query https://github.com/grafana/grafana/blob/a58564a35efe8c05a21d8190b283af5bc0979d2a/pkg/services/sqlstore/searchstore/filters.go#L103
		for i := range query.FolderUIDs {
			if query.FolderUIDs[i] == folder.GeneralFolderUID {
				query.FolderUIDs[i] = ""
				break
			}
		}

		req := []*resource.Requirement{{
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

		request.Options.Labels = append(request.Options.Labels, &resource.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if query.ProvisionedRepo != "" {
		req := []*resource.Requirement{{
			Key:      resource.SEARCH_FIELD_REPOSITORY_NAME,
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedRepo},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if len(query.ProvisionedReposNotIn) > 0 {
		req := []*resource.Requirement{{
			Key:      resource.SEARCH_FIELD_REPOSITORY_NAME,
			Operator: string(selection.NotIn),
			Values:   query.ProvisionedReposNotIn,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}
	if query.ProvisionedPath != "" {
		req := []*resource.Requirement{{
			Key:      resource.SEARCH_FIELD_REPOSITORY_PATH,
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedPath},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if query.Title != "" {
		// allow wildcard search
		request.Query = "*" + strings.ToLower(query.Title) + "*"
		// if using query, you need to specify the fields you want
		request.Fields = dashboardsearch.IncludeFields
	}

	if len(query.Tags) > 0 {
		req := []*resource.Requirement{{
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

	namespace := dr.k8sclient.GetNamespace(query.OrgId)
	var err error
	var federate *resource.ResourceKey
	switch query.Type {
	case "":
		// When no type specified, search for dashboards
		request.Options.Key, err = resource.AsResourceKey(namespace, dashboard.DASHBOARD_RESOURCE)
		// Currently a search query is across folders and dashboards
		if err == nil {
			federate, err = resource.AsResourceKey(namespace, folderv0alpha1.RESOURCE)
		}
	case searchstore.TypeDashboard, searchstore.TypeAnnotation:
		request.Options.Key, err = resource.AsResourceKey(namespace, dashboard.DASHBOARD_RESOURCE)
	case searchstore.TypeFolder, searchstore.TypeAlertFolder:
		request.Options.Key, err = resource.AsResourceKey(namespace, folderv0alpha1.RESOURCE)
	default:
		err = fmt.Errorf("bad type request")
	}

	if err != nil {
		return dashboardv0alpha1.SearchResults{}, err
	}

	if federate != nil {
		request.Federated = []*resource.ResourceKey{federate}
	}

	// technically, there exists the ability to register multiple ways of sorting using the legacy database
	// see RegisterSortOption in pkg/services/search/sorting.go
	// however, it doesn't look like we are taking advantage of that. And since by default the legacy
	// sql will sort by title ascending, we only really need to handle the "alpha-desc" case
	if query.Sort.Name == "alpha-desc" {
		request.SortBy = append(request.SortBy, &resource.ResourceSearchRequest_Sort{Field: resource.SEARCH_FIELD_TITLE, Desc: true})
	}

	res, err := dr.k8sclient.Search(ctx, query.OrgId, request)
	if err != nil {
		return dashboardv0alpha1.SearchResults{}, err
	}

	return dashboardsearch.ParseResults(res, 0)
}

type dashboardProvisioningWithUID struct {
	dashboards.DashboardProvisioning
	DashboardUID string
}

func (dr *DashboardServiceImpl) searchProvisionedDashboardsThroughK8s(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]*dashboardProvisioningWithUID, error) {
	if query == nil {
		return nil, errors.New("query cannot be nil")
	}

	ctx, _ = identity.WithServiceIdentity(ctx, query.OrgId)

	if query.ProvisionedRepo != "" {
		query.ProvisionedRepo = dashboard.ProvisionedFileNameWithPrefix(query.ProvisionedRepo)
	}

	if len(query.ProvisionedReposNotIn) > 0 {
		repos := make([]string, len(query.ProvisionedReposNotIn))
		for i, v := range query.ProvisionedReposNotIn {
			repos[i] = dashboard.ProvisionedFileNameWithPrefix(v)
		}
		query.ProvisionedReposNotIn = repos
	}

	query.Type = searchstore.TypeDashboard

	searchResults, err := dr.searchDashboardsThroughK8sRaw(ctx, query)
	if err != nil {
		return nil, err
	}

	// loop through all hits concurrently to get the repo information (if set due to file provisioning)
	dashs := make([]*dashboardProvisioningWithUID, 0)
	var mu sync.Mutex
	g, ctx := errgroup.WithContext(ctx)
	for _, h := range searchResults.Hits {
		func(hit dashboardv0alpha1.DashboardHit) {
			g.Go(func() error {
				out, err := dr.k8sclient.Get(ctx, hit.Name, query.OrgId, v1.GetOptions{})
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
				fileRepo, found := dashboard.GetProvisionedFileNameFromMeta(meta.GetRepositoryName())
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

	out.PluginID = dashboard.GetPluginIDFromMeta(obj)

	creator, err := dr.k8sclient.GetUserFromMeta(ctx, obj.GetCreatedBy())
	if err != nil {
		return nil, err
	}
	out.CreatedBy = creator.ID

	updater, err := dr.k8sclient.GetUserFromMeta(ctx, obj.GetUpdatedBy())
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
	finalObj.SetGroupVersionKind(dashboardv0alpha1.DashboardResourceInfo.GroupVersionKind())

	meta, err := utils.MetaAccessor(&finalObj)
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

func getFolderUIDs(hits []dashboardv0alpha1.DashboardHit) []string {
	folderSet := map[string]bool{}
	for _, hit := range hits {
		if hit.Folder != "" && !folderSet[hit.Folder] {
			folderSet[hit.Folder] = true
		}
	}
	return maps.Keys(folderSet)
}
