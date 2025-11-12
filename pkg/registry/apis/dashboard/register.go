package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/dynamic"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	internal "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

var (
	_ builder.APIGroupBuilder          = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor     = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider    = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupMutation         = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupValidation       = (*DashboardsAPIBuilder)(nil)
)

const (
	dashboardSpecTitle           = "title"
	dashboardSpecRefreshInterval = "refresh"
)

type simpleFolderClientProvider struct {
	handler client.K8sHandler
}

func newSimpleFolderClientProvider(handler client.K8sHandler) client.K8sHandlerProvider {
	return &simpleFolderClientProvider{handler: handler}
}

func (p *simpleFolderClientProvider) GetOrCreateHandler(namespace string) client.K8sHandler {
	return p.handler
}

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService
	features         featuremgmt.FeatureToggles

	accessControl                accesscontrol.AccessControl
	accessClient                 authlib.AccessClient
	legacy                       *DashboardStorage
	unified                      resource.ResourceClient
	dashboardProvisioningService dashboards.DashboardProvisioningService
	dashboardPermissions         dashboards.PermissionsRegistrationService
	dashboardPermissionsSvc      accesscontrol.DashboardPermissionsService // TODO: once kubernetesAuthzResourcePermissionApis is enabled, rely solely on resourcePermissionsSvc and add integration test afterDelete hook
	resourcePermissionsSvc       *dynamic.NamespaceableResourceInterface
	scheme                       *runtime.Scheme
	search                       *SearchHandler
	dashStore                    dashboards.Store
	QuotaService                 quota.Service
	ProvisioningService          provisioning.ProvisioningService
	minRefreshInterval           string
	dualWriter                   dualwrite.Service
	folderClientProvider         client.K8sHandlerProvider
	libraryPanels                libraryelements.Service // for legacy library panels
	publicDashboardService       publicdashboards.Service
	snapshotService              dashboardsnapshots.Service
	snapshotOptions              snapshot.SharingOptionGetter
	namespacer                   request.NamespaceMapper
	isStandalone                 bool // skips any handling including anything to do with legacy storage
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	provisioningDashboardService dashboards.DashboardProvisioningService,
	datasourceService datasources.DataSourceService,
	dashboardPermissions dashboards.PermissionsRegistrationService,
	dashboardPermissionsSvc accesscontrol.DashboardPermissionsService,
	accessControl accesscontrol.AccessControl,
	accessClient authlib.AccessClient,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
	dual dualwrite.Service,
	sorter sort.Service,
	quotaService quota.Service,
	libraryPanelSvc librarypanels.Service,
	restConfigProvider apiserver.RestConfigProvider,
	userService user.Service,
	libraryPanels libraryelements.Service,
	publicDashboardService publicdashboards.Service,
	snapshotService dashboardsnapshots.Service,
) *DashboardsAPIBuilder {
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	legacyDashboardSearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	folderClient := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), folders.FolderResourceInfo.GroupVersionResource(), restConfigProvider.GetRestConfig, dashStore, userService, unified, sorter, features)

	builder := &DashboardsAPIBuilder{
		dashboardService:             dashboardService,
		dashboardPermissions:         dashboardPermissions,
		dashboardPermissionsSvc:      dashboardPermissionsSvc,
		features:                     features,
		accessControl:                accessControl,
		accessClient:                 accessClient,
		unified:                      unified,
		dashboardProvisioningService: provisioningDashboardService,
		search:                       NewSearchHandler(tracing, dual, legacyDashboardSearcher, unified, features),
		dashStore:                    dashStore,
		QuotaService:                 quotaService,
		ProvisioningService:          provisioning,
		minRefreshInterval:           cfg.MinRefreshInterval,
		dualWriter:                   dual,
		folderClientProvider:         newSimpleFolderClientProvider(folderClient),
		libraryPanels:                libraryPanels,
		publicDashboardService:       publicDashboardService,
		snapshotService:              snapshotService,
		snapshotOptions:              snapshot.NewSharingOptionGetter(cfg),
		namespacer:                   namespacer,
		legacy: &DashboardStorage{
			Access:           legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, libraryPanelSvc, sorter, dashboardPermissionsSvc, accessControl, features),
			DashboardService: dashboardService,
		},
	}

	migration.RegisterMetrics(reg)
	migration.Initialize(&datasourceInfoProvider{
		datasourceService: datasourceService,
	})
	apiregistration.RegisterAPI(builder)
	return builder
}

