package provisioning

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"path/filepath"
	"slices"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
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
	urlProvider      func(namespace string) string
	webhookSecretKey string

	getter            rest.Getter
	localFileResolver *LocalFolderResolver
	logger            *slog.Logger
	client            *resourceClient
}

// This constructor will be called when building a multi-tenant apiserveer
// Avoid adding anything that secretly requires additional hidden dependencies
// like *settings.Cfg or core grafana services that depend on database connections
func NewProvisioningAPIBuilder(
	local *LocalFolderResolver,
	urlProvider func(namespace string) string,
	webhookSecreteKey string,
	identities auth.BackgroundIdentityService,
) *ProvisioningAPIBuilder {
	return &ProvisioningAPIBuilder{
		urlProvider:       urlProvider,
		localFileResolver: local,
		logger:            slog.Default().With("logger", "provisioning-api-builder"),
		webhookSecretKey:  webhookSecreteKey,
		client:            newResourceClient(identities),
	}
}

func RegisterAPIService(
	// It is OK to use setting.Cfg here -- this is only used when running single tenant with a full setup
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
	identities auth.BackgroundIdentityService,
) *ProvisioningAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewProvisioningAPIBuilder(&LocalFolderResolver{
		ProvisioningPath: cfg.ProvisioningPath,
		DevenvPath:       filepath.Join(cfg.HomePath, "devenv"),
	}, func(namespace string) string {
		return cfg.AppURL
	}, cfg.SecretKey, identities)
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

	repositoryStorage.AfterCreate = b.afterCreate
	// AfterUpdate doesn't have the old object, so we have to use BeginUpdate
	repositoryStorage.BeginUpdate = b.beginUpdate
	repositoryStorage.AfterDelete = b.afterDelete

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
		client: b.client.identities,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("file")] = &readConnector{
		getter: b,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *ProvisioningAPIBuilder) GetRepository(ctx context.Context, name string) (Repository, error) {
	obj, err := b.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asRepository(ctx, obj)
}

func (b *ProvisioningAPIBuilder) asRepository(ctx context.Context, obj runtime.Object) (Repository, error) {
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
		return newGithubRepository(ctx, r), nil
	case provisioning.S3RepositoryType:
		return newS3Repository(r), nil
	default:
		return &unknownRepository{config: r}, nil
	}
}

func (b *ProvisioningAPIBuilder) afterCreate(obj runtime.Object, opts *metav1.CreateOptions) {
	cfg, ok := obj.(*provisioning.Repository)
	if !ok {
		b.logger.Error("object is not *provisioning.Repository")
		return
	}

	ctx := context.Background()
	repo, err := b.asRepository(ctx, cfg)
	if err != nil {
		b.logger.Error("failed to get repository", "error", err)
		return
	}

	if err := repo.AfterCreate(ctx); err != nil {
		b.logger.Error("failed to run after create", "error", err)
		return
	}
}

func (b *ProvisioningAPIBuilder) beginUpdate(ctx context.Context, obj, old runtime.Object, opts *metav1.UpdateOptions) (registry.FinishFunc, error) {
	objCfg, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("new object is not *provisioning.Repository")
	}
	oldCfg, ok := old.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("old object is not *provisioning.Repository")
	}

	repo, err := b.asRepository(ctx, objCfg)
	if err != nil {
		return nil, fmt.Errorf("get new repository: %w", err)
	}

	oldRepo, err := b.asRepository(ctx, oldCfg)
	if err != nil {
		return nil, fmt.Errorf("get old repository: %w", err)
	}

	undo, err := repo.BeginUpdate(ctx, oldRepo)
	if err != nil {
		return nil, err
	}

	return func(ctx context.Context, success bool) {
		if !success && undo != nil {
			if err := undo(ctx); err != nil {
				b.logger.Error("failed to undo failed update", "error", err)
			}
		}
	}, nil
}

