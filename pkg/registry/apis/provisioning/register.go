package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
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

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	clientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	informers "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/pullrequest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/rendering"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const repoControllerWorkers = 1

var (
	_ builder.APIGroupBuilder               = (*APIBuilder)(nil)
	_ builder.APIGroupMutation              = (*APIBuilder)(nil)
	_ builder.APIGroupValidation            = (*APIBuilder)(nil)
	_ builder.APIGroupRouteProvider         = (*APIBuilder)(nil)
	_ builder.APIGroupPostStartHookProvider = (*APIBuilder)(nil)
	_ builder.OpenAPIPostProcessor          = (*APIBuilder)(nil)
)

type APIBuilder struct {
	urlProvider      func(namespace string) string
	webhookSecretKey string

	features          featuremgmt.FeatureToggles
	getter            rest.Getter
	localFileResolver *repository.LocalFolderResolver
	render            rendering.Service
	blobstore         blob.PublicBlobStore
	client            *resources.ClientFactory
	parsers           *resources.ParserFactory
	ghFactory         *github.Factory
	clonedir          string // where repo clones are managed
	jobs              jobs.JobQueue
	tester            *RepositoryTester
	resourceLister    resources.ResourceLister
	repositoryLister  listers.RepositoryLister
	legacyMigrator    legacy.LegacyMigrator
	storageStatus     dualwrite.Service
	unified           resource.ResourceClient
	secrets           secrets.Service
}

// NewAPIBuilder creates an API builder.
// It avoids anything that is core to Grafana, such that it can be used in a multi-tenant service down the line.
// This means there are no hidden dependencies, and no use of e.g. *settings.Cfg.
func NewAPIBuilder(
	local *repository.LocalFolderResolver,
	urlProvider func(namespace string) string,
	webhookSecretKey string,
	features featuremgmt.FeatureToggles,
	render rendering.Service,
	unified resource.ResourceClient,
	blobstore blob.PublicBlobStore,
	clonedir string, // where repo clones are managed
	configProvider apiserver.RestConfigProvider,
	ghFactory *github.Factory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
) *APIBuilder {
	clientFactory := resources.NewFactory(configProvider)
	return &APIBuilder{
		urlProvider:       urlProvider,
		localFileResolver: local,
		webhookSecretKey:  webhookSecretKey,
		features:          features,
		ghFactory:         ghFactory,
		client:            clientFactory,
		parsers: &resources.ParserFactory{
			Client: clientFactory,
		},
		render:         render,
		clonedir:       clonedir,
		resourceLister: resources.NewResourceLister(unified),
		blobstore:      blobstore,
		legacyMigrator: legacyMigrator,
		storageStatus:  storageStatus,
		unified:        unified,
		secrets:        secrets,
	}
}

// RegisterAPIService returns an API builder, from [NewAPIBuilder]. It is called by Wire.
// This function happily uses services core to Grafana, and does not need to be multi-tenancy-compatible.
func RegisterAPIService(
	// It is OK to use setting.Cfg here -- this is only used when running single tenant with a full setup
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
	render rendering.Service,
	client resource.ResourceClient, // implements resource.RepositoryClient
	configProvider apiserver.RestConfigProvider,
	ghFactory *github.Factory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	// FIXME: use multi-tenant service when one exists. In this state, we can't make this a multi-tenant service!
	secretssvc grafanasecrets.Service,
) (*APIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) &&
		!features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis OR the feature specifically
	}

	// TODO: use wire to initialize this storage
	store, err := blob.ProvidePublicBlobStore(cfg)
	if err != nil {
		return nil, err
	}

	folderResolver := &repository.LocalFolderResolver{
		PermittedPrefixes: cfg.PermittedProvisioningPaths,
		HomePath:          safepath.Clean(cfg.HomePath),
	}
	urlProvider := func(namespace string) string {
		return cfg.AppURL
	}

	builder := NewAPIBuilder(folderResolver, urlProvider, cfg.SecretKey, features,
		render, client, store,
		filepath.Join(cfg.DataPath, "clone"), // where repositories are cloned (temporarialy for now)
		configProvider, ghFactory,
		legacyMigrator, storageStatus,
		secrets.NewSingleTenant(secretssvc))
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			// TODO: Implement a better webhook authoriser somehow.
			if a.GetSubresource() == "webhook" {
				// for now????
				return authorizer.DecisionAllow, "", nil
			}

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
	b.getter = repositoryStorage
	b.jobs = jobs.NewJobQueue(50, b) // in memory for now

	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)

	storage := map[string]rest.Storage{}
	storage[provisioning.JobResourceInfo.StoragePath()] = b.jobs
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = &webhookConnector{
		getter: b,
		jobs:   b.jobs,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("test")] = &testConnector{
		getter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("files")] = &filesConnector{
		getter:  b,
		parsers: b.parsers,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("resources")] = &listConnector{
		getter: b,
		lister: b.resourceLister,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("history")] = &historySubresource{
		repoGetter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("sync")] = &syncConnector{
		repoGetter: b,
		jobs:       b.jobs,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("export")] = &exportConnector{
		repoGetter: b,
		jobs:       b.jobs,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("migrate")] = &migrateConnector{
		repoGetter: b,
		jobs:       b.jobs,
		dual:       b.storageStatus,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *APIBuilder) GetRepository(ctx context.Context, name string) (repository.Repository, error) {
	obj, err := b.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asRepository(ctx, obj)
}

