package dashboard

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/access"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*DashboardsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService

	dashboardVersionService dashver.Service
	accessControl           accesscontrol.AccessControl
	namespacer              request.NamespaceMapper
	access                  access.DashboardAccess
	dashStore               dashboards.Store

	log log.Logger
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	dashboardVersionService dashver.Service,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	sql db.DB,
) *DashboardsAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilder{
		dashboardService:        dashboardService,
		dashboardVersionService: dashboardVersionService,
		dashStore:               dashStore,
		accessControl:           accessControl,
		namespacer:              namespacer,
		access:                  access.NewDashboardAccess(sql, namespacer, dashStore, provisioning),
		log:                     log.New("grafana-apiserver.dashboards"),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.DashboardResourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.Dashboard{},
		&v0alpha1.DashboardList{},
		&v0alpha1.DashboardAccessInfo{},
		&v0alpha1.DashboardVersionsInfo{},
		&v0alpha1.DashboardSummary{},
		&v0alpha1.DashboardSummaryList{},
		&v0alpha1.VersionsQueryOptions{},
	)
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	resourceInfo := v0alpha1.DashboardResourceInfo
	addKnownTypes(scheme, resourceInfo.GroupVersion())

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   resourceInfo.GroupVersion().Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, resourceInfo.GroupVersion())
	return scheme.SetVersionPriority(resourceInfo.GroupVersion())
}

func (b *DashboardsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWrite bool,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v0alpha1.GROUP, scheme, metav1.ParameterCodec, codecs)

	resourceInfo := v0alpha1.DashboardResourceInfo
	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	store.TableConvertor = utils.NewTableConverter(
		store.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The dashboard name"},
			{Name: "Created At", Type: "date"},
		},
		func(obj any) ([]interface{}, error) {
			dash, ok := obj.(*v0alpha1.Dashboard)
			if ok {
				return []interface{}{
					dash.Name,
					dash.Spec.GetNestedString("title"),
					dash.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			summary, ok := obj.(*v0alpha1.DashboardSummary)
			if ok {
				return []interface{}{
					dash.Name,
					summary.Spec.Title,
					dash.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected dashboard or summary")
		})

	legacyStore := &dashboardStorage{
		resource:       resourceInfo,
		access:         b.access,
		tableConverter: store.TableConvertor,
	}

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = legacyStore
	storage[resourceInfo.StoragePath("access")] = &AccessREST{
		builder: b,
	}
	storage[resourceInfo.StoragePath("versions")] = &VersionsREST{
		builder: b,
	}

	// Dual writes if a RESTOptionsGetter is provided
	if dualWrite && optsGetter != nil {
		options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
		if err := store.CompleteWithOptions(options); err != nil {
			return nil, err
		}
		storage[resourceInfo.StoragePath()] = grafanarest.NewDualWriter(legacyStore, store)
	}

	// Summary
	resourceInfo2 := v0alpha1.DashboardSummaryResourceInfo
	storage[resourceInfo2.StoragePath()] = &summaryStorage{
		resource:       resourceInfo2,
		access:         b.access,
		tableConverter: store.TableConvertor,
	}

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}