func NewAPIService(ac authlib.AccessClient, features featuremgmt.FeatureToggles, folderClientProvider client.K8sHandlerProvider, datasourceProvider schemaversion.DataSourceInfoProvider, resourcePermissionsSvc *dynamic.NamespaceableResourceInterface) *DashboardsAPIBuilder {
	migration.Initialize(datasourceProvider)
	return &DashboardsAPIBuilder{
		minRefreshInterval:     "10s",
		accessClient:           ac,
		features:               features,
		dashboardService:       &dashsvc.DashboardServiceImpl{}, // for validation helpers only
		folderClientProvider:   folderClientProvider,
		resourcePermissionsSvc: resourcePermissionsSvc,
		isStandalone:           true,
	}
}

func (b *DashboardsAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	if featuremgmt.AnyEnabled(b.features, featuremgmt.FlagDashboardNewLayouts) {
		// If dashboards v2 is enabled, we want to use v2beta1 as the default API version.
		return []schema.GroupVersion{
			dashv2beta1.DashboardResourceInfo.GroupVersion(),
			dashv2alpha1.DashboardResourceInfo.GroupVersion(),
			dashv0.DashboardResourceInfo.GroupVersion(),
			dashv1.DashboardResourceInfo.GroupVersion(),
		}
	}

	return []schema.GroupVersion{
		dashv1.DashboardResourceInfo.GroupVersion(),
		dashv0.DashboardResourceInfo.GroupVersion(),
		dashv2beta1.DashboardResourceInfo.GroupVersion(),
		dashv2alpha1.DashboardResourceInfo.GroupVersion(),
	}
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	b.scheme = scheme
	if err := dashv0.AddToScheme(scheme); err != nil {
		return err
	}
	if err := dashv1.AddToScheme(scheme); err != nil {
		return err
	}
	if err := dashv2alpha1.AddToScheme(scheme); err != nil {
		return err
	}

	if err := dashv2beta1.AddToScheme(scheme); err != nil {
		return err
	}

	// Register the explicit conversions
	if err := conversion.RegisterConversions(scheme, migration.GetDataSourceInfoProvider()); err != nil {
		return err
	}

	return scheme.SetVersionPriority(b.GetGroupVersions()...)
}

func (b *DashboardsAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{
		dashv0.DashboardKind().Plural(),
		dashv0.LIBRARY_PANEL_RESOURCE,
		dashv0.SNAPSHOT_RESOURCE,
	}
}

// Validate validates dashboard operations for the apiserver
func (b *DashboardsAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

	switch a.GetResource().Resource {
	case dashv0.DASHBOARD_RESOURCE:
		// Handle different operations
		switch op {
		case admission.Delete:
			return b.validateDelete(ctx, a)
		case admission.Create:
			return b.validateCreate(ctx, a, o)
		case admission.Update:
			return b.validateUpdate(ctx, a, o)
		case admission.Connect:
			return nil
		}

	case dashv0.LIBRARY_PANEL_RESOURCE:
		return nil // OK for now
	case dashv0.SNAPSHOT_RESOURCE:
		return nil // OK for now
	}

	return fmt.Errorf("unsupported validation: %+v", a.GetResource())
}

// validateDelete checks if a dashboard can be deleted
func (b *DashboardsAPIBuilder) validateDelete(ctx context.Context, a admission.Attributes) error {
	obj := a.GetOperationOptions()
	deleteOptions, ok := obj.(*metav1.DeleteOptions)
	if !ok {
		return fmt.Errorf("expected v1.DeleteOptions")
	}

	// Skip validation for forced deletions (grace period = 0)
	if deleteOptions.GracePeriodSeconds != nil && *deleteOptions.GracePeriodSeconds == 0 {
		return nil
	}

	nsInfo, err := authlib.ParseNamespace(a.GetNamespace())
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to parse namespace", err)
	}

	// HACK: deletion validation currently doesn't work for the standalone case. So we currently skip it.
	if b.isStandalone && util.IsInterfaceNil(b.dashboardProvisioningService) {
		return nil
	}

	// The name of the resource is the dashboard UID
	dashboardUID := a.GetName()

	provisioningData, err := b.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(ctx, nsInfo.OrgID, dashboardUID)
	if err != nil {
		if errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) ||
			errors.Is(err, dashboards.ErrDashboardNotFound) ||
			apierrors.IsNotFound(err) {
			return nil
		}

		return fmt.Errorf("%v: %w", "delete hook failed to check if dashboard is provisioned", err)
	}

	if provisioningData != nil {
		return apierrors.NewBadRequest(dashboards.ErrDashboardCannotDeleteProvisionedDashboard.Reason)
	}

	return nil
}

