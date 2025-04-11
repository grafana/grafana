package dashboard

import (
	"context"
	"errors"
	"fmt"
	"maps"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	claims "github.com/grafana/authlib/types"
	internal "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"

	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

var (
	_ builder.APIGroupBuilder          = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupVersionsProvider = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor     = (*DashboardsAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider    = (*DashboardsAPIBuilder)(nil)
)

const (
	dashboardSpecTitle           = "title"
	dashboardSpecRefreshInterval = "refresh"
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService
	features         featuremgmt.FeatureToggles

	accessControl                accesscontrol.AccessControl
	legacy                       *DashboardStorage
	unified                      resource.ResourceClient
	dashboardProvisioningService dashboards.DashboardProvisioningService
	dashboardPermissions         dashboards.PermissionsRegistrationService
	scheme                       *runtime.Scheme
	search                       *SearchHandler
	dashStore                    dashboards.Store
	folderStore                  folder.FolderStore
	QuotaService                 quota.Service
	ProvisioningService          provisioning.ProvisioningService
	cfg                          *setting.Cfg
	dualWriter                   dualwrite.Service
	folderClient                 client.K8sHandler

	log log.Logger
	reg prometheus.Registerer
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	provisioningDashboardService dashboards.DashboardProvisioningService,
	dashboardPermissions dashboards.PermissionsRegistrationService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
	dual dualwrite.Service,
	sorter sort.Service,
	quotaService quota.Service,
	folderStore folder.FolderStore,
	restConfigProvider apiserver.RestConfigProvider,
	userService user.Service,
) *DashboardsAPIBuilder {
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	legacyDashboardSearcher := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	folderClient := client.NewK8sHandler(dual, request.GetNamespaceMapper(cfg), folderv0alpha1.FolderResourceInfo.GroupVersionResource(), restConfigProvider.GetRestConfig, dashStore, userService, unified, sorter)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards"),

		dashboardService:             dashboardService,
		dashboardPermissions:         dashboardPermissions,
		features:                     features,
		accessControl:                accessControl,
		unified:                      unified,
		dashboardProvisioningService: provisioningDashboardService,
		search:                       NewSearchHandler(tracing, dual, legacyDashboardSearcher, unified, features),
		dashStore:                    dashStore,
		folderStore:                  folderStore,
		QuotaService:                 quotaService,
		ProvisioningService:          provisioning,
		cfg:                          cfg,
		dualWriter:                   dual,
		folderClient:                 folderClient,

		legacy: &DashboardStorage{
			Access:           legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, sorter),
			DashboardService: dashboardService,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersions() []schema.GroupVersion {
	if featuremgmt.AnyEnabled(b.features, featuremgmt.FlagDashboardNewLayouts) {
		// If dashboards v2 is enabled, we want to use v2alpha1 as the default API version.
		return []schema.GroupVersion{
			v2alpha1.DashboardResourceInfo.GroupVersion(),
			v0alpha1.DashboardResourceInfo.GroupVersion(),
			v1alpha1.DashboardResourceInfo.GroupVersion(),
		}
	}

	return []schema.GroupVersion{
		v1alpha1.DashboardResourceInfo.GroupVersion(),
		v0alpha1.DashboardResourceInfo.GroupVersion(),
		v2alpha1.DashboardResourceInfo.GroupVersion(),
	}
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	b.scheme = scheme
	if err := v0alpha1.AddToScheme(scheme); err != nil {
		return err
	}
	if err := v1alpha1.AddToScheme(scheme); err != nil {
		return err
	}
	if err := v2alpha1.AddToScheme(scheme); err != nil {
		return err
	}

	// Register the explicit conversions
	if err := conversion.RegisterConversions(scheme); err != nil {
		return err
	}

	return scheme.SetVersionPriority(b.GetGroupVersions()...)
}

// Validate validates dashboard operations for the apiserver
func (b *DashboardsAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

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

	return nil
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

	nsInfo, err := claims.ParseNamespace(a.GetNamespace())
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to parse namespace", err)
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
		return err
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.cfg.MinRefreshInterval, refresh); err != nil {
		return err
	}

	id, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("error getting requester: %w", err)
	}

	// Validate folder existence if specified
	if !a.IsDryRun() && accessor.GetFolder() != "" {
		if err := b.validateFolderExists(ctx, accessor.GetFolder(), id.GetOrgID()); err != nil {
			return err
		}
	}

	// Validate quota
	if !a.IsDryRun() {
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
			return dashboards.ErrQuotaReached
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
	nsInfo, err := claims.ParseNamespace(oldAccessor.GetNamespace())
	if err != nil {
		return fmt.Errorf("failed to parse namespace: %w", err)
	}

	// Basic validations
	if err := b.dashboardService.ValidateBasicDashboardProperties(title, newAccessor.GetName(), newAccessor.GetMessage()); err != nil {
		return err
	}

	// Validate folder existence if specified and changed
	if !a.IsDryRun() && newAccessor.GetFolder() != "" && newAccessor.GetFolder() != oldAccessor.GetFolder() {
		if err := b.validateFolderExists(ctx, newAccessor.GetFolder(), nsInfo.OrgID); err != nil {
			return err
		}
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.cfg.MinRefreshInterval, refresh); err != nil {
		return err
	}

	allowOverwrite := false // TODO: Add support for overwrite flag
	// check for is someone else has written in between
	if newAccessor.GetGeneration() != oldAccessor.GetGeneration() {
		if allowOverwrite {
			newAccessor.SetGeneration(oldAccessor.GetGeneration())
		} else {
			return dashboards.ErrDashboardVersionMismatch
		}
	}

	return nil
}

// validateFolderExists checks if a folder exists
func (b *DashboardsAPIBuilder) validateFolderExists(ctx context.Context, folderUID string, orgID int64) error {
	// Check if folder exists using the folder store
	_, err := b.folderClient.Get(ctx, folderUID, orgID, metav1.GetOptions{})

	if err != nil {
		return err
	}

	return nil
}

// getDashboardProperties extracts title and refresh interval from any dashboard version
func getDashboardProperties(obj runtime.Object) (string, string, error) {
	var title, refresh string

	// Extract properties based on the object's type
	switch d := obj.(type) {
	case *v0alpha1.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *v1alpha1.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *v2alpha1.Dashboard:
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

		// Sets default root permissions
		Permissions: b.dashboardPermissions.SetDefaultPermissionsAfterCreate,
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	if b.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = NewDashboardLargeObjectSupport(opts.Scheme, opts.StorageOpts.BlobThresholdBytes)
		storageOpts.LargeObjectSupport = largeObjects
	}
	opts.StorageOptsRegister(v0alpha1.DashboardResourceInfo.GroupResource(), storageOpts)

	// v0alpha1
	if err := b.storageForVersion(apiGroupInfo, opts, largeObjects,
		v0alpha1.DashboardResourceInfo,
		&v0alpha1.LibraryPanelResourceInfo,
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v0alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v0alpha1.Dashboard)
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
		v1alpha1.DashboardResourceInfo,
		nil, // do not register library panel
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v1alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v1alpha1.Dashboard)
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
		v2alpha1.DashboardResourceInfo,
		nil, // do not register library panel
		func(obj runtime.Object, access *internal.DashboardAccess) (v runtime.Object, err error) {
			dto := &v2alpha1.DashboardWithAccessInfo{}
			dash, ok := obj.(*v2alpha1.Dashboard)
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
	newDTOFunc dtoBuilder,
) error {
	// Register the versioned storage
	storage := map[string]rest.Storage{}
	apiGroupInfo.VersionedResourcesStorageMap[dashboards.GroupVersion().Version] = storage

	legacyStore, err := b.legacy.NewStore(dashboards, opts.Scheme, opts.OptsGetter, b.reg, b.dashboardPermissions)
	if err != nil {
		return err
	}

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, dashboards, opts.OptsGetter)
	if err != nil {
		return err
	}

	gr := dashboards.GroupResource()
	storage[dashboards.StoragePath()], err = opts.DualWriteBuilder(gr, legacyStore, store)
	if err != nil {
		return err
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
	)
	if err != nil {
		return err
	}

	// Expose read only library panels
	if libraryPanels != nil {
		storage[libraryPanels.StoragePath()] = &LibraryPanelStore{
			Access:       b.legacy.Access,
			ResourceInfo: *libraryPanels,
		}
	}

	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := v0alpha1.GetOpenAPIDefinitions(ref)
		maps.Copy(defs, v1alpha1.GetOpenAPIDefinitions(ref))
		maps.Copy(defs, v2alpha1.GetOpenAPIDefinitions(ref))
		return defs
	}
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana dashboards as resources"
	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if gv.Version != v0alpha1.VERSION {
		return nil // Only show the custom routes for v0
	}

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.search.GetAPIRoutes(defs)
}
