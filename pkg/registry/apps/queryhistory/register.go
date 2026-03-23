package queryhistory

import (
	"context"
	"fmt"

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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider    = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	legacyService queryhistorysvc.Service
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
	// Per-user isolation is enforced at the storage layer via the "created-by" label,
	// not at the authorizer level. This differs from AuthorizeFromName (used by preferences/stars)
	// because query history items have auto-generated names, not owner-encoded names.
	return &queryHistoryAuthorizer{}
}

// queryHistoryAuthorizer allows all authenticated users full CRUD access to query history.
type queryHistoryAuthorizer struct{}

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

	// Any authenticated user can perform any operation on query history.
	switch attr.GetVerb() {
	case "get", "list", "watch", "create", "update", "patch", "delete", "deletecollection":
		return authorizer.DecisionAllow, "", nil
	default:
		return authorizer.DecisionDeny, fmt.Sprintf("verb %q not supported", attr.GetVerb()), nil
	}
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