// validateCreate validates dashboard creation
func (b *DashboardsAPIBuilder) validateCreate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	// Get the dashboard object
	dashObj := a.GetObject()

	title, refresh, err := getDashboardProperties(dashObj)
	if err != nil {
		return fmt.Errorf("error extracting dashboard properties: %w", err)
	}

	accessor, err := utils.MetaAccessor(dashObj)
	if err != nil {
		return fmt.Errorf("error getting meta accessor: %w", err)
	}

	// Basic validations
	if err := b.dashboardService.ValidateBasicDashboardProperties(title, accessor.GetName(), accessor.GetMessage()); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshInterval, refresh); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	id, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("error getting requester: %w", err)
	}

	// Validate folder existence if specified
	if !a.IsDryRun() && accessor.GetFolder() != "" {
		folder, err := b.validateFolderExists(ctx, accessor.GetFolder(), id.GetOrgID())
		if err != nil {
			return err
		}

		if err := b.validateFolderManagedBySameManager(folder, accessor); err != nil {
			return apierrors.NewBadRequest(err.Error())
		}
	}

	// Validate quota
	if !b.isStandalone && !a.IsDryRun() {
		params := &quota.ScopeParameters{}
		params.OrgID = id.GetOrgID()
		internalId, err := id.GetInternalID()
		if err == nil {
			params.UserID = internalId
		}

		quotaReached, err := b.QuotaService.CheckQuotaReached(ctx, dashboards.QuotaTargetSrv, params)
		if err != nil && !errors.Is(err, quota.ErrDisabled) {
			return err
		}
		if quotaReached {
			return apierrors.NewForbidden(dashv1.DashboardResourceInfo.GroupResource(), a.GetName(), dashboards.ErrQuotaReached)
		}
	}

	return nil
}

// validateUpdate validates dashboard updates
func (b *DashboardsAPIBuilder) validateUpdate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	// Get the new and old dashboards
	newDashObj := a.GetObject()
	oldDashObj := a.GetOldObject()

	title, refresh, err := getDashboardProperties(newDashObj)
	if err != nil {
		return fmt.Errorf("error extracting dashboard properties: %w", err)
	}

	oldAccessor, err := utils.MetaAccessor(oldDashObj)
	if err != nil {
		return fmt.Errorf("error getting old dash meta accessor: %w", err)
	}

	newAccessor, err := utils.MetaAccessor(newDashObj)
	if err != nil {
		return fmt.Errorf("error getting new dash meta accessor: %w", err)
	}

	// Parse namespace for old dashboard
	nsInfo, err := authlib.ParseNamespace(oldAccessor.GetNamespace())
	if err != nil {
		return fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Basic validations
	if err := b.dashboardService.ValidateBasicDashboardProperties(title, newAccessor.GetName(), newAccessor.GetMessage()); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	// Validate folder existence if specified and changed
	if !a.IsDryRun() && newAccessor.GetFolder() != oldAccessor.GetFolder() && newAccessor.GetFolder() != "" {
		id, err := identity.GetRequester(ctx)
		if err != nil {
			return fmt.Errorf("error getting requester: %w", err)
		}

		if err := b.verifyFolderAccessPermissions(ctx, id, newAccessor.GetFolder()); err != nil {
			return err
		}

		folder, err := b.validateFolderExists(ctx, newAccessor.GetFolder(), nsInfo.OrgID)
		if err != nil {
			return apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), newAccessor.GetFolder())
		}

		if err := b.validateFolderManagedBySameManager(folder, newAccessor); err != nil {
			return err
		}
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshInterval, refresh); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	return nil
}

