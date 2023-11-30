package dashboards

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/app-deployments/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

// GroupName is the group name for this API.
const GroupName = "app-deployments.grafana.app"
const VersionID = "v0alpha1"

var _ grafanaapiserver.APIGroupBuilder = (*DeploymentAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DeploymentAPIBuilder struct {
	gv schema.GroupVersion
}

func RegisterAPIService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
) *DeploymentAPIBuilder {
	// ONLY install if this is in cloud
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	builder := &DeploymentAPIBuilder{
		gv: schema.GroupVersion{Group: GroupName, Version: VersionID},
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DeploymentAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func (b *DeploymentAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.gv,
		&v0alpha1.AppDeploymentInfo{},
		&v0alpha1.AppDeploymentInfoList{},
	)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	},
		&v0alpha1.AppDeploymentInfo{},
		&v0alpha1.AppDeploymentInfoList{},
	)

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *DeploymentAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)

	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &v0alpha1.AppDeploymentInfo{} },
		NewListFunc:               func() runtime.Object { return &v0alpha1.AppDeploymentInfoList{} },
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  b.gv.WithResource("app-deployments").GroupResource(),
		SingularQualifiedResource: b.gv.WithResource("app-deployment").GroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	store.TableConvertor = utils.NewTableConverter(
		store.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Steady", Type: "string", Format: "string", Description: "Fast channel CDN"},
		},
		func(obj any) ([]interface{}, error) {
			r, ok := obj.(*v0alpha1.AppDeploymentInfo)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.CDN.Steady,
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		})

	storage := map[string]rest.Storage{}
	storage["deployments"] = &staticStorage{store: store}

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *DeploymentAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *DeploymentAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}
