package queryhistory

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/queryhistory/pkg/apis/manifestdata"
	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	queryhistoryapp "github.com/grafana/grafana/apps/queryhistory/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	qhregistry "github.com/grafana/grafana/pkg/registry/apis/queryhistory"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ appsdkapiserver.AppInstaller                          = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider                    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider                       = (*AppInstaller)(nil)
	_ appinstaller.NamespaceScopedStorageAuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	legacyService queryhistorysvc.Service
	storageClient resourcepb.ResourceStoreClient
	runnables     []app.Runnable
}

func RegisterAppInstaller(
	features featuremgmt.FeatureToggles,
	qhService *queryhistorysvc.QueryHistoryService,
	unified resource.ResourceClient,
	dual dualwrite.Service,
	store db.DB,
	userService user.Service,
	orgService org.Service,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		legacyService: qhService,
		storageClient: unified,
	}

	resourceInfo := qhv0alpha1.QueryHistoryResourceInfo
	searchClient := resource.NewSearchClient(
		dualwrite.NewSearchAdapter(dual),
		resourceInfo.GroupResource(),
		unified,
		unified, // no legacy searcher — use unified for both
		features,
	)
	searchHandler := qhregistry.NewSearchHandler(searchClient)

	cleanupJob := qhregistry.NewCleanupJob()
	starsReconciler := qhregistry.NewStarsTTLReconciler()
	backfillJob := qhregistry.NewBackfillJob(store, userService, orgService)

	runnables := []app.Runnable{cleanupJob, starsReconciler, backfillJob}

	specificConfig := any(&queryhistoryapp.QueryHistoryConfig{
		SearchHandler: searchHandler,
		Runnables:     runnables,
	})

	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, queryhistoryapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	installer.runnables = runnables

	return installer, nil
}

func (a *AppInstaller) InitializeApp(cfg restclient.Config) error {
	for _, r := range a.runnables {
		if setter, ok := r.(interface{ SetRestConfig(restclient.Config) }); ok {
			setter.SetRestConfig(cfg)
		}
	}
	return a.AppInstaller.InitializeApp(cfg)
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	// Query history is personal user data: any authenticated user can CRUD their own items.
	// Per-user isolation is enforced via ownership checks on the "created-by" label.
	// For operations on specific resources (get, update, delete), we read the resource
	// from unified storage and verify the requesting user matches the creator.
	return &queryHistoryAuthorizer{storageClient: a.storageClient}
}

// queryHistoryAuthorizer allows authenticated users CRUD access to their own query history.
type queryHistoryAuthorizer struct {
	storageClient resourcepb.ResourceStoreClient
}

func (a *queryHistoryAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil || user == nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	// Verify service-level permissions (same check as AuthorizeFromName)
	res := authzlib.CheckServicePermissions(user, attr.GetAPIGroup(), attr.GetResource(), attr.GetVerb())
	if !res.Allowed {
		return authorizer.DecisionDeny, "calling service lacks required permissions", nil
	}

	switch attr.GetVerb() {
	case "list", "watch", "create", "deletecollection":
		return authorizer.DecisionAllow, "", nil
	case "get", "update", "patch", "delete":
		// For operations on a specific resource, verify ownership
		if name := attr.GetName(); name != "" {
			return a.checkOwnership(ctx, attr, user)
		}
		return authorizer.DecisionAllow, "", nil
	default:
		return authorizer.DecisionDeny, fmt.Sprintf("verb %q not supported", attr.GetVerb()), nil
	}
}

