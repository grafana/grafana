package provisioning

import (
	"context"
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
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/readonly"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	clientset "github.com/grafana/grafana/pkg/generated/clientset/versioned"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/pullrequest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
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
	isPublic         bool

	features            featuremgmt.FeatureToggles
	getter              rest.Getter
	localFileResolver   *repository.LocalFolderResolver
	render              rendering.Service
	parsers             resources.ParserFactory
	repositoryResources resources.RepositoryResourcesFactory
	clients             resources.ClientFactory
	ghFactory           *github.Factory
	clonedir            string // where repo clones are managed
	jobs                interface {
		jobs.Queue
		jobs.Store
	}
	jobHistory       jobs.History
	tester           *RepositoryTester
	resourceLister   resources.ResourceLister
	repositoryLister listers.RepositoryLister
	legacyMigrator   legacy.LegacyMigrator
	storageStatus    dualwrite.Service
	unified          resource.ResourceClient
	secrets          secrets.Service
	client           client.ProvisioningV0alpha1Interface
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
	clonedir string, // where repo clones are managed
	configProvider apiserver.RestConfigProvider,
	ghFactory *github.Factory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
) *APIBuilder {
	// HACK: Assume is only public if it is HTTPS
	isPublic := strings.HasPrefix(urlProvider(""), "https://")

	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)

	return &APIBuilder{
		urlProvider:         urlProvider,
		localFileResolver:   local,
		webhookSecretKey:    webhookSecretKey,
		isPublic:            isPublic,
		features:            features,
		ghFactory:           ghFactory,
		clients:             clients,
		parsers:             parsers,
		repositoryResources: resources.NewRepositoryResourcesFactory(parsers, clients),
		render:              render,
		clonedir:            clonedir,
		resourceLister:      resources.NewResourceLister(unified, unified, legacyMigrator, storageStatus),
		legacyMigrator:      legacyMigrator,
		storageStatus:       storageStatus,
		unified:             unified,
		secrets:             secrets,
		jobHistory:          jobs.NewJobHistoryCache(),
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
	usageStatsService usagestats.Service,
	// FIXME: use multi-tenant service when one exists. In this state, we can't make this a multi-tenant service!
	secretsSvc grafanasecrets.Service,
) (*APIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) &&
		!features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis OR the feature specifically
	}

	folderResolver := &repository.LocalFolderResolver{
		PermittedPrefixes: cfg.PermittedProvisioningPaths,
		HomePath:          safepath.Clean(cfg.HomePath),
	}
	urlProvider := func(namespace string) string {
		return cfg.AppURL
	}

	builder := NewAPIBuilder(folderResolver, urlProvider, cfg.SecretKey, features,
		render, client,
		filepath.Join(cfg.DataPath, "clone"), // where repositories are cloned (temporarialy for now)
		configProvider, ghFactory,
		legacyMigrator, storageStatus,
		secrets.NewSingleTenant(secretsSvc),
	)
	apiregistration.RegisterAPI(builder)
	usageStatsService.RegisterMetricsFunc(builder.collectProvisioningStats)
	return builder, nil
}

