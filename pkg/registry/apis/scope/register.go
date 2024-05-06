package scope

import (
	"encoding/json"
	"fmt"
	"net/http"

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

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

var _ builder.APIGroupBuilder = (*ScopeAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ScopeAPIBuilder struct{}

func NewScopeAPIBuilder() *ScopeAPIBuilder {
	return &ScopeAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar) *ScopeAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewScopeAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *ScopeAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *ScopeAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return scope.SchemeGroupVersion
}

func (b *ScopeAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := scope.AddToScheme(scheme)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeFields(&scope.Scope{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeDashboardBindingResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeDashboardBindingFields(&scope.ScopeDashboardBinding{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeDashboardBindingResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeNodeResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeNodeFields(&scope.ScopeNode{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeNodeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = scope.AddKnownTypes(scope.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only one version right now
	return scheme.SetVersionPriority(scope.SchemeGroupVersion)
}

func (b *ScopeAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ bool, // dual write (not relevant)
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(scope.GROUP, scheme, metav1.ParameterCodec, codecs)

	scopeResourceInfo := scope.ScopeResourceInfo
	scopeDashboardResourceInfo := scope.ScopeDashboardBindingResourceInfo
	scopeNodeResourceInfo := scope.ScopeNodeResourceInfo

	storage := map[string]rest.Storage{}

	scopeStorage, err := newScopeStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeResourceInfo.StoragePath()] = scopeStorage

	scopeDashboardStorage, err := newScopeDashboardBindingStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeDashboardResourceInfo.StoragePath()] = scopeDashboardStorage

	scopeNodeStorage, err := newScopeNodeStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeNodeResourceInfo.StoragePath()] = scopeNodeStorage

	apiGroupInfo.VersionedResourcesStorageMap[scope.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *ScopeAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return scope.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *ScopeAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := scope.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	scopeNodeSchema := defs["github.com/grafana/grafana/pkg/apis/scopes/v0alpha1.ScopeNodeSpec"].Schema

	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "find",
				Spec: &spec3.PathProps{
					Summary:     "find scope nodes by certain critieras",
					Description: "find searches for scope nodes based on parentName and a search query that matches titles. If parentName is left empty all root scope nodes will be returned. The query will return no more then 200 scope nodes by default. If the limit is exceeded, the client should refine the query.",
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{Name: "parentName"},
								},
								{
									ParameterProps: spec3.ParameterProps{Name: "query"},
								},
								{
									ParameterProps: spec3.ParameterProps{Name: "limit"},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "OK",
												Content: map[string]*spec3.MediaType{
													"text/plain": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &scopeNodeSchema,
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
				Handler: findGETHandler,
			},
		},
	}
}

// findGETHandler is a custom handler for searching ScopeNodes based on parentName and a query that can match on the title of the scopenode.
// The API only needs to return a fixed number of results. If the limit is exceeded, the client should refine the query.
func findGETHandler(w http.ResponseWriter, req *http.Request) {
	//parentName := req.URL.Query().Get("parentName")
	//query := req.URL.Query().Get("query")
	//limit := req.URL.Query().Get("limit")

	/*
		1. fetch scope nodes from the api server based on parent
		2. filter titles based on the query param. strings.HasPrefix is a good enough for now.
		3. Limit the response to the provided param.
	*/

	var results []scope.ScopeNode = nil

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(results)
}