// validateFolderExists checks if a folder exists
func (b *DashboardsAPIBuilder) validateFolderExists(ctx context.Context, folderUID string, orgID int64) (*unstructured.Unstructured, error) {
	ns, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return nil, err
	}
	folderClient := b.folderClientProvider.GetOrCreateHandler(ns.Value)
	folder, err := folderClient.Get(ctx, folderUID, orgID, metav1.GetOptions{})
	// Check if the error is a context deadline exceeded error
	if err != nil {
		// historically, we returned a more verbose error with folder name when its not found, below just keeps that behavior
		if apierrors.IsNotFound(err) {
			return nil, apierrors.NewNotFound(folders.FolderResourceInfo.GroupResource(), folderUID)
		}

		return nil, err
	}

	return folder, nil
}

// validation should fail if:
// 1. The parent folder is managed but this dashboard is not
// 2. The parent folder is managed by a different repository than this dashboard
func (b *DashboardsAPIBuilder) validateFolderManagedBySameManager(folder *unstructured.Unstructured, dashboardAccessor utils.GrafanaMetaAccessor) error {
	folderAccessor, err := utils.MetaAccessor(folder)
	if err != nil {
		return fmt.Errorf("error getting meta accessor: %w", err)
	}

	if folderManager, ok := folderAccessor.GetManagerProperties(); ok && folderManager.Kind == utils.ManagerKindRepo {
		manager, ok := dashboardAccessor.GetManagerProperties()
		if !ok {
			return fmt.Errorf("folder is managed by a repository, but the dashboard is not managed")
		}
		if manager.Kind != utils.ManagerKindRepo || manager.Identity != folderManager.Identity {
			return fmt.Errorf("folder is managed by a repository, but the dashboard is not managed by the same manager")
		}
	}

	return nil
}

// getDashboardProperties extracts title and refresh interval from any dashboard version
func getDashboardProperties(obj runtime.Object) (string, string, error) {
	var title, refresh string

	// Extract properties based on the object's type
	switch d := obj.(type) {
	case *dashv0.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *dashv1.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *dashv2alpha1.Dashboard:
		title = d.Spec.Title
		refresh = d.Spec.TimeSettings.AutoRefresh
	case *dashv2beta1.Dashboard:
		title = d.Spec.Title
		refresh = d.Spec.TimeSettings.AutoRefresh
	default:
		return "", "", fmt.Errorf("unsupported dashboard version: %T", obj)
	}

	return title, refresh, nil
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storageOpts := apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
	}

	// TODO: merge this into one option
	if b.isStandalone {
		// TODO: Sets default root permissions
	} else {
		// Sets default root permissions
		storageOpts.Permissions = b.dashboardPermissions.SetDefaultPermissionsAfterCreate
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	//nolint:staticcheck // not yet migrated to OpenFeature
	if b.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = NewDashboardLargeObjectSupport(opts.Scheme, opts.StorageOpts.BlobThresholdBytes)
		storageOpts.LargeObjectSupport = largeObjects
	}
	opts.StorageOptsRegister(dashv0.DashboardResourceInfo.GroupResource(), storageOpts)

	// v0alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		dashv0.DashboardResourceInfo,
		&dashv0.LibraryPanelResourceInfo,
		&dashv0.SnapshotResourceInfo,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &dashv0.DashboardWithAccessInfo{}
			dash, ok := obj.(*dashv0.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	// v1alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		dashv1.DashboardResourceInfo,
		nil, // do not register library panel
		nil,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &dashv1.DashboardWithAccessInfo{}
			dash, ok := obj.(*dashv1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	// v2alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		dashv2alpha1.DashboardResourceInfo,
		nil, // do not register library panel
		nil,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &dashv2alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*dashv2alpha1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		dashv2beta1.DashboardResourceInfo,
		nil, // do not register library panel
		nil,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &dashv2beta1.DashboardWithAccessInfo{}
			dash, ok := obj.(*dashv2beta1.Dashboard)
			if ok {
				dto.Dashboard = *dash
			}
			if access != nil {
				err = b.scheme.Convert(access, &dto.Access, nil)
			}
			return dto, err
		}); err != nil {
		return err
	}

	return nil
}

