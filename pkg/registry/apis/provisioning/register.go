package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	commonMeta "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"

	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	movepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/loki"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/local"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources/signature"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/usage"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

// JobHistoryConfig holds configuration for job history backends
type JobHistoryConfig struct {
	Loki *loki.Config `json:"loki,omitempty"`
}

type APIBuilder struct {
	features   featuremgmt.FeatureToggles
	usageStats usagestats.Service

	tracer              tracing.Tracer
	getter              rest.Getter
	localFileResolver   *local.LocalFolderResolver
	parsers             resources.ParserFactory
	repositoryResources resources.RepositoryResourcesFactory
	clients             resources.ClientFactory
	ghFactory           *github.Factory
	jobs                interface {
		jobs.Queue
		jobs.Store
	}
	jobHistoryConfig *JobHistoryConfig
	jobHistoryLoki   *jobs.LokiJobHistory
	resourceLister   resources.ResourceLister
	repositoryLister listers.RepositoryLister
	legacyMigrator   legacy.LegacyMigrator
	storageStatus    dualwrite.Service
	unified          resource.ResourceClient
	decrypter        repository.Decrypter
	client           client.ProvisioningV0alpha1Interface
	access           authlib.AccessChecker
	mutators         []controller.Mutator
	statusPatcher    *controller.RepositoryStatusPatcher
	healthChecker    *controller.HealthChecker
	// Extras provides additional functionality to the API.
	extras                   []Extra
	availableRepositoryTypes map[provisioning.RepositoryType]bool
}

// NewAPIBuilder creates an API builder.
// It avoids anything that is core to Grafana, such that it can be used in a multi-tenant service down the line.
// This means there are no hidden dependencies, and no use of e.g. *settings.Cfg.
func NewAPIBuilder(
	local *local.LocalFolderResolver,
	features featuremgmt.FeatureToggles,
	unified resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
	ghFactory *github.Factory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	usageStats usagestats.Service,
	decryptSvc secret.DecryptService,
	access authlib.AccessChecker,
	tracer tracing.Tracer,
	extraBuilders []ExtraBuilder,
	jobHistoryConfig *JobHistoryConfig,
) *APIBuilder {
	clients := resources.NewClientFactory(configProvider)
	parsers := resources.NewParserFactory(clients)
	resourceLister := resources.NewResourceLister(unified, unified, legacyMigrator, storageStatus)

	mutators := []controller.Mutator{
		git.Mutator(),
		github.Mutator(),
	}

	b := &APIBuilder{
		mutators:            mutators,
		tracer:              tracer,
		usageStats:          usageStats,
		localFileResolver:   local,
		features:            features,
		ghFactory:           ghFactory,
		clients:             clients,
		parsers:             parsers,
		repositoryResources: resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister),
		resourceLister:      resourceLister,
		legacyMigrator:      legacyMigrator,
		storageStatus:       storageStatus,
		unified:             unified,
		decrypter:           repository.DecryptService(decryptSvc),
		access:              access,
		jobHistoryConfig:    jobHistoryConfig,
		availableRepositoryTypes: map[provisioning.RepositoryType]bool{
			provisioning.LocalRepositoryType:  true,
			provisioning.GitHubRepositoryType: true,
		},
	}

	for _, builder := range extraBuilders {
		b.extras = append(b.extras, builder(b))
	}

	// Add the available repository types and mutators from the extras
	for _, extra := range b.extras {
		for _, t := range extra.RepositoryTypes() {
			b.availableRepositoryTypes[t] = true
		}

		b.mutators = append(b.mutators, extra.Mutators()...)
	}

	return b
}

