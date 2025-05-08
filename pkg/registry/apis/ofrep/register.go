package ofrep

import (
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ builder.APIGroupBuilder = (*APIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*APIBuilder)(nil)
var _ builder.APIGroupVersionProvider = (*APIBuilder)(nil)

type APIBuilder struct{}

func NewAPIBuilder() *APIBuilder {
	return &APIBuilder{}
}

func RegisterAPIService(apiregistration builder.APIRegistrar) *APIBuilder {
	builder := NewAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return schema.GroupVersion{
		Group:   "ofrep",
		Version: "v1",
	}
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	return nil
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "/",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &spec.Schema{},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.handleListProxy,
			},
		},
	}
}

func (b *APIBuilder) handleListProxy(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, err := w.Write([]byte("[]"))
	if err != nil {
		panic(err)
	}
}