func (b *ProvisioningAPIBuilder) afterDelete(obj runtime.Object, opts *metav1.DeleteOptions) {
	ctx := context.Background()
	cfg, ok := obj.(*provisioning.Repository)
	if !ok {
		b.logger.Error("object is not *provisioning.Repository")
		return
	}

	repo, err := b.asRepository(ctx, cfg)
	if err != nil {
		b.logger.Error("failed to get repository", "error", err)
		return
	}

	if err := repo.AfterDelete(ctx); err != nil {
		b.logger.Error("failed to run after delete", "error", err)
		return
	}
}
func (b *ProvisioningAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()

	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration")
	}

	if r.Spec.Type == provisioning.GithubRepositoryType {
		if r.Spec.GitHub == nil {
			return fmt.Errorf("github configuration is required")
		}

		if r.Spec.GitHub.Branch == "" {
			r.Spec.GitHub.Branch = "main"
		}

		if r.Spec.GitHub.WebhookURL == "" {
			gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
			r.Spec.GitHub.WebhookURL = fmt.Sprintf("%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
				b.urlProvider(a.GetNamespace()), // gets the full name
				gvr.Group, gvr.Version,
				a.GetNamespace(), gvr.Resource, a.GetName())
		}

		if r.Spec.GitHub.WebhookSecret == "" {
			r.Spec.GitHub.WebhookSecret = b.generateWebhookSecret(r.Spec.GitHub.Token)
		}
	}

	return nil
}

func (b *ProvisioningAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	repo, err := b.asRepository(ctx, obj)
	if err != nil {
		return err
	}

	// Typed validation
	list := repo.Validate()
	cfg := repo.Config()

	if a.GetOperation() == admission.Update {
		oldRepo, err := b.asRepository(ctx, a.GetOldObject())
		if err != nil {
			return fmt.Errorf("get old repository for update: %w", err)
		}

		if cfg.Spec.Type != oldRepo.Config().Spec.Type {
			list = append(list, field.Invalid(field.NewPath("spec", "type"),
				cfg.Spec.Type, "Changing repository type is not supported"))
		}
	}

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
	delete(oas.Paths.Paths, repoprefix+"/file")

	// update the version with a path
	sub = oas.Paths.Paths[repoprefix+"/file/{path}"]
	if sub != nil {
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

		// Add message to the OpenAPI spec
		comment := []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "message",
					In:          "query",
					Example:     "My commit message",
					Description: "for git properties this will be in the commit message",
					Schema:      spec.StringProperty(),
					Required:    false,
				},
			},
		}
		sub.Delete.Parameters = comment
		sub.Post.Parameters = comment
		sub.Put.Parameters = comment
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema:  spec.MapProperty(nil),
							Example: &unstructured.Unstructured{},
							Examples: map[string]*spec3.Example{
								"dashboard": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": map[string]interface{}{
													"hello": "dashboard",
												},
											},
										},
									},
								},
								"playlist": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": map[string]interface{}{
													"hello": "playlist",
												},
											},
										},
									},
								},
							},
						},
					},
					"application/x-yaml": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema:  spec.MapProperty(nil),
							Example: &unstructured.Unstructured{},
							Examples: map[string]*spec3.Example{
								"dashboard": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: dashboards.grafana.app/v0alpha1
kind: Dashboard
spec:
  title: Sample dashboard
`},
								},
								"playlist": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
spec:
  title: Playlist from provisioning
  interval: 5m
  items:
  - type: dashboard_by_tag
    value: panel-tests
`},
								},
							},
						},
					},
				},
			},
		}
		// POST and put have the same request
		sub.Put.RequestBody = sub.Post.RequestBody
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	return oas, nil
}

// generateWebhookSecret generates a webhook secret from a token
// using the configured secret key. The generated secret is consistent.
// TODO: this must be replaced by a app platform secrets once we have that.
func (b *ProvisioningAPIBuilder) generateWebhookSecret(token string) string {
	secretKey := []byte(b.webhookSecretKey)
	h := hmac.New(sha256.New, secretKey)

	h.Write([]byte(token))
	hashed := h.Sum(nil)

	return hex.EncodeToString(hashed)
}
