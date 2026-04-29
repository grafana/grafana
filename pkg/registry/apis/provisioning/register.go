package provisioning

import (
	"context"
	"fmt"
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
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	appadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informers "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	appjobs "github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/auditing"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	deletepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/delete"
	deleteresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/deleteresources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/fixfoldermetadata"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/migrate"
	movepkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/move"
	releaseresourcespkg "github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/releaseresources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/usage"
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

// ErrRepositoryParentFolderConflict and ErrRepositoryDuplicatePath are deprecated.
// Use repository.ErrRepositoryParentFolderConflict and repository.ErrRepositoryDuplicatePath instead.
var (
	ErrRepositoryParentFolderConflict = repository.ErrRepositoryParentFolderConflict
	ErrRepositoryDuplicatePath        = repository.ErrRepositoryDuplicatePath
)

// JobHistoryConfig holds configuration for job history backends
type JobHistoryConfig struct {
	Loki *loki.Config `json:"loki,omitempty"`
}

type APIBuilder struct {
	gv schema.GroupVersion

	// onlyApiServer used to disable starting controllers for the standalone API server.
	// HACK:This will be removed once we have proper wire providers for the controllers.
	// TODO: Set this up in the standalone API server
	onlyApiServer                       bool
	isPreferredVersion                  bool
	useExclusivelyAccessCheckerForAuthz bool

	allowedTargets      []provisioning.SyncTargetType
	allowImageRendering bool
	minSyncInterval     time.Duration

	features   featuremgmt.FeatureToggles
	usageStats usagestats.Service

	tracer              tracing.Tracer
	repoStore           grafanarest.Storage
	repoLister          repository.RepositoryByConnectionLister
	repoValidator       repository.Validator
	connectionStore     grafanarest.Storage
	parsers             resources.ParserFactory
	repositoryResources resources.RepositoryResourcesFactory
	clients             resources.ClientFactory
	jobs                interface {
		jobs.Queue
		jobs.Store
	}
	jobHistoryConfig  *JobHistoryConfig
	jobHistoryLoki    *jobs.LokiJobHistory
	resourceLister    resources.ResourceLister
	unified           resource.ResourceClient
	repoFactory       repository.Factory
	connectionFactory connection.Factory
	client            client.ProvisioningV0alpha1Interface
	access            auth.AccessChecker
	accessWithAdmin   auth.AccessChecker
	accessWithEditor  auth.AccessChecker
	accessWithViewer  auth.AccessChecker
	statusPatcher     *appcontroller.RepositoryStatusPatcher
	healthChecker     *controller.RepositoryHealthChecker
	admissionHandler  *appadmission.Handler
	// Extras provides additional functionality to the API.
	extras       []Extra
	extraWorkers []jobs.Worker

	restConfigGetter              func(context.Context) (*clientrest.Config, error)
	registry                      prometheus.Registerer
	quotaGetter                   quotas.QuotaGetter
	folderMetadataEnabled         bool
	maxIncrementalChanges         int
	maxFileSize                   int64
	folderAPIVersion              string
	webhookSecretRotationInterval time.Duration
}

// NewAPIBuilder creates an API builder for the provisioning API.
//
// This function supports registering multiple API versions (e.g., v0alpha1, v1beta1) by creating
// separate API builders for each version. The same types are served under different versions using
// OpenAPI schema transformation.
//
// Key parameters for multi-version support:
//   - gv: The GroupVersion (group + version) this builder serves. This determines which API version
//     the builder registers (e.g., "provisioning.grafana.app/v0alpha1" or "provisioning.grafana.app/v1beta1").
//     The version is used to generate the correct API paths (/apis/{group}/{version}/...) and to
//     transform OpenAPI schemas to match the version.
//   - isPreferredVersion: Indicates whether this version is the preferred/default version for the API group.
//     Only ONE version should be marked as preferred. The preferred version is used by kubectl and other
//     clients when they query the API without specifying a version. It also controls which version runs
//     the controllers and background workers (only the preferred version starts these to avoid duplicates).
//
// It avoids anything that is core to Grafana, such that it can be used in a multi-tenant service down the line.
// This means there are no hidden dependencies, and no use of e.g. *settings.Cfg.
func NewAPIBuilder(
	gv schema.GroupVersion,
	isPreferredVersion bool,
	onlyApiServer bool,
	repoFactory repository.Factory,
	connectionFactory connection.Factory,
	features featuremgmt.FeatureToggles,
	unified resource.ResourceClient,
	configProvider apiserver.RestConfigProvider,
	storageStatus dualwrite.Service,
	usageStats usagestats.Service,
	access authlib.AccessChecker,
	tracer tracing.Tracer,
	extraBuilders []ExtraBuilder,
	extraWorkers []jobs.Worker,
	jobHistoryConfig *JobHistoryConfig,
	allowedTargets []provisioning.SyncTargetType,
	restConfigGetter func(context.Context) (*clientrest.Config, error),
	allowImageRendering bool,
	minSyncInterval time.Duration,
	registry prometheus.Registerer,
	newStandaloneClientFactoryFunc func(loopbackConfigProvider apiserver.RestConfigProvider) resources.ClientFactory,
	useExclusivelyAccessCheckerForAuthz bool,
	quotaGetter quotas.QuotaGetter,
	folderMetadataEnabled bool,
	folderAPIVersion string,
	maxIncrementalChanges int,
	maxFileSize int64,
) (*APIBuilder, error) {
	var clients resources.ClientFactory
	if newStandaloneClientFactoryFunc != nil {
		clients = newStandaloneClientFactoryFunc(configProvider)
	} else {
		clients = resources.NewClientFactory(configProvider)
	}
	if gv.Version == "" {
		return nil, fmt.Errorf("invalid provisioning group/version")
	}

	parsers := resources.NewParserFactory(clients, folderMetadataEnabled)
	resourceLister := resources.NewResourceListerForMigrations(unified)

	// Create access checker based on mode
	var accessChecker auth.AccessChecker
	if useExclusivelyAccessCheckerForAuthz {
		accessChecker = auth.NewTokenAccessChecker(access)
	} else {
		accessChecker = auth.NewSessionAccessChecker(access)
	}

	b := &APIBuilder{
		gv:                                  gv,
		onlyApiServer:                       onlyApiServer,
		isPreferredVersion:                  isPreferredVersion,
		minSyncInterval:                     minSyncInterval,
		tracer:                              tracer,
		usageStats:                          usageStats,
		features:                            features,
		repoFactory:                         repoFactory,
		connectionFactory:                   connectionFactory,
		clients:                             clients,
		parsers:                             parsers,
		repositoryResources:                 resources.NewRepositoryResourcesFactory(parsers, clients, resourceLister, features.IsEnabledGlobally(featuremgmt.FlagProvisioningFolderMetadata), folderAPIVersion), //nolint:staticcheck
		resourceLister:                      resourceLister,
		unified:                             unified,
		access:                              accessChecker,
		accessWithAdmin:                     accessChecker.WithFallbackRole(identity.RoleAdmin),
		accessWithEditor:                    accessChecker.WithFallbackRole(identity.RoleEditor),
		accessWithViewer:                    accessChecker.WithFallbackRole(identity.RoleViewer),
		jobHistoryConfig:                    jobHistoryConfig,
		extraWorkers:                        extraWorkers,
		restConfigGetter:                    restConfigGetter,
		allowedTargets:                      allowedTargets,
		allowImageRendering:                 allowImageRendering,
		registry:                            registry,
		useExclusivelyAccessCheckerForAuthz: useExclusivelyAccessCheckerForAuthz,
		quotaGetter:                         quotaGetter,
		folderMetadataEnabled:               folderMetadataEnabled,
		folderAPIVersion:                    folderAPIVersion,
		maxIncrementalChanges:               maxIncrementalChanges,
		maxFileSize:                         maxFileSize,
	}

	for _, builder := range extraBuilders {
		b.extras = append(b.extras, builder(b))
	}

	return b, nil
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
	access authlib.AccessClient,
	storageStatus dualwrite.Service,
	usageStats usagestats.Service,
	tracer tracing.Tracer,
	extraBuilders []ExtraBuilder,
	extraWorkers []jobs.Worker,
	repoFactory repository.Factory,
	connectionFactory connection.Factory,
	quotaGetter quotas.QuotaGetter,
) (*APIBuilder, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		return nil, nil
	}

	allowedTargets := []provisioning.SyncTargetType{}
	for _, target := range cfg.ProvisioningAllowedTargets {
		allowedTargets = append(allowedTargets, provisioning.SyncTargetType(target))
	}

	jobHistoryConfig := createJobHistoryConfigFromSettings(cfg)
	folderMetadataEnabled := features.IsEnabledGlobally(featuremgmt.FlagProvisioningFolderMetadata) //nolint:staticcheck
	folderAPIVersion := cfg.ProvisioningFolderAPIVersion
	maxIncrementalChanges := cfg.ProvisioningMaxIncrementalChanges
	maxFileSize := cfg.ProvisioningMaxFileSize

	// Register v0alpha1 (preferred version)
	builder, err := NewAPIBuilder(
		schema.GroupVersion{
			Group:   provisioning.GROUP,
			Version: provisioning.VERSION, // v0alpha1
		},
		true,                   // isPreferredVersion
		cfg.DisableControllers, // onlyApiServer
		repoFactory,
		connectionFactory,
		features,
		client,
		configProvider,
		storageStatus,
		usageStats,
		access,
		tracer,
		extraBuilders,
		extraWorkers,
		jobHistoryConfig,
		allowedTargets,
		nil, // restConfigGetter - will use loopback instead
		cfg.ProvisioningAllowImageRendering,
		cfg.ProvisioningMinSyncInterval,
		reg,
		nil,   // newStandaloneClientFactoryFunc
		false, // useExclusivelyAccessCheckerForAuthz - TODO: first, test this on the MT side before we enable it by default in ST as well
		quotaGetter,
		folderMetadataEnabled,
		folderAPIVersion,
		maxIncrementalChanges,
		maxFileSize,
	)
	if err != nil {
		return nil, err
	}
	builder.webhookSecretRotationInterval = cfg.ProvisioningWebhookSecretRotationInterval
	apiregistration.RegisterAPI(builder)

	// Register v1beta1
	v1beta1Builder, err := NewAPIBuilder(
		schema.GroupVersion{
			Group:   provisioning.GROUP,
			Version: "v1beta1",
		},
		false, // isPreferredVersion
		true,  // onlyApiServer
		repoFactory,
		connectionFactory,
		features,
		client,
		configProvider,
		storageStatus,
		usageStats,
		access,
		tracer,
		extraBuilders,
		extraWorkers,
		jobHistoryConfig,
		allowedTargets,
		nil, // restConfigGetter
		cfg.ProvisioningAllowImageRendering,
		cfg.ProvisioningMinSyncInterval,
		reg,
		nil,   // newStandaloneClientFactoryFunc
		false, // useExclusivelyAccessCheckerForAuthz
		quotaGetter,
		folderMetadataEnabled,
		folderAPIVersion,
		maxIncrementalChanges,
		maxFileSize,
	)
	if err != nil {
		return nil, err
	}
	v1beta1Builder.webhookSecretRotationInterval = cfg.ProvisioningWebhookSecretRotationInterval
	apiregistration.RegisterAPI(v1beta1Builder)

	// Return the preferred (v0alpha1) builder since it runs controllers/workers
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

			// Check if any extra authorizer has a decision.
			// Since the move to access checker when useExclusivelyAccessCheckerForAuthz=true, extra authorizers
			// need to run first because access checker is not aware of the extras logic
			for _, extra := range b.extras {
				decision, reason, err := extra.Authorize(ctx, a)
				if decision != authorizer.DecisionNoOpinion {
					return decision, reason, err
				}
			}

			return b.authorizeResource(ctx, a)
		})
}

