package dashboard

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DashboardStorage struct {
	Access           legacy.DashboardAccess
	DashboardService dashboards.DashboardService
}

func (s *DashboardStorage) NewStore(dash utils.ResourceInfo, scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter, reg prometheus.Registerer, permissions dashboards.PermissionsRegistrationService, ac types.AccessClient) (grafanarest.Storage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      s.Access,
		Reg:          reg,
		AccessClient: ac,
	})
	if err != nil {
		return nil, err
	}

	defaultOpts, err := defaultOptsGetter.GetRESTOptions(dash.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	client := legacy.NewDirectResourceClient(server) // same context
	optsGetter := apistore.NewRESTOptionsGetterForClient(client, nil,
		defaultOpts.StorageConfig.Config, nil,
	)
	optsGetter.RegisterOptions(dash.GroupResource(), apistore.StorageOptions{
		EnableFolderSupport:         true,
		RequireDeprecatedInternalID: true,
		Permissions:                 permissions.SetDefaultPermissionsAfterCreate,
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

	obj, err := s.Store.Create(ctx, obj, createValidation, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.DashboardID > 0 {
		meta, _ := utils.MetaAccessor(obj)
		if meta != nil {
			// skip the linter error for deprecated function
			meta.SetDeprecatedInternalID(access.DashboardID) //nolint:staticcheck
		}
	}
	meta, metaErr := utils.MetaAccessor(obj)
	if metaErr == nil {
		// Reconstruct the same UID as done at the storage level
		// https://github.com/grafana/grafana/blob/a84e96fba29c3a1bb384fdbad1c9c658cc79ec8f/pkg/registry/apis/dashboard/legacy/sql_dashboards.go#L287
		// This is necessary because the UID generated during the creation via legacy storage is actually never stored in the database
		// and the one returned here is wrong.
		meta.SetUID(gapiutil.CalculateClusterWideUID(obj))
	}

	if err != nil {
		return obj, err
	}

	if metaErr != nil {
		return obj, metaErr
	}

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
