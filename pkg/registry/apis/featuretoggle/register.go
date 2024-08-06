package featuretoggle

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
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*FeatureFlagAPIBuilder)(nil)

var gv = v0alpha1.SchemeGroupVersion

// This is used just so wire has something unique to return
type FeatureFlagAPIBuilder struct {
	features      *featuremgmt.FeatureManager
	accessControl accesscontrol.AccessControl
	cfg           *setting.Cfg
}

func NewFeatureFlagAPIBuilder(features *featuremgmt.FeatureManager, accessControl accesscontrol.AccessControl, cfg *setting.Cfg) *FeatureFlagAPIBuilder {
	return &FeatureFlagAPIBuilder{features, accessControl, cfg}
}

func RegisterAPIService(features *featuremgmt.FeatureManager,
	accessControl accesscontrol.AccessControl,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	registerer prometheus.Registerer,
) *FeatureFlagAPIBuilder {
	builder := NewFeatureFlagAPIBuilder(features, accessControl, cfg)
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *FeatureFlagAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.Feature{},
		&v0alpha1.FeatureList{},
		&v0alpha1.FeatureToggles{},
		&v0alpha1.FeatureTogglesList{},
		&v0alpha1.ResolvedToggleState{},
	)
}

func (b *FeatureFlagAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
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

func (b *FeatureFlagAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	_ generic.RESTOptionsGetter,
	_ grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v0alpha1.GROUP, scheme, metav1.ParameterCodec, codecs)

	featureStore := NewFeaturesStorage()
	toggleStore := NewTogglesStorage(b.features)

	storage := map[string]rest.Storage{}
	storage[featureStore.resource.StoragePath()] = featureStore
	storage[toggleStore.resource.StoragePath()] = toggleStore

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *FeatureFlagAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *FeatureFlagAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

// Register additional routes with the server
func (b *FeatureFlagAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := v0alpha1.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	stateSchema := defs["github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1.ResolvedToggleState"].Schema

	tags := []string{"Editor"}
	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "current",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							Summary:     "Current configuration with details",
							Description: "Show details about the current flags and where they come from",
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &stateSchema,
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
					Patch: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							Summary:     "Update individual toggles",
							Description: "Patch some of the toggles (keyed by the toggle name)",
							RequestBody: &spec3.RequestBody{
								RequestBodyProps: spec3.RequestBodyProps{
									Required:    true,
									Description: "flags to change",
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema: &stateSchema,
												Example: &v0alpha1.ResolvedToggleState{
													Enabled: map[string]bool{
														featuremgmt.FlagAutoMigrateOldPanels: true,
														featuremgmt.FlagAngularDeprecationUI: false,
													},
												},
												Examples: map[string]*spec3.Example{
													"enable-auto-migrate": {
														ExampleProps: spec3.ExampleProps{
															Summary:     "enable auto-migrate panels",
															Description: "enable description",
															Value: &v0alpha1.ResolvedToggleState{
																Enabled: map[string]bool{
																	featuremgmt.FlagAutoMigrateOldPanels: true,
																},
															},
														},
													},
													"disable-auto-migrate": {
														ExampleProps: spec3.ExampleProps{
															Summary:     "disable auto-migrate panels",
															Description: "disable description",
															Value: &v0alpha1.ResolvedToggleState{
																Enabled: map[string]bool{
																	featuremgmt.FlagAutoMigrateOldPanels: false,
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
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {},
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
				Handler: b.handleCurrentStatus,
			},
		},
	}
}