// createJobHistoryConfigFromSettings creates JobHistoryConfig from Grafana settings
func createJobHistoryConfigFromSettings(cfg *setting.Cfg) *JobHistoryConfig {
	// If LokiURL is defined, use Loki
	if cfg.ProvisioningLokiURL != "" {
		parsedURL, err := url.Parse(cfg.ProvisioningLokiURL)
		if err != nil {
			logging.DefaultLogger.Error("Invalid Loki URL in provisioning config", "url", cfg.ProvisioningLokiURL, "error", err)
			return &JobHistoryConfig{}
		}

		lokiCfg := &loki.Config{
			ReadPathURL:       parsedURL,
			WritePathURL:      parsedURL,
			BasicAuthUser:     cfg.ProvisioningLokiUser,
			BasicAuthPassword: cfg.ProvisioningLokiPassword,
			TenantID:          cfg.ProvisioningLokiTenantID,
			ExternalLabels: map[string]string{
				"source":       "grafana-provisioning",
				"service_name": "grafana-provisioning",
			},
			MaxQuerySize: 5000, // Default query size
		}

		return &JobHistoryConfig{
			Loki: lokiCfg,
		}
	}

	// Default to memory backend
	return &JobHistoryConfig{}
}

// RegisterAPIService returns an API builder, from [NewAPIBuilder]. It is called by Wire.
// This function happily uses services core to Grafana, and does not need to be multi-tenancy-compatible.
func RegisterAPIService(
	// It is OK to use setting.Cfg here -- this is only used when running single tenant with a full setup
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
	client resource.ResourceClient, // implements resource.RepositoryClient
	configProvider apiserver.RestConfigProvider,
	ghFactory *github.Factory,
	access authlib.AccessClient,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	usageStats usagestats.Service,
	decryptSvc secret.DecryptService,
	tracer tracing.Tracer,
	extraBuilders []ExtraBuilder,
) (*APIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		return nil, nil
	}

	folderResolver := &local.LocalFolderResolver{
		PermittedPrefixes: cfg.PermittedProvisioningPaths,
		HomePath:          safepath.Clean(cfg.HomePath),
	}
	builder := NewAPIBuilder(folderResolver, features,
		client,
		configProvider, ghFactory,
		legacyMigrator, storageStatus,
		usageStats,
		decryptSvc,
		access,
		tracer,
		extraBuilders,
		createJobHistoryConfigFromSettings(cfg),
	)
	apiregistration.RegisterAPI(builder)
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

			info, ok := authlib.AuthInfoFrom(ctx)
			if ok && authlib.IsIdentityType(info.GetIdentityType(), authlib.TypeAccessPolicy) {
				res, err := b.access.Check(ctx, info, authlib.CheckRequest{
					Verb:        a.GetVerb(),
					Group:       a.GetAPIGroup(),
					Resource:    a.GetResource(),
					Name:        a.GetName(),
					Namespace:   a.GetNamespace(),
					Subresource: a.GetSubresource(),
				})
				if err != nil {
					return authorizer.DecisionDeny, "failed to perform authorization", err
				}

				if !res.Allowed {
					return authorizer.DecisionDeny, "permission denied", nil
				}

				return authorizer.DecisionAllow, "", nil
			}
			// Different routes may need different permissions.
			// * Reading and modifying a repository's configuration requires administrator privileges.
			// * Reading a repository's limited configuration (/stats & /settings) requires viewer privileges.
			// * Reading a repository's files requires viewer privileges.
			// * Reading a repository's refs requires viewer privileges.
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

			// Check if any extra authorizer has a decision.
			for _, extra := range b.extras {
				decision, reason, err := extra.Authorize(ctx, a)
				if decision != authorizer.DecisionNoOpinion {
					return decision, reason, err
				}
			}

			switch a.GetResource() {
			case provisioning.RepositoryResourceInfo.GetName():
				// TODO: Support more fine-grained permissions than the basic roles. Especially on Enterprise.
				switch a.GetSubresource() {
				case "", "test", "jobs":
					// Doing something with the repository itself.
					if id.GetOrgRole().Includes(identity.RoleAdmin) {
						return authorizer.DecisionAllow, "", nil
					}
					return authorizer.DecisionDeny, "admin role is required", nil

				case "refs":
					// This is strictly a read operation. It is handy on the frontend for viewers.
					if id.GetOrgRole().Includes(identity.RoleViewer) {
						return authorizer.DecisionAllow, "", nil
					}
					return authorizer.DecisionDeny, "viewer role is required", nil
				case "files":
					// Access to files is controlled by the AccessClient
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

			case provisioning.JobResourceInfo.GetName(),
				provisioning.HistoricJobResourceInfo.GetName():
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

func (b *APIBuilder) GetJobQueue() jobs.Queue {
	return b.jobs
}

func (b *APIBuilder) GetStatusPatcher() *controller.RepositoryStatusPatcher {
	return b.statusPatcher
}

func (b *APIBuilder) GetHealthChecker() *controller.HealthChecker {
	return b.healthChecker
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

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	repositoryStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, provisioning.RepositoryResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}
	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)
	b.getter = repositoryStorage

	jobStore, err := grafanaregistry.NewCompleteRegistryStore(opts.Scheme, provisioning.JobResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create job storage: %w", err)
	}

	storage := map[string]rest.Storage{}
	// Create job history based on configuration
	// Default to unified storage if no config provided
	var jobHistory jobs.HistoryReader
	if b.jobHistoryConfig != nil && b.jobHistoryConfig.Loki != nil {
		b.jobHistoryLoki = jobs.NewLokiJobHistory(*b.jobHistoryConfig.Loki)
		jobHistory = b.jobHistoryLoki
	} else {
		historicJobStore, err := grafanaregistry.NewCompleteRegistryStore(opts.Scheme, provisioning.HistoricJobResourceInfo, opts.OptsGetter)
		if err != nil {
			return fmt.Errorf("create historic job storage: %w", err)
		}

		jobHistory, err = jobs.NewStorageBackedHistory(historicJobStore)
		if err != nil {
			return fmt.Errorf("create historic job wrapper: %w", err)
		}
		storage[provisioning.HistoricJobResourceInfo.StoragePath()] = historicJobStore
	}

	storage[provisioning.JobResourceInfo.StoragePath()] = jobStore
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage

	// TODO: Add some logic so that the connectors can registered themselves and we don't have logic all over the place
	storage[provisioning.RepositoryResourceInfo.StoragePath("test")] = NewTestConnector(b, &repository.Tester{}, b)
	storage[provisioning.RepositoryResourceInfo.StoragePath("files")] = NewFilesConnector(b, b.parsers, b.clients, b.access)
	storage[provisioning.RepositoryResourceInfo.StoragePath("refs")] = NewRefsConnector(b)
	storage[provisioning.RepositoryResourceInfo.StoragePath("resources")] = &listConnector{
		getter: b,
		lister: b.resourceLister,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("history")] = &historySubresource{
		repoGetter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("jobs")] = NewJobsConnector(b, b, jobHistory)

	// Add any extra storage
	for _, extra := range b.extras {
		if err := extra.UpdateStorage(storage); err != nil {
			return fmt.Errorf("update storage for extra %T: %w", extra, err)
		}
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

	// FIXME: Do nothing for HistoryJobs for now
	_, ok := obj.(*provisioning.HistoricJob)
	if ok {
		return nil
	}
	// FIXME: Do nothing for Jobs for now
	_, ok = obj.(*provisioning.Job)
	if ok {
		return nil
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

	if r.Spec.Workflows == nil {
		r.Spec.Workflows = []provisioning.Workflow{}
	}

	// Mutate the repository with any extra mutators
	for _, mutator := range b.mutators {
		if err := mutator(ctx, r); err != nil {
			return fmt.Errorf("failed to mutate repository: %w", err)
		}
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

	// FIXME: Do nothing for HistoryJobs for now
	_, ok := obj.(*provisioning.HistoricJob)
	if ok {
		return nil
	}

	// FIXME: Do nothing for Jobs for now
	_, ok = obj.(*provisioning.Job)
	if ok {
		return nil
	}

	repo, err := b.asRepository(ctx, obj, a.GetOldObject())
	if err != nil {
		return err
	}

	list := repository.ValidateRepository(repo)
	cfg := repo.Config()

	if a.GetOperation() == admission.Update {
		oldRepo, err := b.asRepository(ctx, a.GetOldObject(), nil)
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
		// Instance sync can only be created if NO other repositories exist
		for _, v := range all {
			if v.Name != cfg.Name {
				return field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Instance repository can only be created when no other repositories exist. Found: "+v.Name)
			}
		}
	} else {
		// Folder sync cannot be created if an instance repository exists
		for _, v := range all {
			if v.Spec.Sync.Target == provisioning.SyncTargetTypeInstance && v.Name != cfg.Name {
				return field.Forbidden(field.NewPath("spec", "sync", "target"),
					"Cannot create folder repository when instance repository exists: "+v.Name)
			}
		}
	}

	// Count repositories excluding the current one being created/updated
	count := 0
	for _, v := range all {
		if v.Name != cfg.Name {
			count++
		}
	}
	if count >= 10 {
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

			// Informer with resync interval used for health check and reconciliation
			sharedInformerFactory := informers.NewSharedInformerFactory(c, 60*time.Second)
			repoInformer := sharedInformerFactory.Provisioning().V0alpha1().Repositories()
			jobInformer := sharedInformerFactory.Provisioning().V0alpha1().Jobs()

			b.client = c.ProvisioningV0alpha1()
			b.repositoryLister = repoInformer.Lister()

			// Initialize the API client-based job store
			b.jobs, err = jobs.NewJobStore(b.client, 30*time.Second)
			if err != nil {
				return fmt.Errorf("create API client job store: %w", err)
			}

			b.statusPatcher = controller.NewRepositoryStatusPatcher(b.GetClient())
			b.healthChecker = controller.NewHealthChecker(&repository.Tester{}, b.statusPatcher)

			// if running solely CRUD, skip the rest of the setup
			if b.localFileResolver == nil {
				return nil
			}

			go repoInformer.Informer().Run(postStartHookCtx.Done())
			go jobInformer.Informer().Run(postStartHookCtx.Done())

			// When starting with an empty instance -- swith to "mode 4+"
			err = b.tryRunningOnlyUnifiedStorage()
			if err != nil {
				return err
			}

			// Create the repository resources factory
			usageMetricCollector := usage.MetricCollector(b.tracer, b.repositoryLister, b.unified)
			b.usageStats.RegisterMetricsFunc(usageMetricCollector)

			stageIfPossible := repository.WrapWithStageAndPushIfPossible
			exportWorker := export.NewExportWorker(
				b.clients,
				b.repositoryResources,
				export.ExportAll,
				stageIfPossible,
			)

			syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync)
			syncWorker := sync.NewSyncWorker(
				b.clients,
				b.repositoryResources,
				b.storageStatus,
				b.statusPatcher.Patch,
				syncer,
			)
			signerFactory := signature.NewSignerFactory(b.clients)
			legacyResources := migrate.NewLegacyResourcesMigrator(
				b.repositoryResources,
				b.parsers,
				b.legacyMigrator,
				signerFactory,
				b.clients,
				export.ExportAll,
			)
			storageSwapper := migrate.NewStorageSwapper(b.unified, b.storageStatus)
			legacyMigrator := migrate.NewLegacyMigrator(
				legacyResources,
				storageSwapper,
				syncWorker,
				stageIfPossible,
			)

			cleaner := migrate.NewNamespaceCleaner(b.clients)
			unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
				cleaner,
				exportWorker,
				syncWorker,
			)

			migrationWorker := migrate.NewMigrationWorker(
				legacyMigrator,
				unifiedStorageMigrator,
				b.storageStatus,
			)

			deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, b.repositoryResources)
			moveWorker := movepkg.NewWorker(syncWorker, stageIfPossible, b.repositoryResources)
			workers := []jobs.Worker{
				deleteWorker,
				exportWorker,
				migrationWorker,
				moveWorker,
				syncWorker,
			}

			// Create JobController to handle job create notifications
			jobController, err := appcontroller.NewJobController(jobInformer)
			if err != nil {
				return err
			}

			// Add any extra workers
			for _, extra := range b.extras {
				workers = append(workers, extra.GetJobWorkers()...)
			}

			var jobHistoryWriter jobs.HistoryWriter
			if b.jobHistoryLoki != nil {
				jobHistoryWriter = b.jobHistoryLoki
			} else {
				jobHistoryWriter = jobs.NewAPIClientHistoryWriter(b.GetClient())
			}

			// This is basically our own JobQueue system
			driver, err := jobs.NewConcurrentJobDriver(
				3,              // 3 drivers for now
				20*time.Minute, // Max time for each job
				time.Minute,    // Cleanup jobs
				30*time.Second, // Periodically look for new jobs
				30*time.Second, // Lease renewal interval
				b.jobs, b, jobHistoryWriter,
				jobController.InsertNotifications(),
				workers...,
			)
			if err != nil {
				return err
			}

			go func() {
				if err := driver.Run(postStartHookCtx.Context); err != nil {
					logging.FromContext(postStartHookCtx.Context).Error("job driver failed", "error", err)
				}
			}()

			repoController, err := controller.NewRepositoryController(
				b.GetClient(),
				repoInformer,
				b, // repoGetter
				b.resourceLister,
				b.parsers,
				b.clients,
				&repository.Tester{},
				b.jobs,
				b.storageStatus,
				b.GetHealthChecker(),
				b.statusPatcher,
			)
			if err != nil {
				return err
			}

			go repoController.Run(postStartHookCtx.Context, repoControllerWorkers)

			// If Loki not used, initialize the API client-based history writer and start the controller for history jobs
			if b.jobHistoryLoki == nil {
				// Create HistoryJobController for cleanup of old job history entries
				// Separate informer factory for HistoryJob cleanup with resync interval
				historyJobExpiration := 30 * time.Second
				historyJobInformerFactory := informers.NewSharedInformerFactory(c, historyJobExpiration)
				historyJobInformer := historyJobInformerFactory.Provisioning().V0alpha1().HistoricJobs()
				go historyJobInformer.Informer().Run(postStartHookCtx.Done())
				_, err = appcontroller.NewHistoryJobController(
					b.GetClient(),
					historyJobInformer,
					historyJobExpiration,
				)
				if err != nil {
					return fmt.Errorf("create history job controller: %w", err)
				}
			}

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

	// Hide the internal historic jobs endpoint from the OpenAPI spec.
	historicjobs := root + "namespaces/{namespace}/historicjobs"
	for path := range oas.Paths.Paths {
		if strings.HasPrefix(path, historicjobs) {
			delete(oas.Paths.Paths, path)
		}
	}

	repoprefix := root + "namespaces/{namespace}/repositories/{name}"
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1."
	refsBase := "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1."

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

	// Show refs endpoint documentation
	sub = oas.Paths.Paths[repoprefix+"/refs"]
	if sub != nil {
		sub.Get.Description = "Get the repository references"
		sub.Get.Summary = "Repository refs listing"
		sub.Get.Parameters = []*spec3.Parameter{}
		sub.Post = nil
		sub.Put = nil
		sub.Delete = nil

		// Replace the content type for this response
		mt := sub.Get.Responses.StatusCodeResponses[200].Content
		s := defs[defsBase+"RefList"].Schema
		mt["*/*"].Schema = &s
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
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "skipDryRun",
					In:          "query",
					Description: "do not pro-actively verify the payload",
					Schema:      spec.BooleanProperty(),
					Required:    false,
				},
			},
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "originalPath",
					In:          "query",
					Description: "path of file to move (used with POST method for move operations). Must be same type as target path: file-to-file (e.g., 'some/a.json' -> 'c/d.json') or folder-to-folder (e.g., 'some/' -> 'new/')",
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

	// Run all extra post-processors.
	for _, extra := range b.extras {
		if err := extra.PostProcessOpenAPI(oas); err != nil {
			return nil, fmt.Errorf("post-process OpenAPI for extra %T: %w", extra, err)
		}
	}

	// Add any missing definitions
	//-----------------------------
	for k, v := range defs {
		clean := strings.Replace(k, defsBase, "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.", 1)
		if oas.Components.Schemas[clean] == nil {
			oas.Components.Schemas[clean] = &v.Schema
		}
	}
	compBase := "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1."
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

	schema = oas.Components.Schemas[compBase+"ResourceStats"].Properties["unmanaged"]
	schema.Items = countSpec
	oas.Components.Schemas[compBase+"ResourceStats"].Properties["unmanaged"] = schema

	schema = oas.Components.Schemas[compBase+"ResourceStats"].Properties["managed"]
	schema.Items = managerSpec
	oas.Components.Schemas[compBase+"ResourceStats"].Properties["managed"] = schema

	schema = oas.Components.Schemas[compBase+"ManagerStats"].Properties["stats"]
	schema.Items = countSpec
	oas.Components.Schemas[compBase+"ManagerStats"].Properties["stats"] = schema

	return oas, nil
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
	return b.asRepository(ctx, obj, nil)
}