// checkOwnership reads the resource from unified storage and verifies the requesting user
// is the creator. This uses the direct storage client (not the k8s API) to avoid auth recursion.
func (a *queryHistoryAuthorizer) checkOwnership(ctx context.Context, attr authorizer.Attributes, user identity.Requester) (authorizer.Decision, string, error) {
	if a.storageClient == nil {
		// Storage client not available (e.g., Mode0 with legacy-only storage).
		// The legacy storage layer enforces ownership via SQL WHERE clauses.
		return authorizer.DecisionAllow, "", nil
	}

	resp, err := a.storageClient.Read(ctx, &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: attr.GetNamespace(),
			Group:     attr.GetAPIGroup(),
			Resource:  attr.GetResource(),
			Name:      attr.GetName(),
		},
	})
	if err != nil {
		// Transient storage error — deny to avoid silently bypassing ownership checks.
		return authorizer.DecisionDeny, "unable to verify resource ownership", err
	}
	if resp.Error != nil {
		// Resource not found or similar — allow through so the handler returns the proper 404.
		return authorizer.DecisionAllow, "", nil
	}

	// Extract labels from the stored object to check ownership
	createdBy, err := extractCreatedByLabel(resp.Value)
	if err != nil || createdBy == "" {
		// Can't determine ownership — allow through for backwards compatibility
		return authorizer.DecisionAllow, "", nil
	}

	if createdBy != user.GetIdentifier() {
		return authorizer.DecisionDeny, "access denied: resource belongs to another user", nil
	}

	return authorizer.DecisionAllow, "", nil
}

// extractCreatedByLabel extracts the created-by label from raw resource JSON.
func extractCreatedByLabel(value []byte) (string, error) {
	var partial struct {
		Metadata metav1.ObjectMeta `json:"metadata"`
	}
	if err := json.Unmarshal(value, &partial); err != nil {
		return "", err
	}
	return partial.Metadata.Labels[queryhistoryapp.LabelCreatedBy], nil
}

func (a *AppInstaller) GetNamespaceScopedStorageAuthorizer(gr schema.GroupResource) storewrapper.ResourceStorageAuthorizer {
	kind := qhv0alpha1.QueryHistoryKind()
	if gr.Group != kind.Group() || gr.Resource != kind.Plural() {
		return nil
	}
	return &queryHistoryStorageAuthorizer{}
}

// queryHistoryStorageAuthorizer filters storage-level operations by ownership.
// This ensures list/get in Mode5 (unified storage) only returns the requesting user's items.
type queryHistoryStorageAuthorizer struct{}

func (s *queryHistoryStorageAuthorizer) BeforeCreate(_ context.Context, _ runtime.Object) error {
	return nil // Ownership set by mutator
}

func (s *queryHistoryStorageAuthorizer) BeforeUpdate(_ context.Context, _, _ runtime.Object) error {
	return nil // Ownership checked by API-level authorizer
}

func (s *queryHistoryStorageAuthorizer) BeforeDelete(_ context.Context, _ runtime.Object) error {
	return nil // Ownership checked by API-level authorizer
}

func (s *queryHistoryStorageAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("access denied: unable to identify user")
	}

	accessor, ok := obj.(metav1.ObjectMetaAccessor)
	if !ok {
		return nil
	}
	createdBy := accessor.GetObjectMeta().GetLabels()[queryhistoryapp.LabelCreatedBy]
	if createdBy != "" && createdBy != user.GetIdentifier() {
		return fmt.Errorf("access denied: resource belongs to another user")
	}
	return nil
}

func (s *queryHistoryStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("access denied: unable to identify user")
	}

	qhList, ok := list.(*qhv0alpha1.QueryHistoryList)
	if !ok {
		return list, nil
	}

	userID := user.GetIdentifier()
	filtered := make([]qhv0alpha1.QueryHistory, 0, len(qhList.Items))
	for _, item := range qhList.Items {
		if createdBy := item.GetLabels()[queryhistoryapp.LabelCreatedBy]; createdBy == "" || createdBy == userID {
			filtered = append(filtered, item)
		}
	}
	qhList.Items = filtered
	return qhList, nil
}

func (a *AppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) grafanarest.Storage {
	kind := qhv0alpha1.QueryHistoryKind()
	gvr := schema.GroupVersionResource{
		Group:    kind.Group(),
		Version:  kind.Version(),
		Resource: kind.Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	return qhregistry.NewLegacyStorage(a.legacyService)
}
