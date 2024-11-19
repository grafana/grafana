package provisioning

import (
	"context"
	"fmt"
	"path/filepath"
	"slices"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ builder.APIGroupBuilder = (*ProvisioningAPIBuilder)(nil)
	_ RepoGetter              = (*ProvisioningAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type ProvisioningAPIBuilder struct {
	getter            rest.Getter
	localFileResolver *LocalFolderResolver
	client            *resourceClient
}

func NewProvisioningAPIBuilder(local *LocalFolderResolver, cfg *clientrest.Config) *ProvisioningAPIBuilder {
	return &ProvisioningAPIBuilder{
		localFileResolver: local,
		client: &resourceClient{
			config:  cfg,
			clients: make(map[schema.GroupVersionKind]dynamic.NamespaceableResourceInterface),
		},
	}
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
	cfg *setting.Cfg,
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider,
) *ProvisioningAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	// The service user.. TODO, this should be real
	serviceUser := &identity.StaticRequester{
		Type:           claims.TypeProvisioning,
		IsGrafanaAdmin: true,
		Namespace:      "*",
	}

	builder := NewProvisioningAPIBuilder(&LocalFolderResolver{
		ProvisioningPath: cfg.ProvisioningPath,
		DevenvPath:       filepath.Join(cfg.HomePath, "devenv"),
	}, clientConfigProvider.GetDirectRestConfigForRequester(serviceUser))
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

func (b *ProvisioningAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return provisioning.SchemeGroupVersion
}

func (b *ProvisioningAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := provisioning.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = provisioning.AddKnownTypes(provisioning.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only 1 version (for now?)
	return scheme.SetVersionPriority(provisioning.SchemeGroupVersion)
}

func (b *ProvisioningAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	repositoryStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, provisioning.RepositoryResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}
	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)
	b.getter = repositoryStorage

	helloWorld := &helloWorldSubresource{
		getter:        repositoryStorage,
		statusUpdater: repositoryStatusStorage,
		parent:        b,
	}

	storage := map[string]rest.Storage{}
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	// Can be used by kubectl: kubectl --kubeconfig grafana.kubeconfig patch Repository local-devenv --type=merge --subresource=status --patch='status: {"currentGitCommit": "hello"}'
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("hello")] = helloWorld
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = &webhookConnector{
		getter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("read")] = &readConnector{
		getter: b,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *ProvisioningAPIBuilder) GetRepository(ctx context.Context, name string) (Repository, error) {
	obj, err := b.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asRepository(obj)
}

func (b *ProvisioningAPIBuilder) asRepository(obj runtime.Object) (Repository, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing repository object")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository configuration")
	}

	switch r.Spec.Type {
	case provisioning.LocalRepositoryType:
		return newLocalRepository(r, b.localFileResolver), nil
	case provisioning.GithubRepositoryType:
		return newGithubRepository(r), nil
	case provisioning.S3RepositoryType:
		return newS3Repository(r), nil
	default:
	}
	return &unknownRepository{config: r}, nil
}

func (b *ProvisioningAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	repo, err := b.asRepository(obj)
	if err != nil {
		return err
	}

	// Typed validation
	list := repo.Validate()

	cfg := repo.Config()

	if cfg.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	// Reserved names (for now)
	reserved := []string{"classic", "SQL", "plugins", "legacy"}
	if slices.Contains(reserved, cfg.Name) {
		list = append(list, field.Invalid(field.NewPath("metadata", "name"), cfg.Name, "Name is reserved"))
	}

	if cfg.Spec.Type != provisioning.LocalRepositoryType && cfg.Spec.Local != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "local"),
			cfg.Spec.GitHub, "Local config only valid when type is local"))
	}

	if cfg.Spec.Type != provisioning.GithubRepositoryType && cfg.Spec.GitHub != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github"),
			cfg.Spec.GitHub, "Github config only valid when type is github"))
	}

	if cfg.Spec.Type != provisioning.S3RepositoryType && cfg.Spec.S3 != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "s3"),
			cfg.Spec.GitHub, "S3 config only valid when type is s3"))
	}

	if len(list) > 0 {
		return errors.NewInvalid(schema.GroupKind{
			Group: provisioning.GROUP,
			Kind:  "Repository", //??
		}, a.GetName(), list)
	}
	return nil
}

func (b *ProvisioningAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return provisioning.GetOpenAPIDefinitions
}

func (b *ProvisioningAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// TODO: this is where we could inject a non-k8s managed handler... webhook maybe?
	return nil
}

func (b *ProvisioningAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"

	// TODO: we might want to register some extras for subresources here.
	sub := oas.Paths.Paths[repoprefix+"/hello"]
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

	sub = oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil && sub.Get != nil {
		sub.Post.Description = "Currently only supports github webhooks"
	}

	// hide the version with no path
	delete(oas.Paths.Paths, repoprefix+"/read")

	// update the version with a path
	sub = oas.Paths.Paths[repoprefix+"/read/{path}"]
	if sub != nil && sub.Get != nil {
		sub.Get.Description = "Read value from upstream repository"
		sub.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "commit",
					In:          "query",
					Example:     "ca171cc730",
					Description: "optional commit hash for the requested file",
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