func timeSince(when int64) time.Duration {
	return time.Duration(time.Now().UnixMilli()-when) * time.Millisecond
}

func (b *APIBuilder) GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error) {
	repo, err := b.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	status := repo.Config().Status.Health
	if !status.Healthy {
		if timeSince(status.Checked) > time.Second*25 {
			ctx, _, err = identity.WithProvisioningIdentitiy(ctx, repo.Config().Namespace)
			if err != nil {
				return nil, err // The status
			}

			// Check health again
			s, err := repository.TestRepository(ctx, repo)
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

func (b *APIBuilder) asRepository(ctx context.Context, obj runtime.Object) (repository.Repository, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing repository object")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository configuration")
	}
	return b.AsRepository(ctx, r)
}

func (b *APIBuilder) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
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
		return repository.NewGitHub(ctx, r, b.ghFactory, b.secrets, webhookURL)
	default:
		return nil, errors.New("unknown repository type")
	}
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

	// This is called on every update, so be careful to only add the finalizer for create
	if len(r.Finalizers) == 0 && a.GetOperation() == admission.Create {
		r.Finalizers = []string{
			controller.RemoveOrphanResourcesFinalizer,
			controller.CleanFinalizer,
		}
	}

	if r.Spec.Sync.IntervalSeconds == 0 {
		r.Spec.Sync.IntervalSeconds = 60
	}

	if r.Spec.Type == provisioning.GitHubRepositoryType {
		if r.Spec.GitHub == nil {
			return fmt.Errorf("github configuration is required")
		}

		// Trim trailing slash or .git
		if len(r.Spec.GitHub.URL) > 5 {
			r.Spec.GitHub.URL = strings.TrimRight(strings.TrimRight(r.Spec.GitHub.URL, "/"), ".git")
		}
	}

	if r.Spec.Workflows == nil {
		r.Spec.Workflows = []provisioning.Workflow{}
	}

	if err := b.encryptSecrets(ctx, r); err != nil {
		return fmt.Errorf("failed to encrypt secrets: %w", err)
	}

	return nil
}

func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	repo, err := b.asRepository(ctx, obj)
	if err != nil {
		return err
	}

	list := repository.ValidateRepository(repo)
	cfg := repo.Config()

	if a.GetOperation() == admission.Update {
		oldRepo, err := b.asRepository(ctx, a.GetOldObject())
		if err != nil {
			return fmt.Errorf("get old repository for update: %w", err)
		}
		oldCfg := oldRepo.Config()

		if cfg.Spec.Type != oldCfg.Spec.Type {
			list = append(list, field.Forbidden(field.NewPath("spec", "type"),
				"Changing repository type is not supported"))
		}

		// Do not allow changing the sync target once anything has synced successfully
		if cfg.Spec.Sync.Target != oldCfg.Spec.Sync.Target && len(cfg.Status.Stats) > 0 {
			list = append(list, field.Forbidden(field.NewPath("spec", "sync", "target"),
				"Changing sync target after running sync is not supported"))
		}
	}

	// Make sure there is only one
	targetError := b.verifySingleInstanceTarget(cfg)
	if targetError != nil {
		list = append(list, targetError)
	}

	if len(list) > 0 {
		return apierrors.NewInvalid(
			provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
			a.GetName(), list)
	}
	return nil
}

