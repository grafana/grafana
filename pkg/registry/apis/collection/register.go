package collection

import (
	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var _ builder.APIGroupBuilder = (*CollectionsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type CollectionsAPIBuilder struct{}

func NewCollectionsAPIBuilder() *CollectionsAPIBuilder {
	return &CollectionsAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar) *CollectionsAPIBuilder {
	if !(features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs)) {
		return nil // skip registration unless explicitly added (or all experimental are added)
	}
	builder := NewCollectionsAPIBuilder()
	apiregistration.RegisterAPI(NewCollectionsAPIBuilder())
	return builder
}

func (b *CollectionsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *CollectionsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return collection.SchemeGroupVersion
}

func (b *CollectionsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := collection.AddKnownTypes(scheme, collection.VERSION); err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	if err := collection.AddKnownTypes(scheme, runtime.APIVersionInternal); err != nil {
		return err
	}

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, collection.SchemeGroupVersion)
	return scheme.SetVersionPriority(collection.SchemeGroupVersion)
}

func (b *CollectionsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(collection.GROUP, scheme, metav1.ParameterCodec, codecs)

	var err error
	storage := map[string]rest.Storage{}

	info := collection.CollectionResourceInfo
	storage[info.StoragePath()], err = newStorage(scheme, &info, optsGetter)
	if err != nil {
		return nil, err
	}

	apiGroupInfo.VersionedResourcesStorageMap[collection.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *CollectionsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (b *CollectionsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return collection.GetOpenAPIDefinitions
}

func (b *CollectionsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	//defs := collection.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	// modifySchema := defs["github.com/grafana/grafana/pkg/apis/collection/v0alpha1.ModifyCollection"].Schema
	// starsSchema := defs["github.com/grafana/grafana/pkg/apis/collection/v0alpha1.UserStars"].Schema

	// The plugin description
	oas.Info.Description = "Collections"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	// Add query parameters to the rest.Connector
	sub = oas.Paths.Paths[root+"namespaces/{namespace}/stars/{name}/modify"]
	if sub != nil && sub.Post != nil {
		// refA := collection.ResourceRef{
		// 	Group:    "dashboard.grafana.app",
		// 	Resource: "dashboards",
		// 	Name:     "A",
		// }
		// refB := collection.ResourceRef{
		// 	Group:    "dashboard.grafana.app",
		// 	Resource: "dashboards",
		// 	Name:     "A",
		// }

		sub.Post.Description = "Add/Remove items from the collection"
		// sub.Post.RequestBody = &spec3.RequestBody{
		// 	RequestBodyProps: spec3.RequestBodyProps{
		// 		Content: map[string]*spec3.MediaType{
		// 			"application/json": {
		// 				MediaTypeProps: spec3.MediaTypeProps{
		// 					Schema: &modifySchema,
		// 					//	Example: basicTemplateSpec,
		// 					Examples: map[string]*spec3.Example{
		// 						"test": {
		// 							ExampleProps: spec3.ExampleProps{
		// 								Summary: "Add dashboards A and B",
		// 								Value: collection.ModifyCollection{
		// 									Add: []string{
		// 										refA.String(),
		// 										refB.String(),
		// 									},
		// 								},
		// 							},
		// 						},
		// 						"test2": {
		// 							ExampleProps: spec3.ExampleProps{
		// 								Summary: "Remove dashboards A",
		// 								Value: collection.ModifyCollection{
		// 									Remove: []string{
		// 										refA.String(),
		// 									},
		// 								},
		// 							},
		// 						},
		// 					},
		// 				},
		// 			},
		// 		},
		// 	},
		// }
		// sub.Post.Responses = &spec3.Responses{
		// 	ResponsesProps: spec3.ResponsesProps{
		// 		StatusCodeResponses: map[int]*spec3.Response{
		// 			200: {
		// 				ResponseProps: spec3.ResponseProps{
		// 					Description: "OK",
		// 					Content: map[string]*spec3.MediaType{
		// 						"application/json": {
		// 							MediaTypeProps: spec3.MediaTypeProps{
		// 								Schema: &starsSchema,
		// 							},
		// 						},
		// 					},
		// 				},
		// 			},
		// 		},
		// 	},
		// }
		// sub.Post.Parameters = []*spec3.Parameter{
		// 	{
		// 		ParameterProps: spec3.ParameterProps{
		// 			Name:        "parent",
		// 			In:          "query",
		// 			Description: "The parent scope node",
		// 		},
		// 	},
		// }
		// delete(oas.Paths.Paths, root+"namespaces/{namespace}/scope_node_children/{name}")
		// oas.Paths.Paths[root+"namespaces/{namespace}/find/scope_node_children"] = sub
	}

	return oas, nil
}
