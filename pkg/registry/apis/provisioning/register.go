package provisioning

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var (
	_ builder.APIGroupBuilder               = (*APIBuilder)(nil)
	_ builder.APIGroupMutation              = (*APIBuilder)(nil)
	_ builder.APIGroupValidation            = (*APIBuilder)(nil)
	_ builder.APIGroupPostStartHookProvider = (*APIBuilder)(nil)
	_ builder.OpenAPIPostProcessor          = (*APIBuilder)(nil)
)

type APIBuilder struct {
	secrets secrets.Service
	jobs    jobs.JobQueue
	getter  rest.Getter
}

// NewAPIBuilder creates an API builder.
// It avoids anything that is core to Grafana, such that it can be used in a multi-tenant service down the line.
// This means there are no hidden dependencies, and no use of e.g. *settings.Cfg.
func NewAPIBuilder(
	secrets secrets.Service,
) *APIBuilder {
	return &APIBuilder{
		secrets: secrets,
	}
}

// RegisterAPIService returns an API builder, from [NewAPIBuilder]. It is called by Wire.
// This function happily uses services core to Grafana, and does not need to be multi-tenancy-compatible.
func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	secretsSvc grafanasecrets.Service,
) (*APIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) &&
		!features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis OR the feature specifically
	}

	builder := NewAPIBuilder(secrets.NewSingleTenant(secretsSvc))
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			// TODO: Implement a webhook authoriser somehow.

			// fallback to the standard authorizer
			return authorizer.DecisionNoOpinion, "", nil
		})
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return provisioning.SchemeGroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := provisioning.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = provisioning.AddKnownTypes(provisioning.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, provisioning.SchemeGroupVersion)
	// Only 1 version (for now?)
	return scheme.SetVersionPriority(provisioning.SchemeGroupVersion)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	repositoryStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, provisioning.RepositoryResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}

	// FIXME: Make job queue store the jobs somewhere persistent.
	jobStore := jobs.NewJobStore(50, b) // in memory, for now...
	b.jobs = jobStore

	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)

	storage := map[string]rest.Storage{}
	storage[provisioning.JobResourceInfo.StoragePath()] = jobStore
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *APIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()

	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration")
	}

	// TODO: Do something based on the resource we got.
	_ = r

	return nil
}

func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	var list field.ErrorList
	// TODO: Fill the list with validation errors.

	if len(list) > 0 {
		return apierrors.NewInvalid(
			provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
			a.GetName(), list)
	}
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return provisioning.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	postStartHooks := map[string]genericapiserver.PostStartHookFunc{
		"grafana-provisioning": func(postStartHookCtx genericapiserver.PostStartHookContext) error {
			// TODO: Set up a shared informer for a controller and a watcher with workers.
			return nil
		},
	}
	return postStartHooks, nil
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	return oas, nil
}

// Helpers for fetching valid Repository objects

func (b *APIBuilder) GetRepository(ctx context.Context, name string) (repository.Repository, error) {
	obj, err := b.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	_ = obj
	// FIXME: Return a valid Repository object with the correct underlying storage.
	panic("FIXME")
}
