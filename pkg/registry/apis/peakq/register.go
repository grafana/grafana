package peakq

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
	"github.com/grafana/grafana/pkg/generated/openapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

var _ grafanaapiserver.APIGroupBuilder = (*PeakQAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PeakQAPIBuilder struct{}

func NewPeakQAPIBuilder() *PeakQAPIBuilder {
	return &PeakQAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *PeakQAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewPeakQAPIBuilder()
	apiregistration.RegisterAPI(NewPeakQAPIBuilder())
	return builder
}

func (b *PeakQAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *PeakQAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return peakq.SchemeGroupVersion
}

func (b *PeakQAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := peakq.SchemeGroupVersion
	err := peakq.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   peakq.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *PeakQAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(peakq.GROUP, scheme, metav1.ParameterCodec, codecs)

	resourceInfo := peakq.QueryTemplateResourceInfo
	storage := map[string]rest.Storage{}
	peakqStorage, err := newStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[resourceInfo.StoragePath()] = peakqStorage
	apiGroupInfo.VersionedResourcesStorageMap[peakq.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *PeakQAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return openapi.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *PeakQAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil
}
