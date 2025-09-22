package annotations

import (
	"encoding/json"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util/errhttp"

	v0alpha1 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ builder.APIGroupBuilder       = (*APIBuilder)(nil)
	_ builder.APIGroupRouteProvider = (*APIBuilder)(nil)
)

// This is used just so wire has something unique to return
type APIBuilder struct {
	legacy *legacyStorage
	ac     accesscontrol.AccessControl
}

func RegisterAPIService(features *featuremgmt.FeatureManager,
	ac accesscontrol.AccessControl,
	repo annotations.Repository,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
) *APIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}
	namespacer := request.GetNamespaceMapper(cfg)
	builder := &APIBuilder{
		legacy: newLegacyStorage(ac, repo, namespacer),
		ac:     ac,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.GroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.Annotation{},
		&v0alpha1.AnnotationList{},
	)
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := v0alpha1.GroupVersion
	addKnownTypes(scheme, gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}
	storage["annotations"] = b.legacy

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

// Register additional routes with the server
func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := v0alpha1.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	annosSchema := defs["github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1.AnnotationList"].Schema
	tagsSchema := defs["github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1.TagsList"].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "annotations/find",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Annotation"},
							OperationId: "findAnnotations",
							Description: "Find annotations",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "from",
										In:          "query",
										Description: "the unix epoch (in milliseconds) of the start of the time range to search within",
										Required:    true,
										Schema:      spec.StringProperty(),
										Example:     "now-6h",
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "to",
										In:          "query",
										Description: "the unix epoch (in milliseconds) of the end of the time range to search within",
										Required:    true,
										Schema:      spec.StringProperty(),
										Example:     "now",
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "dashboardUID",
										In:          "query",
										Description: "dashboard identifier",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "alertUID",
										In:          "query",
										Description: "alert identifier",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &annosSchema,
														},
													},
												},
												Description: "OK",
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					query, err := parseQuery(r.URL.Query())
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					found, err := b.legacy.Find(r.Context(), &query)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(found)
				},
			},
			{
				Path: "annotations/tags",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Annotation"},
							OperationId: "getTags",
							Description: "get top tags",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &tagsSchema,
														},
													},
												},
												Description: "OK",
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					found, err := b.legacy.Tags(r.Context())
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(found)
				},
			},
		},
	}
}
