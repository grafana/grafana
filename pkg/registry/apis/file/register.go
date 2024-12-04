package file

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	file "github.com/grafana/grafana/pkg/apis/file/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ builder.APIGroupBuilder = (*FileAPIBuilder)(nil)

// This is used just so wire has something unique to return
type FileAPIBuilder struct {
	blobStore resource.BlobStoreClient
}

func NewFileAPIBuilder(blobStore resource.BlobStoreClient) *FileAPIBuilder {
	return &FileAPIBuilder{blobStore}
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	unified resource.ResourceClient,
) (*FileAPIBuilder, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless explicitly added (or all experimental are added)
	}

	if !features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBigObjectsSupport) {
		unified = nil
	}

	builder := NewFileAPIBuilder(unified)
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

func (b *FileAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *FileAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return file.SchemeGroupVersion
}

func (b *FileAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := file.SchemeGroupVersion
	err := file.AddToScheme(scheme)
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

func (b *FileAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := file.FileResourceInfo
	storage := map[string]rest.Storage{}

	var largeObjects apistore.LargeObjectSupport
	if b.blobStore != nil {
		largeObjects = NewFileLargeObjectSupport(opts.Scheme)
		opts.StorageOptions(resourceInfo.GroupResource(), apistore.StorageOptions{
			LargeObjectSupport: largeObjects,
		})
	}

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()] = store
	storage[resourceInfo.StoragePath("data")] = &framesConnector{
		getter:       store,
		blobStore:    b.blobStore,
		largeObjects: largeObjects,
	}

	apiGroupInfo.VersionedResourcesStorageMap[file.VERSION] = storage
	return nil
}

func (b *FileAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()

	if obj == nil || a.GetOperation() == admission.Connect {
		return nil // This is normal for sub-resource
	}

	ds, ok := obj.(*file.File)
	if !ok {
		return fmt.Errorf("expected dataset")
	}

	if len(ds.Spec.Data) < 1 {
		return fmt.Errorf("empty dataset")
	}

	// Info set from mutation webhook
	ds.Spec.Info = make([]file.FileInfo, len(ds.Spec.Data))
	for i, d := range ds.Spec.Data {
		if d.Contents == nil {
			return fmt.Errorf("file data can not be nil")
		}

		ds.Spec.Info[i] = file.FileInfo{
			Name: d.Contents.Name,
			Type: d.Contents.Type,
		}
	}

	return nil
}

func (b *FileAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return file.GetOpenAPIDefinitions
}

func (b *FileAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}
