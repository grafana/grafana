package dashboard

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type DashboardStorage struct {
	Access           legacy.DashboardAccess
	DashboardService dashboards.DashboardService
}

func (s *DashboardStorage) NewStore(dash utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter, reg prometheus.Registerer) (grafanarest.Storage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: s.Access,
		Reg:     reg,
	})
	if err != nil {
		return nil, err
	}

	defaultOpts, err := defaultOptsGetter.GetRESTOptions(dash.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	client := legacy.NewDirectResourceClient(server) // same context
	optsGetter := apistore.NewRESTOptionsGetterForClient(client,
		defaultOpts.StorageConfig.Config,
	)
	optsGetter.RegisterOptions(dash.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
	})

	store, err := grafanaregistry.NewRegistryStore(scheme, dash, optsGetter)
	return &storeWrapper{
		Store:            store,
		DashboardService: s.DashboardService,
	}, err
}

type storeWrapper struct {
	*registry.Store
	DashboardService dashboards.DashboardService
}

// Create will create the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx = legacy.WithLegacyAccess(ctx)

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	managerProperties, managerPresent := meta.GetManagerProperties()
	isProvisioned := managerPresent && managerProperties.Kind != utils.ManagerKindUnknown

	obj, err = s.Store.Create(ctx, obj, createValidation, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.DashboardID > 0 {
		meta, _ := utils.MetaAccessor(obj)
		if meta != nil {
			// skip the linter error for deprecated function
			meta.SetDeprecatedInternalID(access.DashboardID) //nolint:staticcheck
		}
	}

	if err != nil {
		return obj, err
	}

	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return obj, err
	}
	unstructuredObj := &unstructured.Unstructured{Object: unstructuredMap}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return obj, err
	}

	legacyDashboard, err := s.DashboardService.UnstructuredToLegacyDashboard(ctx, unstructuredObj, user.GetOrgID())
	if err != nil {
		return obj, err
	}

	// We only need these two parameters for SetDefaultPermissions
	dto := &dashboards.SaveDashboardDTO{
		User:  user,
		OrgID: user.GetOrgID(),
	}

	// Temporary approach to set default permissions until we have a proper method in place via k8s
	s.DashboardService.SetDefaultPermissions(ctx, dto, legacyDashboard, isProvisioned)

	return obj, nil
}

// Update will update the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx = legacy.WithLegacyAccess(ctx)
	obj, created, err := s.Store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.DashboardID > 0 {
		meta, _ := utils.MetaAccessor(obj)
		if meta != nil {
			// skip the linter error for deprecated function
			meta.SetDeprecatedInternalID(access.DashboardID) //nolint:staticcheck
		}
	}
	return obj, created, err
}
