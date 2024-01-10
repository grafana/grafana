package query

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
)

var _ grafanaapiserver.APIGroupBuilder = (*QueryAPIBuilder)(nil)

type QueryAPIBuilder struct{}

func NewQueryAPIBuilder() *QueryAPIBuilder {
	return &QueryAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration grafanaapiserver.APIRegistrar) *QueryAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewQueryAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *QueryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.ExpressionInfo{},
		&v0alpha1.ExpressionInfoList{},
	)
}

func (b *QueryAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, v0alpha1.SchemeGroupVersion)
	metav1.AddToGroupVersion(scheme, v0alpha1.SchemeGroupVersion)
	return scheme.SetVersionPriority(v0alpha1.SchemeGroupVersion)
}

func (b *QueryAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	gv := v0alpha1.SchemeGroupVersion
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(gv.Group, scheme, metav1.ParameterCodec, codecs)

	expr := newExpressionStorage(scheme)
	storage := map[string]rest.Storage{}
	storage[expr.resourceInfo.StoragePath()] = expr
	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
	return &apiGroupInfo, nil
}

func (b *QueryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *QueryAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{
		Root: []grafanaapiserver.APIRouteHandler{},
		Namespace: []grafanaapiserver.APIRouteHandler{
			{
				Path: "query",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Summary:     "query across multiple datasources with expressions",
							Description: "matches the legacy /ds/query endpoint",
							Parameters:  []*spec3.Parameter{},
						},
					},
				},
				Handler: b.handleQuery,
			},
		},
	}
}

func (b *QueryAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default is OK
}