func (b *DashboardsAPIBuilder) storageForVersion(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	largeObjects apistore.LargeObjectSupport,
	dashboards utils.ResourceInfo,
	libraryPanels *utils.ResourceInfo,
	snapshots *utils.ResourceInfo,
	newDTOFunc dtoBuilder,
) error {
	// Register the versioned storage
	storage := map[string]rest.Storage{}
	apiGroupInfo.VersionedResourcesStorageMap[dashboards.GroupVersion().Version] = storage

	if b.isStandalone {
		unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, dashboards, opts.OptsGetter)
		if err != nil {
			return err
		}
		unified.AfterDelete = b.afterDelete
		storage[dashboards.StoragePath()] = unified

		return nil
	}

	legacyStore, err := b.legacy.NewStore(dashboards, opts.Scheme, opts.OptsGetter, opts.MetricsRegister, b.dashboardPermissions, b.accessClient)
	if err != nil {
		return err
	}

	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, dashboards, opts.OptsGetter)
	if err != nil {
		return err
	}
	unified.AfterDelete = b.afterDelete

	gr := dashboards.GroupResource()
	dw, err := opts.DualWriteBuilder(gr, legacyStore, unified)
	if err != nil {
		return err
	}
	storage[dashboards.StoragePath()] = dashboardStoragePermissionWrapper{
		dashboardPermissionsSvc: b.dashboardPermissionsSvc,
		Storage:                 dw,
	}

	// Register the DTO endpoint that will consolidate all dashboard bits
	storage[dashboards.StoragePath("dto")], err = NewDTOConnector(
		storage[dashboards.StoragePath()].(rest.Getter),
		largeObjects,
		b.legacy.Access,
		b.unified,
		b.accessControl,
		opts.Scheme,
		newDTOFunc,
		b.publicDashboardService,
	)
	if err != nil {
		return err
	}

	// Expose read library panels
	//nolint:staticcheck // not yet migrated to OpenFeature
	if libraryPanels != nil && b.features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		legacyLibraryStore := &LibraryPanelStore{
			Access:       b.legacy.Access,
			ResourceInfo: *libraryPanels,
			service:      b.libraryPanels,
		}

		unifiedLibraryStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, *libraryPanels, opts.OptsGetter)
		if err != nil {
			return err
		}

		libraryGr := libraryPanels.GroupResource()
		storage[libraryPanels.StoragePath()], err = opts.DualWriteBuilder(libraryGr, legacyLibraryStore, unifiedLibraryStore)
		if err != nil {
			return err
		}
	}

	if snapshots != nil {
		snapshotLegacyStore := &snapshot.SnapshotLegacyStore{
			ResourceInfo: *snapshots,
			Service:      b.snapshotService,
			Namespacer:   b.namespacer,
		}

		snapshotUnifiedStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, *snapshots, opts.OptsGetter)
		if err != nil {
			return err
		}

		snapshotGr := snapshots.GroupResource()
		storage[snapshots.StoragePath()], err = opts.DualWriteBuilder(snapshotGr, snapshotLegacyStore, snapshotUnifiedStore)
		if err != nil {
			return err
		}
	}
	return nil
}