// TODO: Move specific endpoint authorization together with the rest of the logic.
// so that things are not spread out all over the place.
func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
			if identity.IsServiceIdentity(ctx) {
				// A Grafana sub-system should have full access. We trust them to make wise decisions.
				return authorizer.DecisionAllow, "", nil
			}

			// Different routes may need different permissions.
			// * Reading and modifying a repository's configuration requires administrator privileges.
			// * Reading a repository's limited configuration (/stats & /settings) requires viewer privileges.
			// * Reading a repository's files requires viewer privileges.
			// * Editing a repository's files requires editor privileges.
			// * Syncing a repository requires editor privileges.
			// * Exporting a repository requires administrator privileges.
			// * Migrating a repository requires administrator privileges.
			// * Testing a repository configuration requires administrator privileges.
			// * Viewing a repository's history requires editor privileges.

			id, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "failed to find requester", err
			}

			switch a.GetResource() {
			case provisioning.RepositoryResourceInfo.GetName():
				// TODO: Support more fine-grained permissions than the basic roles. Especially on Enterprise.
				switch a.GetSubresource() {
				case "":
					// Doing something with the repository itself.
					if id.GetOrgRole().Includes(identity.RoleAdmin) {
						return authorizer.DecisionAllow, "", nil
					}
					return authorizer.DecisionDeny, "admin role is required", nil

				case "test", "export", "migrate":
					// Testing doesn't make sense for non-admins.
					// Exporting and migrating are potentially dangerous.
					if id.GetOrgRole().Includes(identity.RoleAdmin) {
						return authorizer.DecisionAllow, "", nil
					}
					return authorizer.DecisionDeny, "admin role is required", nil

				case "webhook":
					// When the resource is a webhook, we'll deal with permissions manually by checking signatures or similar in the webhook handler.
					// The user in this context is usually an anonymous user, but may also be an authenticated synthetic check by the Grafana instance's operator as well.
					// For context on the anonymous user, check the authn/clients/provisioning.go file.
					return authorizer.DecisionAllow, "", nil

				case "files":
					// Reading files is allowed for everyone, so as to allow code reviews and similar.
					// Writing files is only allowed fo Editor and higher.
					isViewer := id.GetOrgRole().Includes(identity.RoleViewer)
					isEditor := id.GetOrgRole().Includes(identity.RoleEditor)
					isReadOperation := a.GetVerb() == apiutils.VerbGet

					if isEditor || (isViewer && isReadOperation) {
						return authorizer.DecisionAllow, "", nil
					} else if isReadOperation {
						return authorizer.DecisionDeny, "viewer role is required for reads", nil
					} else {
						return authorizer.DecisionDeny, "editor role is required for edits", nil
					}

				case "render":
					// This is used to read a blob from unified storage, for GitHub PR comments.
					// GH uses a proxy for all images, so we need to accept it, always.
					return authorizer.DecisionAllow, "", nil

				case "resources", "sync", "history":
					// These are strictly read operations.
					// Sync can also be somewhat destructive, but it's expected to be fine to import changes.
					if id.GetOrgRole().Includes(identity.RoleEditor) {
						return authorizer.DecisionAllow, "", nil
					} else {
						return authorizer.DecisionDeny, "editor role is required", nil
					}

				default:
					if id.GetIsGrafanaAdmin() {
						return authorizer.DecisionAllow, "", nil
					}
					return authorizer.DecisionDeny, "unmapped subresource defaults to no access", nil
				}

			case "stats":
				// This can leak information one shouldn't necessarily have access to.
				if id.GetOrgRole().Includes(identity.RoleAdmin) {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "admin role is required", nil

			case "settings":
				// This is strictly a read operation. It is handy on the frontend for viewers.
				if id.GetOrgRole().Includes(identity.RoleViewer) {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "viewer role is required", nil

			case provisioning.JobResourceInfo.GetName():
				// Jobs are shown on the configuration page.
				if id.GetOrgRole().Includes(identity.RoleAdmin) {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "admin role is required", nil

			default:
				// We haven't bothered with this kind yet.
				if id.GetIsGrafanaAdmin() {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "unmapped kind defaults to no access", nil
			}
		})
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return provisioning.SchemeGroupVersion
}

func (b *APIBuilder) GetClient() client.ProvisioningV0alpha1Interface {
	return b.client
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
	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)
	b.getter = repositoryStorage

	realJobStore, err := grafanaregistry.NewCompleteRegistryStore(opts.Scheme, provisioning.JobResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create job storage: %w", err)
	}

	b.jobs, err = jobs.NewStore(realJobStore, time.Second*30)
	if err != nil {
		return fmt.Errorf("failed to create job store: %w", err)
	}

	storage := map[string]rest.Storage{}

	// Although we never interact with jobs via the API, we want them to be readable (watchable!) from the API.
	storage[provisioning.JobResourceInfo.StoragePath()] = readonly.Wrap(realJobStore)

	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage

	// TODO: Add some logic so that the connectors can registered themselves and we don't have logic all over the place
	// TODO: Do not set private fields directly, use factory methods.
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = NewWebhookConnector(b, b, b.jobs, b.isPublic)
	storage[provisioning.RepositoryResourceInfo.StoragePath("test")] = &testConnector{
		getter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("files")] = NewFilesConnector(b, b.parsers, b.clients)
	storage[provisioning.RepositoryResourceInfo.StoragePath("resources")] = &listConnector{
		getter: b,
		lister: b.resourceLister,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("history")] = &historySubresource{
		repoGetter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("jobs")] = &jobsConnector{
		repoGetter: b,
		jobs:       b.jobs,
		historic:   b.jobHistory,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("render")] = &renderConnector{
		blob: b.unified,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

// TODO: Move this to a more appropriate place. Probably controller/mutation.go
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

	// TODO: move this logic into github repository concrete implementation.
	if r.Spec.Type == provisioning.GitHubRepositoryType {
		if r.Spec.GitHub == nil {
			return fmt.Errorf("github configuration is required")
		}

		// Trim trailing slash or .git
		if len(r.Spec.GitHub.URL) > 5 {
			r.Spec.GitHub.URL = strings.TrimSuffix(r.Spec.GitHub.URL, ".git")
			r.Spec.GitHub.URL = strings.TrimSuffix(r.Spec.GitHub.URL, "/")
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

// TODO: move logic to a more appropriate place. Probably controller/validation.go
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect || a.GetOperation() == admission.Delete {
		return nil // This is normal for sub-resource
	}

	// Do not validate objects we are trying to delete
	meta, _ := apiutils.MetaAccessor(obj)
	if meta.GetDeletionTimestamp() != nil {
		return nil
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

	// Early exit to avoid more expensive checks if we have already found errors
	if len(list) > 0 {
		return invalidRepositoryError(a.GetName(), list)
	}

	// Exit early if we have already found errors
	targetError := b.verifyAgaintsExistingRepositories(cfg)
	if targetError != nil {
		return invalidRepositoryError(a.GetName(), field.ErrorList{targetError})
	}

	return nil
}

func invalidRepositoryError(name string, list field.ErrorList) error {
	return apierrors.NewInvalid(
		provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
		name, list)
}

// TODO: move this to a more appropriate place. Probably controller/validation.go
func (b *APIBuilder) verifyAgaintsExistingRepositories(cfg *provisioning.Repository) *field.Error {
	all, err := b.repositoryLister.Repositories(cfg.Namespace).List(labels.Everything())
	if err != nil {
		return field.Forbidden(field.NewPath("spec"),
			"Unable to verify root target: "+err.Error())
	}

	if cfg.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
		for _, v := range all {
			if v.Name != cfg.Name && v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance {
				return field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Another repository is already targeting root: "+v.Name)
			}
		}
	}

	if len(all) >= 10 {
		return field.Forbidden(field.NewPath("spec"),
			"Maximum number of 10 repositories reached")
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
			sharedInformerFactory := informers.NewSharedInformerFactory(c, 60*time.Second)
			repoInformer := sharedInformerFactory.Provisioning().V0alpha1().Repositories()
			go repoInformer.Informer().Run(postStartHookCtx.Context.Done())

			b.client = c.ProvisioningV0alpha1()

			// We do not have a local client until *GetPostStartHooks*, so we can delay init for some
			b.tester = &RepositoryTester{
				client: b.GetClient(),
			}

			b.repositoryLister = repoInformer.Lister()

			exportWorker := export.NewExportWorker(
				b.clients,
				b.repositoryResources,
				export.ExportAll,
				repository.WrapWithCloneAndPushIfPossible,
			)

			syncWorker := sync.NewSyncWorker(
				b.GetClient(),
				b.parsers,
				b.clients,
				b.resourceLister,
				b.storageStatus,
			)
			migrationWorker := migrate.NewMigrationWorker(
				b.legacyMigrator,
				b.parsers,
				b.clients,
				b.storageStatus,
				b.unified,
				exportWorker,
				syncWorker,
			)

			// Pull request worker
			renderer := pullrequest.NewScreenshotRenderer(b.render, b.unified, b.isPublic, b.urlProvider)
			previewer := pullrequest.NewPreviewer(renderer, b.urlProvider)
			pullRequestWorker := pullrequest.NewPullRequestWorker(b.parsers, previewer)

			driver := jobs.NewJobDriver(time.Second*28, time.Second*30, time.Second*30, b.jobs, b, b.jobHistory,
				exportWorker, syncWorker, migrationWorker, pullRequestWorker)
			go driver.Run(postStartHookCtx.Context)

			repoController, err := controller.NewRepositoryController(
				b.GetClient(),
				repoInformer,
				b, // repoGetter
				b.resourceLister,
				b.parsers,
				b.clients,
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

// TODO: move endpoint specific logic to the connector so that we don't have things spread out all over the place.
func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1."
	refsBase := "com.github.grafana.grafana.pkg.apis.provisioning.v0alpha1."

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

	sub = oas.Paths.Paths[repoprefix+"/jobs"]
	if sub != nil {
		sub.Post.Description = "Register a job for this repository"
		sub.Post.Responses = getJSONResponse("#/components/schemas/" + refsBase + "Job")
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &spec.Schema{
								SchemaProps: spec.SchemaProps{
									Ref: spec.MustCreateRef("#/components/schemas/" + refsBase + "JobSpec"),
								},
							},
							Examples: map[string]*spec3.Example{
								"incremental": {
									ExampleProps: spec3.ExampleProps{
										Summary:     "Pull (incremental)",
										Description: "look for changes since the last sync",
										Value: provisioning.JobSpec{
											Pull: &provisioning.SyncJobOptions{
												Incremental: true,
											},
										},
									},
								},
								"pull": {
									ExampleProps: spec3.ExampleProps{
										Summary:     "Pull from repository",
										Description: "pull all files",
										Value: provisioning.JobSpec{
											Pull: &provisioning.SyncJobOptions{
												Incremental: false,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}

		sub.Get.Description = "List recent jobs"
		sub.Get.Responses = getJSONResponse("#/components/schemas/" + refsBase + "JobList")
	}

	sub = oas.Paths.Paths[repoprefix+"/jobs/{path}"]
	if sub != nil {
		sub.Post = nil
		sub.Get.Description = "Get job by UID"
		sub.Get.Responses = getJSONResponse("#/components/schemas/" + refsBase + "Job")

		// Replace {path} with {uid} (it is a UID query, but all k8s sub-resources are called path)
		for _, v := range sub.Parameters {
			if v.Name == "path" {
				v.Name = "uid"
				v.Description = "Original Job UID"
				break
			}
		}

		delete(oas.Paths.Paths, repoprefix+"/jobs/{path}")
		oas.Paths.Paths[repoprefix+"/jobs/{uid}"] = sub
	}

	delete(oas.Paths.Paths, repoprefix+"/render")
	sub = oas.Paths.Paths[repoprefix+"/render/{path}"]
	if sub != nil {
		sub.Get.Description = "get a rendered preview image"
		sub.Get.Responses = &spec3.Responses{
			ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{
					200: {
						ResponseProps: spec3.ResponseProps{
							Content: map[string]*spec3.MediaType{
								"image/png": {},
							},
							Description: "OK",
						},
					},
				},
			},
		}

		// Replace {path} with {guid} (it is a GUID, but all k8s sub-resources are called path)
		for _, v := range sub.Parameters {
			if v.Name == "path" {
				v.Name = "guid"
				v.Description = "Image GUID"
				break
			}
		}

		delete(oas.Paths.Paths, repoprefix+"/render/{path}")
		oas.Paths.Paths[repoprefix+"/render/{guid}"] = sub
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
	schema := oas.Components.Schemas[compBase+"RepositoryViewList"].Properties["items"]
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

	countSpec := &spec.SchemaOrArray{
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
	managerSpec := &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "ManagerStats"),
						},
					},
				},
			},
		},
	}
	schema = oas.Components.Schemas[compBase+"ResourceStats"].Properties["instance"]
	schema.Items = countSpec
	oas.Components.Schemas[compBase+"ResourceStats"].Properties["instance"] = schema

	schema = oas.Components.Schemas[compBase+"ResourceStats"].Properties["managed"]
	schema.Items = managerSpec
	oas.Components.Schemas[compBase+"ResourceStats"].Properties["managed"] = schema

	schema = oas.Components.Schemas[compBase+"ManagerStats"].Properties["stats"]
	schema.Items = countSpec
	oas.Components.Schemas[compBase+"ManagerStats"].Properties["stats"] = schema

	return oas, nil
}

// TODO: move this to a more appropriate place
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

// Helpers for fetching valid Repository objects
// TODO: where should the helpers live?

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
			ctx, _, err = identity.WithProvisioningIdentity(ctx, repo.Config().Namespace)
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
		var webhookURL string
		if b.isPublic {
			webhookURL = fmt.Sprintf(
				"%sapis/%s/%s/namespaces/%s/%s/%s/webhook",
				b.urlProvider(r.GetNamespace()),
				gvr.Group,
				gvr.Version,
				r.GetNamespace(),
				gvr.Resource,
				r.GetName(),
			)
		}
		cloneFn := func(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
			return gogit.Clone(ctx, b.clonedir, r, opts, b.secrets)
		}

		return repository.NewGitHub(ctx, r, b.ghFactory, b.secrets, webhookURL, cloneFn)
	default:
		return nil, fmt.Errorf("unknown repository type (%s)", r.Spec.Type)
	}
}

func getJSONResponse(ref string) *spec3.Responses {
	return &spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{
			StatusCodeResponses: map[int]*spec3.Response{
				200: {
					ResponseProps: spec3.ResponseProps{
						Content: map[string]*spec3.MediaType{
							"application/json": {
								MediaTypeProps: spec3.MediaTypeProps{
									Schema: &spec.Schema{
										SchemaProps: spec.SchemaProps{
											Ref: spec.MustCreateRef(ref),
										},
									},
								},
							},
						},
						Description: "OK",
					},
				},
			},
		},
	}
}