func (b *APIBuilder) verifySingleInstanceTarget(cfg *provisioning.Repository) *field.Error {
	if cfg.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
		all, err := b.repositoryLister.Repositories(cfg.Namespace).List(labels.Everything())
		if err != nil {
			return field.Forbidden(field.NewPath("spec", "sync", "target"),
				"Unable to verify root target // "+err.Error())
		}
		for _, v := range all {
			if v.Name != cfg.Name && v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
				return field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Another repository is already targeting root: "+v.Name)
			}
		}
	}
	return nil
}

func (b *APIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	postStartHooks := map[string]genericapiserver.PostStartHookFunc{
		"grafana-provisioning": func(postStartHookCtx genericapiserver.PostStartHookContext) error {
			c, err := clientset.NewForConfig(postStartHookCtx.LoopbackClientConfig)
			if err != nil {
				return err
			}

			// When starting with an empty instance -- swith to "mode 4+"
			err = b.tryRunningOnlyUnifiedStorage()
			if err != nil {
				return err
			}

			// Informer with resync interval used for health check and reconciliation
			sharedInformerFactory := informers.NewSharedInformerFactory(c, 10*time.Second)
			repoInformer := sharedInformerFactory.Provisioning().V0alpha1().Repositories()
			go repoInformer.Informer().Run(postStartHookCtx.Context.Done())

			// We do not have a local client until *GetPostStartHooks*, so we can delay init for some
			b.tester = &RepositoryTester{
				clientFactory: b.client,
				client:        c.ProvisioningV0alpha1(),
			}
			b.repositoryLister = repoInformer.Lister()

			b.jobs.Register(export.NewExportWorker(
				b.client,
				b.storageStatus,
				b.secrets,
				b.clonedir,
			))
			syncWorker := sync.NewSyncWorker(
				c.ProvisioningV0alpha1(),
				b.parsers,
				b.resourceLister,
				b.storageStatus,
			)
			b.jobs.Register(syncWorker)
			b.jobs.Register(migrate.NewMigrationWorker(
				b.client,
				b.legacyMigrator,
				b.parsers,
				b.storageStatus,
				b.unified,
				b.secrets,
				syncWorker,
				b.clonedir,
			))

			renderer := pullrequest.NewRenderer(b.render, b.blobstore)
			pullRequestWorker, err := pullrequest.NewPullRequestWorker(b.parsers, renderer, b.urlProvider)
			if err != nil {
				return fmt.Errorf("create pull request worker: %w", err)
			}
			b.jobs.Register(pullRequestWorker)

			repoController, err := controller.NewRepositoryController(
				c.ProvisioningV0alpha1(),
				repoInformer,
				b, // repoGetter
				b.resourceLister,
				b.parsers,
				&repository.Tester{},
				b.jobs,
				b.secrets,
				b.storageStatus,
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

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return provisioning.GetOpenAPIDefinitions
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1."

	sub := oas.Paths.Paths[repoprefix+"/test"]
	if sub != nil {
		repoSchema := defs[defsBase+"Repository"].Schema
		sub.Post.Description = "Check if the configuration is valid"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Required: false,
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

	sub = oas.Paths.Paths[repoprefix+"/sync"]
	if sub != nil {
		optionsSchema := defs[defsBase+"SyncJobOptions"].Schema
		sub.Post.Description = "Sync from repository into Grafana"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &optionsSchema,
							Example: &provisioning.SyncJobOptions{
								Incremental: false,
							},
						},
					},
				},
			},
		}
	}

	sub = oas.Paths.Paths[repoprefix+"/export"]
	if sub != nil {
		optionsSchema := defs[defsBase+"ExportJobOptions"].Schema
		sub.Post.Description = "Export from grafana into the remote repository"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &optionsSchema,
							Example: &provisioning.ExportJobOptions{
								Folder: "grafan-folder-ref",
								Branch: "target-branch",
								Prefix: "prefix/in/repo/tree",
							},
						},
					},
				},
			},
		}
	}

	sub = oas.Paths.Paths[repoprefix+"/migrate"]
	if sub != nil {
		optionsSchema := defs[defsBase+"MigrateJobOptions"].Schema
		sub.Post.Description = "Export from grafana into the remote repository"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &optionsSchema,
							Example: &provisioning.MigrateJobOptions{
								History: true,
								Prefix:  "prefix/in/repo/tree",
							},
						},
					},
				},
			},
		}
	}

	// Add any missing definitions
	//-----------------------------
	for k, v := range defs {
		clean := strings.Replace(k, defsBase, "com.github.grafana.grafana.pkg.apis.provisioning.v0alpha1.", 1)
		if oas.Components.Schemas[clean] == nil {
			oas.Components.Schemas[clean] = &v.Schema
		}
	}
	compBase := "com.github.grafana.grafana.pkg.apis.provisioning.v0alpha1."
	schema := oas.Components.Schemas[compBase+"ResourceStats"].Properties["items"]
	schema.Items = &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "ResourceCount"),
						},
					},
				},
			},
		},
	}
	oas.Components.Schemas[compBase+"ResourceStats"].Properties["items"] = schema

	schema = oas.Components.Schemas[compBase+"RepositoryViewList"].Properties["items"]
	schema.Items = &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "RepositoryView"),
						},
					},
				},
			},
		},
	}
	oas.Components.Schemas[compBase+"RepositoryViewList"].Properties["items"] = schema

	return oas, nil
}