func (b *DashboardsAPIBuilder) afterDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if util.IsInterfaceNil(b.resourcePermissionsSvc) {
		return
	}

	ctx := context.Background()
	log := logging.DefaultLogger
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		log.Error("Failed to access deleted dashboard object metadata", "error", err)
		return
	}

	log.Debug("deleting dashboard permissions", "uid", meta.GetName(), "namespace", meta.GetNamespace())
	client := (*b.resourcePermissionsSvc).Namespace(meta.GetNamespace())
	name := fmt.Sprintf("%s-%s-%s", dashv1.DashboardResourceInfo.GroupVersionResource().Group, dashv1.DashboardResourceInfo.GroupVersionResource().Resource, meta.GetName())
	err = client.Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		log.Error("failed to delete dashboard permissions", "error", err)
	}
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := dashv0.GetOpenAPIDefinitions(ref)
		maps.Copy(defs, dashv1.GetOpenAPIDefinitions(ref))
		maps.Copy(defs, dashv2alpha1.GetOpenAPIDefinitions(ref))
		maps.Copy(defs, dashv2beta1.GetOpenAPIDefinitions(ref))
		return defs
	}
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana dashboards as resources"

	// Add dashboard hits manually
	if oas.Info.Title == "dashboard.grafana.app/v0alpha1" {
		defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
		defsBase := "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1."
		refsBase := "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v0alpha1."

		kinds := []string{"SearchResults", "DashboardHit", "ManagedBy", "FacetResult", "TermFacet", "SortBy"}

		// Add any missing definitions
		//-----------------------------
		for _, k := range kinds {
			v := defs[defsBase+k]
			clean := strings.Replace(k, defsBase, refsBase, 1)
			if oas.Components.Schemas[clean] == nil {
				switch k {
				case "SearchResults":
					v.Schema.Properties["sortBy"] = *spec.RefProperty(
						"#/components/schemas/SortBy")
					v.Schema.Properties["hits"] = *spec.ArrayProperty(
						spec.RefProperty("#/components/schemas/DashboardHit"),
					)
					v.Schema.Properties["facets"] = *spec.MapProperty(
						spec.RefProperty("#/components/schemas/FacetResult"),
					)
				case "DashboardHit":
					v.Schema.Properties["managedBy"] = *spec.RefProperty(
						"#/components/schemas/ManagedBy")
				case "FacetResult":
					v.Schema.Properties["terms"] = *spec.ArrayProperty(
						spec.RefProperty("#/components/schemas/TermFacet"),
					)
				}
				oas.Components.Schemas[clean] = &v.Schema
			}
		}

		p := oas.Paths.Paths["/apis/dashboard.grafana.app/v0alpha1/namespaces/{namespace}/search"]
		p.Get.Responses.StatusCodeResponses[200] = &spec3.Response{
			ResponseProps: spec3.ResponseProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: spec.RefSchema("#/components/schemas/SearchResults"),
						},
					},
				},
			},
		}
	}

	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if gv.Version != dashv0.VERSION {
		return nil // Only show the custom routes for v0
	}

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	searchAPIRoutes := b.search.GetAPIRoutes(defs)

	prefix := dashv0.SnapshotResourceInfo.GroupResource().Resource
	createCmd := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateCommand"].Schema
	createExample := `{"dashboard":{"annotations":{"list":[{"name":"Annotations & Alerts","enable":true,"iconColor":"rgba(0, 211, 255, 1)","snapshotData":[],"type":"dashboard","builtIn":1,"hide":true}]},"editable":true,"fiscalYearStartMonth":0,"graphTooltip":0,"id":203,"links":[],"liveNow":false,"panels":[{"datasource":null,"fieldConfig":{"defaults":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"overrides":[]},"gridPos":{"h":8,"w":12,"x":0,"y":0},"id":1,"options":{"legend":{"calcs":[],"displayMode":"list","placement":"bottom","showLegend":true},"tooltip":{"mode":"single","sort":"none"}},"pluginVersion":"10.4.0-pre","snapshotData":[{"fields":[{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"showPoints":"auto","thresholdsStyle":{"mode":"off"}},"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"time","type":"time","values":[1706030536378,1706034856378,1706039176378,1706043496378,1706047816378,1706052136378]},{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"A-series","type":"number","values":[1,20,90,30,50,0]}],"refId":"A"}],"targets":[],"title":"Simple example","type":"timeseries","links":[]}],"refresh":"","schemaVersion":39,"snapshot":{"timestamp":"2024-01-23T23:22:16.377Z"},"tags":[],"templating":{"list":[]},"time":{"from":"2024-01-23T17:22:20.380Z","to":"2024-01-23T23:22:20.380Z","raw":{"from":"now-6h","to":"now"}},"timepicker":{},"timezone":"","title":"simple and small","uid":"b22ec8db-399b-403b-b6c7-b0fb30ccb2a5","version":1,"weekStart":""},"name":"simple and small","expires":86400}`
	createRsp := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateResponse"].Schema

	tags := []string{dashv0.SnapshotResourceInfo.GroupVersionKind().Kind}
	snapshotAPIRouteHandlers := []builder.APIRouteHandler{
		{
			Path: prefix + "/create",
			Spec: &spec3.PathProps{
				Post: &spec3.Operation{
					VendorExtensible: spec.VendorExtensible{
						Extensions: map[string]any{
							"x-grafana-action": "create",
							"x-kubernetes-group-version-kind": metav1.GroupVersionKind{
								Group:   dashv0.GROUP,
								Version: dashv0.VERSION,
								Kind:    "DashboardCreateResponse",
							},
						},
					},
					OperationProps: spec3.OperationProps{
						Tags:        tags,
						Summary:     "Full dashboard",
						Description: "longer description here?",
						Parameters: []*spec3.Parameter{
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "namespace",
									In:          "path",
									Required:    true,
									Example:     "default",
									Description: "workspace",
									Schema:      spec.StringProperty(),
								},
							},
						},
						RequestBody: &spec3.RequestBody{
							RequestBodyProps: spec3.RequestBodyProps{
								Content: map[string]*spec3.MediaType{
									"application/json": {
										MediaTypeProps: spec3.MediaTypeProps{
											Schema:  &createCmd,
											Example: createExample, // raw JSON body
										},
									},
								},
							},
						},
						Responses: &spec3.Responses{
							ResponsesProps: spec3.ResponsesProps{
								StatusCodeResponses: map[int]*spec3.Response{
									200: {
										ResponseProps: spec3.ResponseProps{
											Content: map[string]*spec3.MediaType{
												"application/json": {
													MediaTypeProps: spec3.MediaTypeProps{
														Schema: &createRsp,
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			Handler: func(w http.ResponseWriter, r *http.Request) {
				user, err := identity.GetRequester(r.Context())
				if err != nil {
					errhttp.Write(r.Context(), err, w)
					return
				}
				wrap := &contextmodel.ReqContext{
					Context: &web.Context{
						Req:  r,
						Resp: web.NewResponseWriter(r.Method, w),
					},
					// SignedInUser: user, ????????????
				}

				vars := mux.Vars(r)
				info, err := claims.ParseNamespace(vars["namespace"])
				if err != nil {
					wrap.JsonApiErr(http.StatusBadRequest, "expected namespace", nil)
					return
				}
				if info.OrgID != user.GetOrgID() {
					wrap.JsonApiErr(http.StatusBadRequest,
						fmt.Sprintf("user orgId does not match namespace (%d != %d)", info.OrgID, user.GetOrgID()), nil)
					return
				}

				cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
				if err := web.Bind(wrap.Req, &cmd); err != nil {
					wrap.JsonApiErr(http.StatusBadRequest, "bad request data", err)
					return
				}

				opts, err := b.snapshotOptions(info.Value)
				if err != nil {
					wrap.JsonApiErr(http.StatusBadRequest, "error getting options", err)
					return
				}

				// Use the existing snapshot service
				dashboardsnapshots.CreateDashboardSnapshot(wrap, opts.Spec, cmd, b.snapshotService)
			},
		},
		{
			Path: prefix + "/delete/{deleteKey}",
			Spec: &spec3.PathProps{
				Summary:     "an example at the root level",
				Description: "longer description here?",
				Delete: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Tags: tags,
						Parameters: []*spec3.Parameter{
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "deleteKey",
									In:          "path",
									Required:    true,
									Description: "unique key returned in create",
									Schema:      spec.StringProperty(),
								},
							},
						},
					},
				},
			},
			Handler: func(w http.ResponseWriter, r *http.Request) {
				ctx := r.Context()
				vars := mux.Vars(r)
				key := vars["deleteKey"]

				err := dashboardsnapshots.DeleteWithKey(ctx, key, b.snapshotService)
				if err != nil {
					errhttp.Write(ctx, fmt.Errorf("failed to delete external dashboard (%w)", err), w)
					return
				}
				_ = json.NewEncoder(w).Encode(&util.DynMap{
					"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
				})
			},
		},
	}

	apiRoutesHandler := append(append([]builder.APIRouteHandler{}, searchAPIRoutes.Namespace...), snapshotAPIRouteHandlers...)

	return &builder.APIRoutes{
		Namespace: apiRoutesHandler,
	}
}

// The default authorizer is fine because authorization happens in storage where we know the parent folder
func (b *DashboardsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return grafanaauthorizer.NewServiceAuthorizer()
}

func (b *DashboardsAPIBuilder) verifyFolderAccessPermissions(ctx context.Context, user identity.Requester, folderIds ...string) error {
	ns, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return err
	}
	folderClient := b.folderClientProvider.GetOrCreateHandler(ns.Value)

	for _, folderId := range folderIds {
		resp, err := folderClient.Get(ctx, folderId, ns.OrgID, metav1.GetOptions{}, "access")
		if err != nil {
			return dashboards.ErrFolderAccessDenied
		}
		var accessInfo folders.FolderAccessInfo
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(resp.Object, &accessInfo)
		if err != nil {
			logging.FromContext(ctx).Error("Failed to convert folder access response", "error", err)
			return dashboards.ErrFolderAccessDenied
		}

		if !accessInfo.CanEdit {
			return dashboards.ErrFolderAccessDenied
		}
	}

	return nil
}
