package provisioning

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*ProvisioningAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ProvisioningAPIBuilder struct{}

func NewProvisioningAPIBuilder() *ProvisioningAPIBuilder {
	return &ProvisioningAPIBuilder{}
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
) *ProvisioningAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewProvisioningAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *ProvisioningAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			if a.GetSubresource() == "webhook" {
				// for now????
				return authorizer.DecisionAllow, "", nil
			}

			// fallback to the standard authorizer
			return authorizer.DecisionNoOpinion, "", nil
		})
	}
}

func (b *ProvisioningAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func (b *ProvisioningAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := v0alpha1.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = v0alpha1.AddKnownTypes(v0alpha1.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only 1 version (for now?)
	return scheme.SetVersionPriority(v0alpha1.SchemeGroupVersion)
}

func (b *ProvisioningAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	repositoryStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, v0alpha1.RepositoryResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}

	storage := map[string]rest.Storage{}
	storage[v0alpha1.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	storage[v0alpha1.RepositoryResourceInfo.StoragePath("hello")] = &helloWorldSubresource{
		getter: repositoryStorage,
	}
	storage[v0alpha1.RepositoryResourceInfo.StoragePath("webhook")] = &webhookConnector{
		getter: repositoryStorage,
	}
	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return nil
}

func (b *ProvisioningAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *ProvisioningAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// TODO: Do we need any?
	return nil
}

func (b *ProvisioningAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana Git UI Sync"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	// TODO: we might want to register some extras for subresources here.
	sub := oas.Paths.Paths[root+"namespaces/{namespace}/repositories/{name}/hello"]
	if sub != nil && sub.Get != nil {
		sub.Get.Description = "Get a nice hello :)"
		sub.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "whom",
					In:          "query",
					Example:     "World!",
					Description: "Who should get the nice greeting?",
					Schema:      spec.StringProperty(),
					Required:    false,
				},
			},
		}
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	return oas, nil
}