func (b *APIBuilder) GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error) {
	repo, err := b.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	status := repo.Config().Status.Health
	if !status.Healthy {
		return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusFailedDependency,
			Message: "The repository configuration is not healthy",
		}}
	}

	return repo, err
}

func (b *APIBuilder) asRepository(ctx context.Context, obj runtime.Object, old runtime.Object) (repository.Repository, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing repository object")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository configuration")
	}

	// Copy previous values if they exist
	if old != nil {
		o, ok := old.(*provisioning.Repository)
		if ok && !o.Secure.IsZero() {
			if r.Secure.Token.IsZero() {
				r.Secure.Token = o.Secure.Token
			}
			if r.Secure.WebhookSecret.IsZero() {
				r.Secure.WebhookSecret = o.Secure.WebhookSecret
			}
		}
	}

	return b.RepositoryFromConfig(ctx, r)
}

func (b *APIBuilder) RepositoryFromConfig(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	// Prepare a decrypter
	secure := b.decrypter(r)

	// Try first with any extra
	for _, extra := range b.extras {
		r, err := extra.AsRepository(ctx, r, secure)
		if err != nil {
			return nil, fmt.Errorf("convert repository for extra %T: %w", extra, err)
		}

		if r != nil {
			return r, nil
		}
	}

	var token commonMeta.RawSecureValue
	if r.Secure.Token.IsZero() {
		t, err := secure.Token(ctx)
		if err != nil {
			return nil, fmt.Errorf("unable to decrypt token: %w", err)
		}
		token = t
	}

	switch r.Spec.Type {
	case provisioning.BitbucketRepositoryType:
		return nil, errors.New("repository type bitbucket is not available")
	case provisioning.GitLabRepositoryType:
		return nil, errors.New("repository type gitlab is not available")
	case provisioning.LocalRepositoryType:
		return local.NewLocal(r, b.localFileResolver), nil
	case provisioning.GitRepositoryType:
		cfg := git.RepositoryConfig{
			URL:       r.Spec.Git.URL,
			Branch:    r.Spec.Git.Branch,
			Path:      r.Spec.Git.Path,
			TokenUser: r.Spec.Git.TokenUser,
			Token:     token,
		}

		return git.NewGitRepository(ctx, r, cfg)
	case provisioning.GitHubRepositoryType:
		logger := logging.FromContext(ctx).With("url", r.Spec.GitHub.URL, "branch", r.Spec.GitHub.Branch, "path", r.Spec.GitHub.Path)
		logger.Info("Instantiating Github repository")

		ghCfg := r.Spec.GitHub
		if ghCfg == nil {
			return nil, fmt.Errorf("github configuration is required for nano git")
		}

		gitCfg := git.RepositoryConfig{
			URL:    ghCfg.URL,
			Branch: ghCfg.Branch,
			Path:   ghCfg.Path,
			Token:  token,
		}

		gitRepo, err := git.NewGitRepository(ctx, r, gitCfg)
		if err != nil {
			return nil, fmt.Errorf("error creating git repository: %w", err)
		}

		ghRepo, err := github.NewGitHub(ctx, r, gitRepo, b.ghFactory, token)
		if err != nil {
			return nil, fmt.Errorf("error creating github repository: %w", err)
		}

		return ghRepo, nil
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