// authorizeResource handles authorization for different resources.
// Uses fine-grained permissions defined in accesscontrol.go:
//
// Repositories:
//   - CRUD: repositories:create/read/write/delete
//   - Subresources: files (any auth), refs (editor), resources/history/status (admin)
//   - Test: repositories:write
//   - Jobs subresource: jobs:create/read
//
// Connections:
//   - CRUD: connections:create/read/write/delete
//   - Status: connections:read
//
// Jobs:
//   - CRUD: jobs:create/read/write/delete
//
// Historic Jobs:
//   - Read-only: historicjobs:read
//
// Settings:
//   - settings:read - granted to Viewer (all logged-in users)
//
// Stats:
//   - stats:read - granted to Admin only
func (b *APIBuilder) authorizeResource(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
	switch a.GetResource() {
	case provisioning.RepositoryResourceInfo.GetName():
		return b.authorizeRepositorySubresource(ctx, a)
	case provisioning.ConnectionResourceInfo.GetName():
		return b.authorizeConnectionSubresource(ctx, a)
	case provisioning.JobResourceInfo.GetName():
		return toAuthorizerDecision(b.accessWithEditor.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  provisioning.JobResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))
	case provisioning.HistoricJobResourceInfo.GetName():
		// Historic jobs are read-only and admin-only (not editor)
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  provisioning.HistoricJobResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))
	case "settings":
		// Settings are read-only and accessible by all logged-in users (Viewer role)
		return toAuthorizerDecision(b.accessWithViewer.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  "settings",
			Namespace: a.GetNamespace(),
		}, ""))
	case "stats":
		// Stats are read-only and admin-only
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  "stats",
			Namespace: a.GetNamespace(),
		}, ""))
	default:
		return b.authorizeDefault(ctx)
	}
}

