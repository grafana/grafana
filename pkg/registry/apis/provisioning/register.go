package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	clientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

const repoControllerWorkers = 1

var (
	_ builder.APIGroupBuilder = (*ProvisioningAPIBuilder)(nil)
	_ RepoGetter              = (*ProvisioningAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type ProvisioningAPIBuilder struct {
	urlProvider      func(namespace string) string
	webhookSecretKey string

	features          featuremgmt.FeatureToggles
	getter            rest.Getter
	localFileResolver *repository.LocalFolderResolver
	logger            *slog.Logger
	render            rendering.Service
	blobstore         blob.PublicBlobStore
	client            *resources.ClientFactory
	parsers           *resources.ParserFactory
	ghFactory         github.ClientFactory
	identities        auth.BackgroundIdentityService
	legacyExporter    legacy.LegacyExporter
	jobs              jobs.JobQueue
	tester            *RepositoryTester
}

// This constructor will be called when building a multi-tenant apiserveer
// Avoid adding anything that secretly requires additional hidden dependencies
// like *settings.Cfg or core grafana services that depend on database connections
func NewProvisioningAPIBuilder(
	local *repository.LocalFolderResolver,
	urlProvider func(namespace string) string,
	webhookSecretKey string,
	identities auth.BackgroundIdentityService,
	features featuremgmt.FeatureToggles,
	render rendering.Service,
	blobstore blob.PublicBlobStore,
	configProvider apiserver.RestConfigProvider,
	legacyExporter legacy.LegacyExporter,
	ghFactory github.ClientFactory,
) *ProvisioningAPIBuilder {
	clientFactory := resources.NewFactory(identities)
	builder := &ProvisioningAPIBuilder{
		urlProvider:       urlProvider,
		localFileResolver: local,
		logger:            slog.Default().With("logger", "provisioning-api-builder"),
		webhookSecretKey:  webhookSecretKey,
		features:          features,
		ghFactory:         ghFactory,
		identities:        identities,
		client:            clientFactory,
		legacyExporter:    legacyExporter,
		parsers: &resources.ParserFactory{
			Client: clientFactory,
			Logger: slog.Default().With("logger", "provisioning-parser-factory"),
		},
		render:    render,
		blobstore: blobstore,
		jobs:      jobs.NewJobQueue(50), // in memory for now
	}

	return builder
}

func RegisterAPIService(
	// It is OK to use setting.Cfg here -- this is only used when running single tenant with a full setup
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
	identities auth.BackgroundIdentityService,
	render rendering.Service,
	legacyExporter legacy.LegacyExporter,
	configProvider apiserver.RestConfigProvider,
	ghFactory github.ClientFactory,
) (*ProvisioningAPIBuilder, error) {
	if !(features.IsEnabledGlobally(featuremgmt.FlagProvisioning) ||
		features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs)) {
		return nil, nil // skip registration unless opting into experimental apis OR the feature specifically
	}

	// TODO: use wire to initialize this storage
	store, err := blob.ProvidePublicBlobStore(cfg)
	if err != nil {
		return nil, err
	}

	builder := NewProvisioningAPIBuilder(&repository.LocalFolderResolver{
		PermittedPrefixes: cfg.PermittedProvisioningPaths,
		HomePath:          safepath.Clean(cfg.HomePath),
	}, func(namespace string) string {
		return cfg.AppURL
	}, cfg.SecretKey, identities, features, render, store, configProvider, legacyExporter, ghFactory)
	apiregistration.RegisterAPI(builder)
	return builder, nil
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

	metav1.AddToGroupVersion(scheme, provisioning.SchemeGroupVersion)
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

	storage := map[string]rest.Storage{}
	storage[provisioning.JobResourceInfo.StoragePath()] = b.jobs
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	// Can be used by kubectl: kubectl --kubeconfig grafana.kubeconfig patch Repository local-devenv --type=merge --subresource=status --patch='status: {"currentGitCommit": "hello"}'
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = &webhookConnector{
		getter: b,
		client: b.identities,
		jobs:   b.jobs,
		logger: b.logger.With("connector", "webhook"),
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("test")] = &testConnector{
		getter: b,
		logger: b.logger.With("connector", "test"),
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("files")] = &filesConnector{
		getter:  b,
		parsers: b.parsers,
		logger:  b.logger.With("connector", "files"),
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("history")] = &historySubresource{
		repoGetter: b,
		logger:     b.logger.With("connector", "history"),
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("sync")] = &syncConnector{
		repoGetter: b,
		jobs:       b.jobs,
		logger:     b.logger.With("connector", "sync"),
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("export")] = &exportConnector{
		repoGetter: b,
		logger:     b.logger.With("connector", "export"),
		queue:      b.jobs,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *ProvisioningAPIBuilder) GetRepository(ctx context.Context, name string) (repository.Repository, error) {
	obj, err := b.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asRepository(ctx, obj)
}

func timeSince(when int64) time.Duration {
	return time.Duration(time.Now().UnixMilli()-when) * time.Millisecond
}

func (b *ProvisioningAPIBuilder) GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error) {
	repo, err := b.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	status := repo.Config().Status.Health
	if !status.Healthy {
		if timeSince(status.Checked) > time.Second*25 {
			id, err := b.identities.WorkerIdentity(ctx, repo.Config().Namespace)
			if err != nil {
				return nil, err // The status
			}
			ctx := identity.WithRequester(ctx, id)

			// Check health again
			s, err := b.tester.TestRepository(ctx, repo)
			if err != nil {
				return nil, err // The status
			}

			// Write and return the repo with current status
			cfg, _ := b.tester.UpdateHealthStatus(ctx, repo.Config(), s)
			if cfg != nil {
				status = cfg.Status.Health
				if cfg.Status.Health.Healthy {
					status = cfg.Status.Health
					repo, err = b.AsRepository(ctx, cfg)
					if err != nil {
						return nil, err
					}
				}
			}
		}
		if !status.Healthy {
			return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
				Code:    http.StatusFailedDependency,
				Message: "The repository configuration is not healthy",
			}}
		}
	}
	return repo, err
}

