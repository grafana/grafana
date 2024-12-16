package provisioning

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
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
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	clientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/lint"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

const (
	resourceNamePlaceholder = "$RESOURCE_NAME_PLACEHOLDER"
	repoControllerWorkers   = 1
)

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
	renderer          *renderer
	client            *resources.ClientFactory
	parsers           *resources.ParserFactory
	ghFactory         github.ClientFactory
	identities        auth.BackgroundIdentityService
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
		parsers: &resources.ParserFactory{
			Client: clientFactory,
			Logger: slog.Default().With("logger", "provisioning-parser-factory"),
		},
		renderer: &renderer{
			render:     render,
			blobstore:  blobstore,
			identities: identities,
		},
		jobs: jobs.NewJobQueue(50), // in memory for now
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
	}, cfg.SecretKey, identities, features, render, store, configProvider, ghFactory)
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

	b.jobs.Register(jobs.NewJobWorker(
		b,
		b.parsers,
		b.identities,
		b.logger.With("worker", "github"),
		provisioning.IncludeYamlOrJSON,
	))

	repositoryStorage.AfterCreate = b.afterCreate
	// AfterUpdate doesn't have the old object, so we have to use BeginUpdate
	repositoryStorage.BeginUpdate = b.beginUpdate
	repositoryStorage.AfterDelete = b.afterDelete

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
			// Check health again
			s, err := b.tester.TestRepository(ctx, repo)
			if err != nil {
				return nil, err // The status
			}

			// Write and return the repo with current status
			cfg, err := b.tester.UpdateHealthStatus(ctx, repo.Config(), s)
			if cfg.Status.Health.Healthy {
				status = cfg.Status.Health
				repo, err = b.AsRepository(ctx, cfg)
				if err != nil {
					return nil, err
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
		baseURL, err := url.Parse(b.urlProvider(r.GetNamespace()))
		if err != nil {
			return nil, fmt.Errorf("invalid base URL: %w", err)
		}

		// HACK: replace resource name placeholder in the webhook URL with the actual resource name
		// In case the name was automatically generated by k8s
		if r.Spec.GitHub.WebhookURL != "" {
			r.Spec.GitHub.WebhookURL = strings.ReplaceAll(r.Spec.GitHub.WebhookURL, resourceNamePlaceholder, r.GetName())
		}

		linterFactory := lint.NewDashboardLinterFactory()
		return repository.NewGitHub(ctx, r, b.ghFactory, baseURL, linterFactory, b.renderer), nil
	case provisioning.S3RepositoryType:
		return repository.NewS3(r), nil
	default:
		return repository.NewUnknown(r), nil
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

	if err := b.ensureRepositoryFolderExists(ctx, cfg); err != nil {
		b.logger.Error("failed to ensure repository folder exists", "error", err)
		return
	}

	if err := repo.AfterCreate(ctx, b.logger); err != nil {
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

	if err := b.ensureRepositoryFolderExists(ctx, objCfg); err != nil {
		return nil, fmt.Errorf("failed to ensure the configured folder exists: %w", err)
	}

	undo, err := repo.BeginUpdate(ctx, b.logger, oldRepo)
	if err != nil {
		b.logger.Warn("error in begin update", "err", err)
	}

	return func(ctx context.Context, success bool) {
		if !success && undo != nil {
			if err := undo(ctx); err != nil {
				b.logger.ErrorContext(ctx, "failed to undo failed update", "error", err)
			}
		}
	}, nil
}

func (b *ProvisioningAPIBuilder) ensureRepositoryFolderExists(ctx context.Context, cfg *provisioning.Repository) error {
	if cfg.Spec.Folder == "" {
		// The root folder can't not exist, so we don't have to do anything.
		return nil
	}

	client, _, err := b.client.New(cfg.GetNamespace())
	if err != nil {
		return err
	}
	// FIXME: make sure folders are actually enabled in the apiserver.
	folderIface := client.Resource(schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	})

	_, err = folderIface.Get(ctx, cfg.Spec.Folder, metav1.GetOptions{})
	if err == nil {
		// The folder exists and doesn't need to be created.
		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to search for existing repo folder: %w", err)
	}

	title := cfg.Spec.Title
	if title == "" {
		title = cfg.Spec.Folder
	}

	_, err = folderIface.Create(ctx, &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name":      cfg.Spec.Folder,
				"namespace": cfg.GetNamespace(),
			},
			"spec": map[string]any{
				"title":       title,
				"description": "Repository-managed folder.",
			},
		},
	}, metav1.CreateOptions{})
	return err
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

	if err := repo.AfterDelete(ctx, b.logger); err != nil {
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

	if r.Spec.Type == provisioning.GitHubRepositoryType {
		if r.Spec.GitHub == nil {
			return fmt.Errorf("github configuration is required")
		}

		if r.Spec.GitHub.Branch == "" {
			r.Spec.GitHub.Branch = "main"
		}

		if r.Spec.GitHub.WebhookURL == "" {
			name := a.GetName()
			// HACK: if the name is empty, it's probably auto-generated by k8s
			// we insert a placeholder so we can replace it later
			if name == "" {
				name = resourceNamePlaceholder
			}

			gvr := provisioning.RepositoryResourceInfo.GroupVersionResource()
			r.Spec.GitHub.WebhookURL = fmt.Sprintf("%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
				b.urlProvider(a.GetNamespace()), // gets the full name
				gvr.Group, gvr.Version,
				a.GetNamespace(), gvr.Resource, name)
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

			repoController, err := NewRepositoryController(
				c.ProvisioningV0alpha1(),
				repoInformer,
				b, // repoGetter
				b.identities,
			)
			if err != nil {
				return err
			}

			// We do not have a local client until *GetPostStartHooks*, so we can delay init for some
			b.tester = &RepositoryTester{
				clientFactory: b.client,
				client:        c.ProvisioningV0alpha1(),
				logger:        slog.Default().With("logger", "provisioning-repository-tester"),
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