// authorizeRepositorySubresource handles authorization for repository subresources.
// Uses the access checker with verb-based authorization.
func (b *APIBuilder) authorizeRepositorySubresource(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
	switch a.GetSubresource() {
	// Repository CRUD - viewers can read, admins can write
	case "":
		verb := a.GetVerb()
		// Read operations (get, list, watch) are allowed for viewers
		// Write operations (create, update, patch, delete) require admin
		accessChecker := b.accessWithAdmin
		if verb == "get" || verb == "list" || verb == "watch" {
			accessChecker = b.accessWithViewer
		}
		return toAuthorizerDecision(accessChecker.Check(ctx, authlib.CheckRequest{
			Verb:      verb,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Test requires write permission (testing before save)
	case "test":
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      apiutils.VerbUpdate,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Files subresource: allow any authenticated user at route level.
	// Directory listing checks repositories:read in the connector.
	// Individual file operations are authorized by DualReadWriter based on the actual resource.
	case "files":
		return authorizer.DecisionAllow, "", nil

	// refs subresource - editors need to see branches to push changes
	case "refs":
		return toAuthorizerDecision(b.accessWithEditor.Check(ctx, authlib.CheckRequest{
			Verb:      apiutils.VerbGet,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Read-only subresources: resources, history, status (admin only)
	case "resources", "history", "status":
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      apiutils.VerbGet,
			Group:     provisioning.GROUP,
			Resource:  provisioning.RepositoryResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Jobs subresource - check jobs permissions with the verb (editors can manage jobs)
	case "jobs":
		return toAuthorizerDecision(b.accessWithEditor.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  provisioning.JobResourceInfo.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	default:
		id, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "failed to find requester", err
		}
		if id.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "unmapped subresource defaults to no access", nil
	}
}

// authorizeConnectionSubresource handles authorization for connection subresources.
// Uses the access checker with verb-based authorization.
func (b *APIBuilder) authorizeConnectionSubresource(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
	switch a.GetSubresource() {
	// Connection CRUD - use access checker with the actual verb
	case "":
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      a.GetVerb(),
			Group:     provisioning.GROUP,
			Resource:  provisioning.ConnectionResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Status is read-only
	case "status":
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      apiutils.VerbGet,
			Group:     provisioning.GROUP,
			Resource:  provisioning.ConnectionResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	// Repositories is read-only
	case "repositories":
		return toAuthorizerDecision(b.accessWithAdmin.Check(ctx, authlib.CheckRequest{
			Verb:      apiutils.VerbGet,
			Group:     provisioning.GROUP,
			Resource:  provisioning.ConnectionResourceInfo.GetName(),
			Name:      a.GetName(),
			Namespace: a.GetNamespace(),
		}, ""))

	default:
		id, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "failed to find requester", err
		}
		if id.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "unmapped subresource defaults to no access", nil
	}
}

// ----------------------------------------------------------------------------
// Authorization helpers
// ----------------------------------------------------------------------------

// toAuthorizerDecision converts an access check error to an authorizer decision tuple.
func toAuthorizerDecision(err error) (authorizer.Decision, string, error) {
	if err != nil {
		return authorizer.DecisionDeny, err.Error(), nil
	}
	return authorizer.DecisionAllow, "", nil
}

// authorizeDefault handles authorization for unmapped resources.
func (b *APIBuilder) authorizeDefault(ctx context.Context) (authorizer.Decision, string, error) {
	id, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "failed to find requester", err
	}
	// We haven't bothered with this kind yet.
	if id.GetIsGrafanaAdmin() {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "unmapped kind defaults to no access", nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func (b *APIBuilder) GetClient() client.ProvisioningV0alpha1Interface {
	return b.client
}

func (b *APIBuilder) GetJobQueue() jobs.Queue {
	return b.jobs
}

func (b *APIBuilder) GetStatusPatcher() *appcontroller.RepositoryStatusPatcher {
	return b.statusPatcher
}

func (b *APIBuilder) GetHealthChecker() *controller.RepositoryHealthChecker {
	return b.healthChecker
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := provisioning.AddKnownTypes(b.gv, scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = provisioning.AddKnownTypes(provisioning.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Register custom field label conversion for Repository to enable field selectors like spec.connection.name
	err = scheme.AddFieldLabelConversionFunc(
		b.gv.WithKind("Repository"),
		func(label, value string) (string, string, error) {
			switch label {
			case "metadata.name", "metadata.namespace", "spec.connection.name":
				return label, value, nil
			default:
				return "", "", fmt.Errorf("field label not supported for Repository: %s", label)
			}
		},
	)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, b.gv)

	if b.isPreferredVersion {
		return scheme.SetVersionPriority(b.gv)
	}
	return nil
}

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	// Create repository storage with custom field selectors (e.g., spec.connection.name)
	repositoryStorage, err := grafanaregistry.NewRegistryStoreWithSelectableFields(
		opts.Scheme,
		provisioning.RepositoryResourceInfo,
		opts.OptsGetter,
		grafanaregistry.SelectableFieldsOptions{
			GetAttrs: RepositoryGetAttrs,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}

	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)
	b.repoLister = repository.NewStorageLister(repositoryStorage)

	// Create admission handler and register mutators/validators
	b.admissionHandler = appadmission.NewHandler()

	// Repository mutator and validator
	b.repoValidator = repository.NewValidator(b.allowImageRendering, b.repoFactory)

	existingReposValidator := repository.NewVerifyAgainstExistingRepositoriesValidator(b.repoLister, b.quotaGetter)
	repoAdmissionValidator := repository.NewAdmissionValidator(b.allowedTargets, b.repoValidator, existingReposValidator)
	b.admissionHandler.RegisterMutator(provisioning.RepositoryResourceInfo.GetName(), repository.NewAdmissionMutator(b.repoFactory, b.minSyncInterval))
	b.admissionHandler.RegisterValidator(provisioning.RepositoryResourceInfo.GetName(), repoAdmissionValidator)
	// Connection mutator and validator
	connAdmissionValidator := connection.NewAdmissionValidator(b.connectionFactory)
	connDeleteValidator := connection.NewReferencedByRepositoriesValidator(b.repoLister)
	connCombinedValidator := appadmission.NewCombinedValidator(connAdmissionValidator, connDeleteValidator)
	b.admissionHandler.RegisterMutator(provisioning.ConnectionResourceInfo.GetName(), connection.NewAdmissionMutator(b.connectionFactory))
	b.admissionHandler.RegisterValidator(provisioning.ConnectionResourceInfo.GetName(), connCombinedValidator)
	// Jobs validator (no mutator needed)
	b.admissionHandler.RegisterValidator(provisioning.JobResourceInfo.GetName(), appjobs.NewAdmissionValidator())
	b.admissionHandler.RegisterValidator(provisioning.HistoricJobResourceInfo.GetName(), appjobs.NewHistoricJobAdmissionValidator())

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

	connectionsStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, provisioning.ConnectionResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create connection storage: %w", err)
	}
	connectionStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, connectionsStore)

	// When serving a non-storage version (e.g. v1beta1), wrap the CRUD stores
	// so that List re-stamps each item's apiVersion to match the served version.
	// See grafanaregistry.VersionedStore for details on why this is necessary.
	if b.gv.Version != provisioning.VERSION {
		storage[provisioning.RepositoryResourceInfo.StoragePath()] = grafanaregistry.NewVersionedStore(repositoryStorage, b.gv)
		storage[provisioning.ConnectionResourceInfo.StoragePath()] = grafanaregistry.NewVersionedStore(connectionsStore, b.gv)
		storage[provisioning.JobResourceInfo.StoragePath()] = grafanaregistry.NewVersionedStore(jobStore, b.gv)
		b.repoStore = grafanaregistry.NewVersionedStore(repositoryStorage, b.gv)
		b.connectionStore = grafanaregistry.NewVersionedStore(connectionsStore, b.gv)
	} else {
		storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
		storage[provisioning.ConnectionResourceInfo.StoragePath()] = connectionsStore
		storage[provisioning.JobResourceInfo.StoragePath()] = jobStore
		b.repoStore = repositoryStorage
		b.connectionStore = connectionsStore
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage

	storage[provisioning.ConnectionResourceInfo.StoragePath("status")] = connectionStatusStorage
	storage[provisioning.ConnectionResourceInfo.StoragePath("repositories")] = NewConnectionRepositoriesConnector(b)

	// TODO: Add some logic so that the connectors can registered themselves and we don't have logic all over the place
	testTester := repository.NewTester(b.repoValidator, existingReposValidator)

	// TODO: Remove this connector when we deprecate the test endpoint
	// We should use fieldErrors from status instead.
	storage[provisioning.RepositoryResourceInfo.StoragePath("test")] = NewTestConnector(b, testTester)
	storage[provisioning.RepositoryResourceInfo.StoragePath("files")] = NewFilesConnector(b, b.parsers, b.clients, b.accessWithAdmin, b.folderMetadataEnabled, b.folderAPIVersion, b.maxFileSize)
	storage[provisioning.RepositoryResourceInfo.StoragePath("refs")] = NewRefsConnector(b)
	storage[provisioning.RepositoryResourceInfo.StoragePath("resources")] = &listConnector{
		getter: b,
		lister: b.resourceLister,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("history")] = &historySubresource{
		repoGetter: b,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("jobs")] = NewJobsConnector(b, b, b, jobHistory, b.access, b.clients, b.folderMetadataEnabled)

	// Add any extra storage
	for _, extra := range b.extras {
		if err := extra.UpdateStorage(storage); err != nil {
			return fmt.Errorf("update storage for extra %T: %w", extra, err)
		}
	}

	apiGroupInfo.VersionedResourcesStorageMap[b.gv.Version] = storage
	return nil
}

// Mutate delegates to the admission handler for resource-specific mutation
func (b *APIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()

	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	return b.admissionHandler.Mutate(ctx, a, o)
}

// Validate delegates to the admission handler for resource-specific validation
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	return b.admissionHandler.Validate(ctx, a, o)
}

func (b *APIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	// Use version-specific hook name to avoid conflicts when multiple versions are registered
	hookName := fmt.Sprintf("grafana-provisioning-%s", b.gv.Version)
	postStartHooks := map[string]genericapiserver.PostStartHookFunc{
		hookName: func(postStartHookCtx genericapiserver.PostStartHookContext) error {
			var config *clientrest.Config
			var err error
			if b.restConfigGetter == nil {
				config = postStartHookCtx.LoopbackClientConfig
			} else {
				config, err = b.restConfigGetter(postStartHookCtx.Context)
				if err != nil {
					return err
				}
			}
			c, err := clientset.NewForConfig(config)
			if err != nil {
				return err
			}

			b.client = c.ProvisioningV0alpha1()

			// Initialize the API client-based job store
			b.jobs, err = jobs.NewJobStore(b.client, 30*time.Second, b.registry)
			if err != nil {
				return fmt.Errorf("create API client job store: %w", err)
			}

			b.statusPatcher = appcontroller.NewRepositoryStatusPatcher(b.GetClient())
			healthMetricsRecorder := controller.NewHealthMetricsRecorder(b.registry)
			// FIXME: Health checker uses basic validation only - no additional validators needed
			// since the repository already passed admission validation when it was created/updated.
			// but that leads to possible race conditions when the repository is created/updated and violating some rules.
			b.healthChecker = controller.NewRepositoryHealthChecker(b.statusPatcher, repository.NewTester(b.repoValidator), healthMetricsRecorder)

			// if running solely CRUD or not the preferred version, skip controllers/workers setup
			if b.onlyApiServer || !b.isPreferredVersion {
				return nil
			}

			// Informer with resync interval used for health check and reconciliation
			informerFactoryResyncInterval := 60 * time.Second
			sharedInformerFactory := informers.NewSharedInformerFactory(c, informerFactoryResyncInterval)
			repoInformer := sharedInformerFactory.Provisioning().V0alpha1().Repositories()
			jobInformer := sharedInformerFactory.Provisioning().V0alpha1().Jobs()
			connInformer := sharedInformerFactory.Provisioning().V0alpha1().Connections()
			go repoInformer.Informer().Run(postStartHookCtx.Done())
			go jobInformer.Informer().Run(postStartHookCtx.Done())
			go connInformer.Informer().Run(postStartHookCtx.Done())

			usageMetricCollector := usage.MetricCollector(b.tracer, b.repoLister.List, b.unified)
			b.usageStats.RegisterMetricsFunc(usageMetricCollector)

			metrics := jobs.RegisterJobMetrics(b.registry)

			stageIfPossible := repository.WrapWithStageAndPushIfPossible

			exportEnabled := b.features.IsEnabled(postStartHookCtx.Context, featuremgmt.FlagProvisioningExport) //nolint:staticcheck

			// Standalone export generates new UIDs so exported files don't
			// reference existing resource identifiers.
			exportWorker := export.NewExportWorker(
				b.clients,
				b.repositoryResources,
				b.resourceLister,
				export.ExportAllWithNewUIDs,
				stageIfPossible,
				metrics,
				exportEnabled,
				b.folderAPIVersion,
			)

			syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, b.tracer, 10, metrics, b.folderMetadataEnabled) //nolint:staticcheck
			syncWorker := sync.NewSyncWorker(
				b.clients,
				b.repositoryResources,
				b.statusPatcher.Patch,
				syncer,
				metrics,
				b.tracer,
				10,
			)

			// Migration export preserves original names so the takeover
			// allowlist can correlate resources during the sync phase.
			migrateExportWorker := export.NewExportWorker(
				b.clients,
				b.repositoryResources,
				b.resourceLister,
				export.ExportAll,
				stageIfPossible,
				metrics,
				exportEnabled,
				b.folderAPIVersion,
			)
			cleaner := migrate.NewNamespaceCleaner(b.clients)
			unifiedStorageMigrator := migrate.NewUnifiedStorageMigrator(
				cleaner,
				migrateExportWorker,
				syncWorker,
			)
			migrationWorker := migrate.NewMigrationWorker(
				unifiedStorageMigrator,
				b.features.IsEnabled(postStartHookCtx.Context, featuremgmt.FlagProvisioningExport), //nolint:staticcheck
			)

			deleteWorker := deletepkg.NewWorker(syncWorker, stageIfPossible, b.repositoryResources, metrics)
			moveWorker := movepkg.NewWorker(syncWorker, stageIfPossible, b.repositoryResources, metrics)
			fixMetadataWorker := fixfoldermetadata.NewWorker(resources.FolderGVKForVersion(b.folderAPIVersion))
			releaseResourcesWorker := releaseresourcespkg.NewWorker(b.resourceLister, b.clients, 10)
			deleteResourcesWorker := deleteresourcespkg.NewWorker(b.resourceLister, b.clients, 10)

			// All workers registered - export/migrate will check feature flag at runtime
			workers := make([]jobs.Worker, 0, 8+len(b.extraWorkers))
			workers = append(workers,
				deleteResourcesWorker,
				deleteWorker,
				exportWorker,
				fixMetadataWorker,
				migrationWorker,
				moveWorker,
				releaseResourcesWorker,
				syncWorker,
			)

			// Create JobController to handle job create notifications
			jobController, err := appcontroller.NewJobController(jobInformer)
			if err != nil {
				return err
			}

			// Add any extra workers
			workers = append(workers, b.extraWorkers...)

			var jobHistoryWriter jobs.HistoryWriter
			if b.jobHistoryLoki != nil {
				jobHistoryWriter = b.jobHistoryLoki
			} else {
				jobHistoryWriter = jobs.NewAPIClientHistoryWriter(b.GetClient())
			}

			repoGetter := resources.NewRepositoryGetter(b.repoFactory, b.client)

			// Create job cleanup controller
			jobExpiry := 30 * time.Second
			jobCleanupController := jobs.NewJobCleanupController(
				b.jobs,
				jobHistoryWriter,
				jobExpiry,
			)

			// This is basically our own JobQueue system
			driver, err := jobs.NewConcurrentJobDriver(
				3,              // 3 drivers for now
				20*time.Minute, // Max time for each job
				30*time.Second, // Periodically look for new jobs
				jobExpiry,      // Lease renewal interval
				b.jobs, repoGetter, jobHistoryWriter,
				jobController.InsertNotifications(),
				b.registry,
				&metrics,
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

			go func() {
				if err := jobCleanupController.Run(postStartHookCtx.Context); err != nil {
					logging.FromContext(postStartHookCtx.Context).Error("job cleanup controller failed", "error", err)
				}
			}()

			webhookSecretRotationInterval := b.webhookSecretRotationInterval
			if webhookSecretRotationInterval <= 0 {
				// If webhookSecretRotationInterval is not set, use the default value
				webhookSecretRotationInterval = 30 * 24 * time.Hour
			}

			repoController, err := controller.NewRepositoryController(
				b.GetClient(),
				repoInformer,
				b.repoFactory,
				b.connectionFactory,
				b.resourceLister,
				b.clients,
				b.jobs,
				b.GetHealthChecker(),
				b.statusPatcher,
				b.registry,
				b.tracer,
				10,
				informerFactoryResyncInterval,
				b.minSyncInterval,
				30*time.Second,
				b.quotaGetter,
				b.folderMetadataEnabled,
				b.folderAPIVersion,
				b.maxIncrementalChanges,
				webhookSecretRotationInterval,
			)
			if err != nil {
				return err
			}

			go repoController.Run(postStartHookCtx.Context, repoControllerWorkers, func() {}, func() {})

			// Create and run connection controller
			connStatusPatcher := appcontroller.NewConnectionStatusPatcher(b.GetClient())
			connTester := connection.NewSimpleConnectionTester(b.connectionFactory)
			connHealthChecker := controller.NewConnectionHealthChecker(connTester, healthMetricsRecorder)
			connController, err := controller.NewConnectionController(
				b.GetClient(),
				connInformer,
				connStatusPatcher,
				connHealthChecker,
				b.connectionFactory,
				informerFactoryResyncInterval,
				30*time.Second,
				b.registry,
			)
			if err != nil {
				return err
			}
			if !cache.WaitForCacheSync(postStartHookCtx.Done(), connInformer.Informer().HasSynced) {
				return fmt.Errorf("connection controller cache sync failed")
			}
			go connController.Run(postStartHookCtx.Context, repoControllerWorkers, func() {}, func() {})

			// If Loki not used, initialize the API client-based history writer and start the controller for history jobs
			if b.jobHistoryLoki == nil {
				// Create HistoryJobController for cleanup of old job history entries
				// Separate informer factory for HistoryJob cleanup with resync interval
				historyJobExpiration := 10 * time.Minute
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
	if b.gv.Version == "v1beta1" {
		return func(rc common.ReferenceCallback) map[string]common.OpenAPIDefinition {
			defs := provisioning.GetOpenAPIDefinitions(rc)
			return ReplaceOpenAPIVersion(defs, "provisioning", "v0alpha1", "v1beta1")
		}
	}
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
	refsBase := provisioning.OpenAPIPrefix
	compBase := refsBase

	// For v1beta1, update the component base to use the correct version
	if b.gv.Version == "v1beta1" {
		compBase = strings.Replace(compBase, ".v0alpha1.", ".v1beta1.", 1)
	}

	// TODO: Remove this endpoint when we deprecate the test endpoint
	// We should use fieldErrors from status instead.
	sub := oas.Paths.Paths[repoprefix+"/test"]
	if sub != nil {
		repoSchema := defs[compBase+"Repository"].Schema
		sub.Post.Description = "Check if the configuration is valid. Deprecated: this will go away in favour of fieldErrors from status"
		sub.Post.Deprecated = true
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
		s := defs[compBase+"RefList"].Schema
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
		s := defs[compBase+"FileList"].Schema
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

	// Document connection repositories endpoint
	connectionprefix := root + "namespaces/{namespace}/connections/{name}"
	sub = oas.Paths.Paths[connectionprefix+"/repositories"]
	if sub != nil {
		sub.Get.Description = "List repositories available from the external git provider through this connection"
		sub.Get.Summary = "List external repositories"
		sub.Get.Parameters = []*spec3.Parameter{}
		sub.Post = nil
		sub.Put = nil
		sub.Delete = nil

		// Replace the content type for this response
		mt := sub.Get.Responses.StatusCodeResponses[200].Content
		s := defs[compBase+"ExternalRepositoryList"].Schema
		mt["*/*"].Schema = &s
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
		if oas.Components.Schemas[k] == nil {
			oas.Components.Schemas[k] = &v.Schema
		}
	}
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

	// Fix up the RepositoryView.commit ref. Schemas added via the defs loop above
	// use an empty ReferenceCallback, so non-primitive fields like commit lose
	// their $ref and have to be re-attached here (same pattern as RepositoryViewList.items).
	commitSchema := oas.Components.Schemas[compBase+"RepositoryView"].Properties["commit"]
	commitSchema.AllOf = []spec.Schema{
		{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/" + compBase + "CommitOptions"),
			},
		},
	}
	oas.Components.Schemas[compBase+"RepositoryView"].Properties["commit"] = commitSchema

	countSpec := &spec.SchemaOrArray{
		Schema: &spec.Schema{
			SchemaProps: spec.SchemaProps{
				AllOf: []spec.Schema{
					{
						SchemaProps: spec.SchemaProps{
							Ref: spec.MustCreateRef("#/components/schemas/" + refsBase + "ResourceCount"),
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

	// Clean up version-specific schemas and metadata
	switch b.gv.Version {
	case "v1beta1":
		// For v1beta1, replace all v0alpha1 references with v1beta1 and remove old schemas
		ReplaceOpenAPISpecVersion(oas, "provisioning", "v0alpha1", "v1beta1")
		// Ensure GVK extensions are present for top-level resources
		ensureGVKForVersion(oas, "provisioning.grafana.app", "v1beta1")
	case "v0alpha1":
		// For v0alpha1, remove any v1beta1 schemas and filter GVK metadata
		ReplaceOpenAPISpecVersion(oas, "provisioning", "v1beta1", "v0alpha1")
	}

	return oas, nil
}

// Helpers for fetching valid Repository objects
// TODO: where should the helpers live?

func (b *APIBuilder) GetRepository(ctx context.Context, name string) (repository.Repository, error) {
	obj, err := b.repoStore.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asRepository(ctx, obj, nil)
}

func (b *APIBuilder) GetConnection(ctx context.Context, name string) (connection.Connection, error) {
	obj, err := b.connectionStore.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return b.asConnection(ctx, obj, nil)
}

func (b *APIBuilder) GetRepoFactory() repository.Factory {
	return b.repoFactory
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

// GetPolicyRuleEvaluator defines the rules for logging auditing events from the API server.
func (b *APIBuilder) GetPolicyRuleEvaluator() auditing.PolicyRuleEvaluator {
	return auditing.NewDefaultGrafanaPolicyRuleEvaluator()
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
		if oldRepo, ok := old.(*provisioning.Repository); ok {
			repository.CopySecureValues(r, oldRepo)
		}
	}

	return b.repoFactory.Build(ctx, r)
}

func (b *APIBuilder) asConnection(ctx context.Context, obj runtime.Object, old runtime.Object) (connection.Connection, error) {
	if obj == nil {
		return nil, fmt.Errorf("missing connection object")
	}

	c, ok := obj.(*provisioning.Connection)
	if !ok {
		return nil, fmt.Errorf("expected connection object")
	}

	// Copy previous values if they exist
	if old != nil {
		if oldConn, ok := old.(*provisioning.Connection); ok {
			connection.CopySecureValues(c, oldConn)
		}
	}

	return b.connectionFactory.Build(ctx, c)
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