func (b *ProvisioningAPIBuilder) asRepository(ctx context.Context, obj runtime.Object) (repository.Repository, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing repository object")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository configuration")
	}
	return b.AsRepository(ctx, r)
}

func (b *ProvisioningAPIBuilder) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	switch r.Spec.Type {
	case provisioning.LocalRepositoryType:
		return repository.NewLocal(r, b.localFileResolver), nil
	case provisioning.GitHubRepositoryType:
		gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
		webhookURL := fmt.Sprintf(
			"%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
			b.urlProvider(r.GetNamespace()),
			gvr.Group,
			gvr.Version,
			r.GetNamespace(),
			gvr.Resource,
			r.GetName(),
		)
		secretsSvc := secrets.NewService(b.webhookSecretKey)
		return repository.NewGitHub(ctx, r, b.ghFactory, secretsSvc, webhookURL), nil
	case provisioning.S3RepositoryType:
		return repository.NewS3(r), nil
	default:
		return repository.NewUnknown(r), nil
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

	if r.Spec.Type == provisioning.GitHubRepositoryType {
		if r.Spec.GitHub == nil {
			return fmt.Errorf("github configuration is required")
		}

		if r.Spec.GitHub.Branch == "" {
			r.Spec.GitHub.Branch = "main"
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

	list := ValidateRepository(repo)

	if a.GetOperation() == admission.Update {
		cfg := repo.Config()
		oldRepo, err := b.asRepository(ctx, a.GetOldObject())
		if err != nil {
			return fmt.Errorf("get old repository for update: %w", err)
		}

		if cfg.Spec.Type != oldRepo.Config().Spec.Type {
			list = append(list, field.Invalid(field.NewPath("spec", "type"),
				cfg.Spec.Type, "Changing repository type is not supported"))
		}
	}

	if len(list) > 0 {
		return apierrors.NewInvalid(
			provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
			a.GetName(), list)
	}
	return nil
}

func (b *ProvisioningAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return provisioning.GetOpenAPIDefinitions
}

func (b *ProvisioningAPIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	postStartHooks := map[string]genericapiserver.PostStartHookFunc{
		"grafana-provisioning": func(postStartHookCtx genericapiserver.PostStartHookContext) error {
			c, err := clientset.NewForConfig(postStartHookCtx.LoopbackClientConfig)
			if err != nil {
				return err
			}
			sharedInformerFactory := informers.NewSharedInformerFactory(
				c,
				15*time.Minute, // Health check interval
			)

			repoInformer := sharedInformerFactory.Provisioning().V0alpha1().Repositories()
			go repoInformer.Informer().Run(postStartHookCtx.Context.Done())

			// We do not have a local client until *GetPostStartHooks*, so we can delay init for some
			b.tester = &RepositoryTester{
				clientFactory: b.client,
				client:        c.ProvisioningV0alpha1(),
				logger:        slog.Default().With("logger", "provisioning-repository-tester"),
			}

			b.jobs.Register(jobs.NewJobWorker(
				b,
				b.parsers,
				c.ProvisioningV0alpha1(),
				b.identities,
				b.logger.With("worker", "github"),
				b.render,
				b.blobstore,
				b.urlProvider,
			))

			repoController, err := NewRepositoryController(
				c.ProvisioningV0alpha1(),
				repoInformer,
				b, // repoGetter
				b.identities,
				b.tester,
				b.jobs,
			)
			if err != nil {
				return err
			}

			go repoController.Run(postStartHookCtx.Context, repoControllerWorkers)
			return nil
		},
	}
	return postStartHooks, nil
}

func (b *ProvisioningAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1."

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

	sub = oas.Paths.Paths[repoprefix+"/test"]
	if sub != nil {
		repoSchema := defs[defsBase+"Repository"].Schema
		sub.Post.Description = "Check if the configuration is valid"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &repoSchema,
						},
					},
				},
			},
		}
	}

	sub = oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil && sub.Get != nil {
		sub.Post.Description = "Currently only supports github webhooks"
	}

	ref := &spec3.Parameter{
		ParameterProps: spec3.ParameterProps{
			Name:    "ref",
			In:      "query",
			Example: "",
			Examples: map[string]*spec3.Example{
				"": {
					ExampleProps: spec3.ExampleProps{
						Summary: "The default",
					},
				},
				"branch": {
					ExampleProps: spec3.ExampleProps{
						Value:   "my-branch",
						Summary: "Select branch",
					},
				},
				"commit": {
					ExampleProps: spec3.ExampleProps{
						Value:   "7f7cc2153",
						Summary: "Commit hash (or prefix)",
					},
				},
			},
			Description: "branch or commit hash",
			Schema:      spec.StringProperty(),
			Required:    false,
		},
	}

	sub = oas.Paths.Paths[repoprefix+"/history"]
	if sub != nil {
		sub.Get.Description = "Get the history of the repository"
		sub.Get.Parameters = []*spec3.Parameter{ref}
	}

	sub = oas.Paths.Paths[repoprefix+"/history/{path}"]
	if sub != nil {
		sub.Get.Description = "Get the history of a path"
		sub.Get.Parameters = []*spec3.Parameter{ref}
	}

	// Show a special list command
	sub = oas.Paths.Paths[repoprefix+"/files"]
	if sub != nil {
		delete(oas.Paths.Paths, repoprefix+"/files")
		oas.Paths.Paths[repoprefix+"/files/"] = sub // add the trailing final slash
		sub.Get.Description = "Get the files and content hash"
		sub.Get.Summary = "File listing"
		sub.Get.Parameters = []*spec3.Parameter{ref}
		sub.Post = nil
		sub.Put = nil
		sub.Delete = nil

		// Replace the content type for this response
		mt := sub.Get.Responses.StatusCodeResponses[200].Content
		s := defs[defsBase+"FileList"].Schema
		mt["*/*"].Schema = &s
	}

	// update the version with a path
	sub = oas.Paths.Paths[repoprefix+"/files/{path}"]
	if sub != nil {
		sub.Get.Description = "Read value from upstream repository"
		sub.Get.Parameters = []*spec3.Parameter{ref}

		// Add message to the OpenAPI spec
		comment := []*spec3.Parameter{
			ref,
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "message",
					In:          "query",
					Description: "optional message sent with any changes",
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
`,
									},
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
`,
									},
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
