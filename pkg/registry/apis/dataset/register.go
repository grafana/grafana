package dataset

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	dataset "github.com/grafana/grafana/pkg/apis/dataset/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ builder.APIGroupBuilder = (*DatasetAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DatasetAPIBuilder struct {
	blobStore resource.BlobStoreClient
}

func NewDatasetAPIBuilder(blobStore resource.BlobStoreClient) *DatasetAPIBuilder {
	return &DatasetAPIBuilder{blobStore}
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	unified resource.ResourceClient,
) (*DatasetAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless explicitly added (or all experimental are added)
	}

	if !features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		unified = nil
	}

	builder := NewDatasetAPIBuilder(unified)
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

func (b *DatasetAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *DatasetAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dataset.SchemeGroupVersion
}

func (b *DatasetAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := dataset.SchemeGroupVersion
	err := dataset.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   dataset.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *DatasetAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := dataset.DatasetResourceInfo
	storage := map[string]rest.Storage{}

	var largeObjects apistore.LargeObjectSupport
	if b.blobStore != nil {
		largeObjects = NewDatasetLargeObjectSupport(opts.Scheme)
		opts.StorageOptions(resourceInfo.GroupResource(), apistore.StorageOptions{
			LargeObjectSupport: largeObjects,
		})
	}

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()] = store
	storage[resourceInfo.StoragePath("frames")] = &framesConnector{
		getter:       store,
		blobStore:    b.blobStore,
		largeObjects: largeObjects,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dataset.VERSION] = storage
	return nil
}

func (b *DatasetAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dataset.GetOpenAPIDefinitions
}

func (b *DatasetAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}
