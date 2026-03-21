package queryhistory

import (
	"log/slog"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	queryhistorysvc "github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ builder.APIGroupBuilder               = (*QueryHistoryAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider       = (*QueryHistoryAPIBuilder)(nil)
	_ builder.APIGroupAuthorizer            = (*QueryHistoryAPIBuilder)(nil)
	_ builder.APIGroupPostStartHookProvider = (*QueryHistoryAPIBuilder)(nil)
)

type QueryHistoryAPIBuilder struct {
	service  queryhistorysvc.Service
	features featuremgmt.FeatureToggles
	searcher resource.ResourceClient
	dual     dualwrite.Service
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	qhService *queryhistorysvc.QueryHistoryService,
	unified resource.ResourceClient,
	dual dualwrite.Service,
) *QueryHistoryAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesQueryHistory) {
		return &QueryHistoryAPIBuilder{}
	}

	b := &QueryHistoryAPIBuilder{
		service:  qhService,
		features: features,
		searcher: unified,
		dual:     dual,
	}

	apiregistration.RegisterAPI(b)
	return b
}

func (b *QueryHistoryAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return qhv0alpha1.GroupVersion
}

func (b *QueryHistoryAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := qhv0alpha1.GroupVersion
	err := qhv0alpha1.AddToScheme(scheme)
	if err != nil {
		return err
	}
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *QueryHistoryAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return qhv0alpha1.GetOpenAPIDefinitions
}

func (b *QueryHistoryAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *QueryHistoryAPIBuilder) UpdateAPIGroupInfo(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
) error {
	resourceInfo := qhv0alpha1.QueryHistoryResourceInfo
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service:        b.service,
		tableConverter: resourceInfo.TableConverter(),
	}

	unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()], err = opts.DualWriteBuilder(resourceInfo.GroupResource(), legacyStore, unified)
	if err != nil {
		return err
	}

	// Register search sub-resource using the unified ResourceClient as the index client.
	// NewSearchClient routes between legacy and unified based on dual-write mode.
	// Query history has no legacy search backend, so we pass the unified client for both.
	searchClient := resource.NewSearchClient(
		dualwrite.NewSearchAdapter(b.dual),
		resourceInfo.GroupResource(),
		b.searcher,
		b.searcher, // no legacy searcher — use unified for both
		b.features,
	)
	storage[resourceInfo.StoragePath("search")] = &searchREST{searcher: searchClient}

	apiGroupInfo.VersionedResourcesStorageMap[qhv0alpha1.APIVersion] = storage
	return nil
}

func (b *QueryHistoryAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return &utils.AuthorizeFromName{
		Resource: map[string][]utils.ResourceOwner{
			"queryhistories": {utils.UserResourceOwner},
		},
	}
}

func (b *QueryHistoryAPIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	hooks := map[string]genericapiserver.PostStartHookFunc{
		"grafana-queryhistory-ttl-cleanup": func(ctx genericapiserver.PostStartHookContext) error {
			cleanup := &CleanupJob{
				logger: slog.Default().With("component", "queryhistory-cleanup"),
			}
			go cleanup.Run(ctx.Context)
			return nil
		},
		"grafana-queryhistory-stars-reconciler": func(ctx genericapiserver.PostStartHookContext) error {
			reconciler := &StarsTTLReconciler{
				logger: slog.Default().With("component", "queryhistory-stars-reconciler"),
			}
			go func() { _ = reconciler.Start(ctx.Context) }()
			return nil
		},
	}
	return hooks, nil
}