func (b *APIBuilder) encryptSecrets(ctx context.Context, repo *provisioning.Repository) error {
	var err error
	if repo.Spec.GitHub != nil &&
		repo.Spec.GitHub.Token != "" {
		repo.Spec.GitHub.EncryptedToken, err = b.secrets.Encrypt(ctx, []byte(repo.Spec.GitHub.Token))
		if err != nil {
			return err
		}
		repo.Spec.GitHub.Token = ""
	}

	if repo.Status.Webhook != nil &&
		repo.Status.Webhook.Secret != "" {
		repo.Status.Webhook.EncryptedSecret, err = b.secrets.Encrypt(ctx, []byte(repo.Status.Webhook.Secret))
		if err != nil {
			return err
		}
		repo.Status.Webhook.Secret = ""
	}
	return nil
}

// FIXME: This logic does not belong in provisioning! (but required for now)
// When starting an empty instance, we shift so that we never reference legacy storage
// This should run somewhere else at startup by default (dual writer? dashboards?)
func (b *APIBuilder) tryRunningOnlyUnifiedStorage() error {
	ctx := context.Background()

	if !b.storageStatus.ShouldManage(dashboard.DashboardResourceInfo.GroupResource()) {
		return nil // not enabled
	}

	if !dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, b.storageStatus) {
		return nil
	}

	// Count how many things exist
	rsp, err := b.legacyMigrator.Migrate(ctx, legacy.MigrateOptions{
		Namespace: "default", // FIXME! this works for single org, but need to check multi-org
		Resources: []schema.GroupResource{{
			Group: dashboard.GROUP, Resource: dashboard.DASHBOARD_RESOURCE,
		}, {
			Group: folders.GROUP, Resource: folders.RESOURCE,
		}},
		OnlyCount: true,
	})
	if err != nil {
		return fmt.Errorf("error getting legacy count %w", err)
	}
	for _, stats := range rsp.Summary {
		if stats.Count > 0 {
			return nil // something exists we can not just switch
		}
	}

	logger := logging.DefaultLogger.With("logger", "provisioning startup")
	mode5 := func(gr schema.GroupResource) error {
		status, _ := b.storageStatus.Status(ctx, gr)
		if !status.ReadUnified {
			status.ReadUnified = true
			status.WriteLegacy = false
			status.WriteUnified = true
			status.Runtime = false
			status.Migrated = time.Now().UnixMilli()
			_, err = b.storageStatus.Update(ctx, status)
			logger.Info("set unified storage access", "group", gr.Group, "resource", gr.Resource)
			return err
		}
		return nil // already reading unified
	}

	if err = mode5(dashboard.DashboardResourceInfo.GroupResource()); err != nil {
		return err
	}
	if err = mode5(folders.FolderResourceInfo.GroupResource()); err != nil {
		return err
	}
	return nil
}
