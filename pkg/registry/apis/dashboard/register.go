package dashboard

import (
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var _ builder.APIGroupBuilder = (*DashboardsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService dashboards.DashboardService

	accessControl accesscontrol.AccessControl
	legacy        *dashboardStorage

	log log.Logger
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	dashboardService dashboards.DashboardService,
	accessControl accesscontrol.AccessControl,
	provisioning provisioning.ProvisioningService,
	dashStore dashboards.Store,
	reg prometheus.Registerer,
	sql db.DB,
	tracing *tracing.TracingService,
) *DashboardsAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	namespacer := request.GetNamespaceMapper(cfg)
	builder := &DashboardsAPIBuilder{
		log: log.New("grafana-apiserver.dashboards"),

		dashboardService: dashboardService,
		accessControl:    accessControl,

		legacy: &dashboardStorage{
			resource: dashboard.DashboardResourceInfo,
			access:   legacy.NewDashboardAccess(sql, namespacer, dashStore, provisioning),
			tableConverter: gapiutil.NewTableConverter(
				dashboard.DashboardResourceInfo.GroupResource(),
				[]metav1.TableColumnDefinition{
					{Name: "Name", Type: "string", Format: "name"},
					{Name: "Title", Type: "string", Format: "string", Description: "The dashboard name"},
					{Name: "Created At", Type: "date"},
				},
				func(obj any) ([]interface{}, error) {
					dash, ok := obj.(*dashboard.Dashboard)
					if ok {
						if dash != nil {
							return []interface{}{
								dash.Name,
								dash.Spec.GetNestedString("title"),
								dash.CreationTimestamp.UTC().Format(time.RFC3339),
							}, nil
						}
					}
					return nil, fmt.Errorf("expected dashboard or summary")
				}),
		},
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dashboard.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilder) GetDesiredDualWriterMode(dualWrite bool, modeMap map[string]grafanarest.DualWriterMode) grafanarest.DualWriterMode {
	// Add required configuration support in order to enable other modes. For an example, see pkg/registry/apis/playlist/register.go
	return grafanarest.Mode0
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&dashboard.Dashboard{},
		&dashboard.DashboardList{},
		&dashboard.DashboardWithAccessInfo{},
		&dashboard.DashboardVersionList{},
		&dashboard.VersionsQueryOptions{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	resourceInfo := dashboard.DashboardResourceInfo
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
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(dashboard.GROUP, scheme, metav1.ParameterCodec, codecs)

	dash := b.legacy.resource
	legacyStore, err := b.legacy.newStore(scheme, optsGetter)
	if err != nil {
		return nil, err
	}

	storage := map[string]rest.Storage{}
	storage[dash.StoragePath()] = legacyStore
	storage[dash.StoragePath("dto")] = &DTOConnector{
		builder: b,
	}
	storage[dash.StoragePath("history")] = apistore.NewHistoryConnector(
		b.legacy.server, // as client???
		dashboard.DashboardResourceInfo.GroupResource(),
	)

	// Dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := newStorage(scheme)
		if err != nil {
			return nil, err
		}

		options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
		if err := store.CompleteWithOptions(options); err != nil {
			return nil, err
		}
		storage[dash.StoragePath()], err = dualWriteBuilder(dash.GroupResource(), legacyStore, store)
		if err != nil {
			return nil, err
		}
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboard.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboard.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana dashboards as resources"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+dashboard.DashboardResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+"watch/"+dashboard.DashboardResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}
