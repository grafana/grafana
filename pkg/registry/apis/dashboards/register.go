package dashboards

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

// GroupName is the group name for this API.
const GroupName = "dashboards.grafana.app"
const VersionID = "v0alpha1"

var _ grafanaapiserver.APIGroupBuilder = (*DashboardsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	dashboardService    dashboardssvc.DashboardService
	provisioningService dashboardssvc.DashboardProvisioningService
	namespacer          request.NamespaceMapper
	gv                  schema.GroupVersion
}

func RegisterAPIService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
	dashboardService dashboardssvc.DashboardService,
	provisioningService dashboardssvc.DashboardProvisioningService,
) *DashboardsAPIBuilder {
	if !features.IsEnabled(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &DashboardsAPIBuilder{
		dashboardService:    dashboardService,
		provisioningService: provisioningService,
		namespacer:          request.GetNamespaceMapper(cfg),
		gv:                  schema.GroupVersion{Group: GroupName, Version: VersionID},
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
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service:                   b.dashboardService,
		provisioningService:       b.provisioningService,
		namespacer:                b.namespacer,
		DefaultQualifiedResource:  b.gv.WithResource("dashboards").GroupResource(),
		SingularQualifiedResource: b.gv.WithResource("dashboard").GroupResource(),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		legacyStore.DefaultQualifiedResource,
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
		},
	)
	storage["dashboards"] = legacyStore

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboards.GetOpenAPIDefinitions
}

func (b *DashboardsAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}
