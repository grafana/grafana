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

	authlib "github.com/grafana/authlib/types"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	annotationsV0 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

var (
	_ builder.APIGroupBuilder       = (*APIBuilder)(nil)
	_ builder.APIGroupRouteProvider = (*APIBuilder)(nil)
)

type APIBuilder struct {
	service annotationsV0.Service
}

func RegisterAPIService(features *featuremgmt.FeatureManager,
	// TBD... where/how should we implement access control
	// if visibility is based on access to the dashboard...
	// we will also need to know what folder dashboards live in
	accessClient authlib.AccessClient,
	repo annotations.Repository,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
) *APIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagAnnotationsAPIServer) {
		return nil
	}
	builder := &APIBuilder{
		service: newLegacyService(repo),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return annotationsV0.GroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&annotationsV0.Annotation{},
		&annotationsV0.AnnotationList{},
	)
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := annotationsV0.GroupVersion
	addKnownTypes(scheme, gv)
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	})
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}
	storage["annotations"] = newAnnotationStorage(b.service)

	apiGroupInfo.VersionedResourcesStorageMap[annotationsV0.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return annotationsV0.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

// Register additional routes with the server
func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	ref := func(path string) spec.Ref { return spec.Ref{} }
	defs := annotationsV0.GetOpenAPIDefinitions(ref)
	df := data.GetOpenAPIDefinitions(ref)["github.com/grafana/grafana-plugin-sdk-go/data.Frame"].Schema
	tags := defs["github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/annotationsV0.TagsList"].Schema

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
										Name:        "dashboard",
										In:          "query",
										Description: "dashboard identifier",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "alert",
										In:          "query",
										Description: "alert identifier",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "tags",
										In:          "query",
										Description: "tag query filter",
										Required:    false,
										Schema:      spec.ArrayProperty(spec.StringProperty()),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "format",
										In:          "query",
										Description: "the response shape",
										Required:    false,
										Schema:      spec.StringProperty().WithEnum("frame", "event", "resource"),
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
															Schema: &df,
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
					url := r.URL.Query()
					query, err := parseQuery(url)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					var rsp any
					found, err := b.service.Find(r.Context(), &query)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}
					rsp = found

					switch url.Get("format") {
					case "frame":
						rsp, err = toDataFrame(found)
					case "event":
						rsp = toEventArray(found)
					}

					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(rsp)
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
															Schema: &tags,
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
					found, err := b.service.Tags(r.Context())
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
