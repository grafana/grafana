package dashboards

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

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

// GroupName is the group name for this API.
const GroupName = "dashboards.grafana.app"
const VersionID = "v0alpha1"

var _ grafanaapiserver.APIGroupBuilder = (*DashboardsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService        dashboardssvc.DashboardService
	provisioningService     dashboardssvc.DashboardProvisioningService
	dashboardVersionService dashver.Service
	accessControl           accesscontrol.AccessControl
	namespacer              request.NamespaceMapper
	gv                      schema.GroupVersion

	log log.Logger
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
	dashboardService dashboardssvc.DashboardService,
	dashboardVersionService dashver.Service,
	provisioningService dashboardssvc.DashboardProvisioningService,
	accessControl accesscontrol.AccessControl,
) *DashboardsAPIBuilder {
	if !features.IsEnabled(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &DashboardsAPIBuilder{
		dashboardService:        dashboardService,
		provisioningService:     provisioningService,
		dashboardVersionService: dashboardVersionService,
		accessControl:           accessControl,
		namespacer:              request.GetNamespaceMapper(cfg),
		gv:                      schema.GroupVersion{Group: GroupName, Version: VersionID},
		log:                     log.New("grafana-apiserver.dashbaords"),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.gv,
		&dashboards.DashboardResource{},
		&dashboards.DashboardInfo{},
		&dashboards.DashboardInfoList{},
		&dashboards.DashboardAccessInfo{},
		&dashboards.DashboardVersionsInfo{},
		&dashboards.VersionsQueryOptions{},
	)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	},
		&dashboards.DashboardResource{},
		&dashboards.DashboardInfo{},
		&dashboards.DashboardInfoList{},
		&dashboards.DashboardAccessInfo{},
		&dashboards.DashboardVersionsInfo{},
		&dashboards.VersionsQueryOptions{},
	)

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *DashboardsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)

	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &dashboards.DashboardResource{} },
		NewListFunc:               func() runtime.Object { return &dashboards.DashboardInfoList{} },
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  b.gv.WithResource("dashboards").GroupResource(),
		SingularQualifiedResource: b.gv.WithResource("dashboard").GroupResource(),
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
			r, ok := obj.(*dashboards.DashboardResource)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Get("title").MustString(),
					r.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			i, ok := obj.(*dashboards.DashboardInfo)
			if ok {
				return []interface{}{
					i.Name,
					i.Title,
					r.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		})

	// options := &generic.StoreOptions{RESTOptions: optsGetter, AttrFunc: grafanaregistry.GetAttrs}
	// if err := store.CompleteWithOptions(options); err != nil {
	// 	return nil, err
	// }

	legacyStore := &legacyStorage{
		store:      store,
		namespacer: b.namespacer,
		builder:    b,
	}

	storage := map[string]rest.Storage{}
	storage["dashboards"] = legacyStore
	storage["dashboards/access"] = &AccessREST{
		builder: b,
	}
	storage["dashboards/versions"] = &VersionsREST{
		builder: b,
	}

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboards.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}
