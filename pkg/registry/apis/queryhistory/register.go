package queryhistory

import (
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
)

var (
	_ builder.APIGroupBuilder         = (*QueryHistoryAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*QueryHistoryAPIBuilder)(nil)
	_ builder.APIGroupAuthorizer      = (*QueryHistoryAPIBuilder)(nil)
)

type QueryHistoryAPIBuilder struct {
	service  queryhistorysvc.Service
	features featuremgmt.FeatureToggles
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	qhService *queryhistorysvc.QueryHistoryService,
) *QueryHistoryAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagKubernetesQueryHistory) {
		return &QueryHistoryAPIBuilder{}
	}

	b := &QueryHistoryAPIBuilder{
		service:  qhService,
		features: features,
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

	// TODO: Register search sub-resource once ResourceIndexClient is wired in
	// storage[resourceInfo.StoragePath("search")] = &searchREST{searcher: ...}

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
