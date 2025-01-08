package v1alpha1

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv1alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ builder.APIGroupBuilder      = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor = (*DashboardsAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboard.DashboardsAPIBuilder
	dashboardService dashboards.DashboardService
	features         featuremgmt.FeatureToggles

	accessControl accesscontrol.AccessControl
	legacy        *dashboard.DashboardStorage
	unified       resource.ResourceClient

	log log.Logger
	reg prometheus.Registerer
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	provisioningDashboardService dashboards.DashboardProvisioningService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
	unified resource.ResourceClient,
) *DashboardsAPIBuilder {
	softDelete := features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore)
	dbp := legacysql.NewDatabaseProvider(sql)
	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards.v1alpha1"),
		DashboardsAPIBuilder: dashboard.DashboardsAPIBuilder{
			ProvisioningDashboardService: provisioningDashboardService,
		},
		dashboardService: dashboardService,
		features:         features,
		accessControl:    accessControl,
		unified:          unified,

		legacy: &dashboard.DashboardStorage{
			Resource:       dashboardv1alpha1.DashboardResourceInfo,
			Access:         legacy.NewDashboardAccess(dbp, namespacer, dashStore, provisioning, softDelete),
			TableConverter: dashboardv1alpha1.DashboardResourceInfo.TableConverter(),
			Features:       features,
		},
		reg: reg,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dashboardv1alpha1.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return dashboard.GetAuthorizer(b.dashboardService, b.log)
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	return dashboardv1alpha1.AddToScheme(scheme)
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme

	optsGetter := opts.OptsGetter
	dualWriteBuilder := opts.DualWriteBuilder
	dash := b.legacy.Resource
	legacyStore, err := b.legacy.NewStore(scheme, optsGetter, b.reg)
	if err != nil {
		return err
	}

	defaultOpts, err := optsGetter.GetRESTOptions(b.legacy.Resource.GroupResource(), &dashboardinternal.Dashboard{})
	if err != nil {
		return err
	}
	storageOpts := apistore.StorageOptions{
		RequireDeprecatedInternalID: true,
		InternalConversion: (func(b []byte, desiredObj runtime.Object) (runtime.Object, error) {
			internal := &dashboardinternal.Dashboard{}
			obj, _, err := defaultOpts.StorageConfig.Config.Codec.Decode(b, nil, internal)
			if err != nil {
				return nil, err
			}

			err = scheme.Convert(obj, desiredObj, nil)
			return desiredObj, err
		}),
	}

	// Split dashboards when they are large
	var largeObjects apistore.LargeObjectSupport
	if b.legacy.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		largeObjects = dashboard.NewDashboardLargeObjectSupport(scheme)
		storageOpts.LargeObjectSupport = largeObjects
	}
	opts.StorageOptions(dash.GroupResource(), storageOpts)

	storage := map[string]rest.Storage{}
	storage[dash.StoragePath()] = legacyStore
	storage[dash.StoragePath("history")] = apistore.NewHistoryConnector(
		b.legacy.Server, // as client???
		dashboardv1alpha1.DashboardResourceInfo.GroupResource(),
	)

	// Dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(scheme, dash, optsGetter)
		if err != nil {
			return err
		}
		storage[dash.StoragePath()], err = dualWriteBuilder(dash.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}
	}

	if b.features.IsEnabledGlobally(featuremgmt.FlagKubernetesRestore) {
		storage[dash.StoragePath("restore")] = dashboard.NewRestoreConnector(
			b.unified,
			dashboardv1alpha1.DashboardResourceInfo.GroupResource(),
			defaultOpts,
		)

		storage[dash.StoragePath("latest")] = dashboard.NewLatestConnector(
			b.unified,
			dashboardv1alpha1.DashboardResourceInfo.GroupResource(),
			defaultOpts,
			scheme,
		)
	}

	// Register the DTO endpoint that will consolidate all dashboard bits
	storage[dash.StoragePath("dto")], err = dashboard.NewDTOConnector(
		storage[dash.StoragePath()],
		largeObjects,
		b.legacy.Access,
		b.unified,
		b.accessControl,
		scheme,
		func() runtime.Object { return &dashboardv1alpha1.DashboardWithAccessInfo{} },
	)
	if err != nil {
		return err
	}

	// Expose read only library panels
	storage[dashboardv1alpha1.LibraryPanelResourceInfo.StoragePath()] = &dashboard.LibraryPanelStore{
		Access:       b.legacy.Access,
		ResourceInfo: dashboardv1alpha1.LibraryPanelResourceInfo,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboardv1alpha1.VERSION] = storage
	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboardv1alpha1.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana dashboards as resources"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+dashboardv1alpha1.DashboardResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+dashboardv1alpha1.DashboardResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

// Mutate removes any internal ID set in the spec & adds it as a label
func (b *DashboardsAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()
	if op == admission.Create || op == admission.Update {
		obj := a.GetObject()
		dash, ok := obj.(*dashboardv1alpha1.Dashboard)
		if !ok {
			return fmt.Errorf("expected v1alpha1 dashboard")
		}

		if id, ok := dash.Spec.Object["id"].(float64); ok {
			delete(dash.Spec.Object, "id")
			if id != 0 {
				meta, err := utils.MetaAccessor(obj)
				if err != nil {
					return err
				}
				meta.SetDeprecatedInternalID(int64(id)) // nolint:staticcheck
			}
		}
	}
	return nil
}
