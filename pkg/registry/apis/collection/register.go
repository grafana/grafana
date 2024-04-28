package collection

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*CollectionAPIBuilder)(nil)

// This is used just so wire has something unique to return
type CollectionAPIBuilder struct {
	sql        db.DB
	namespacer request.NamespaceMapper
}

func RegisterAPIService(features featuremgmt.FeatureToggles,
	cfg *setting.Cfg, sql db.DB,
	apiregistration builder.APIRegistrar) *CollectionAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := &CollectionAPIBuilder{
		sql:        sql,
		namespacer: request.GetNamespaceMapper(cfg),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *CollectionAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *CollectionAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return collection.SchemeGroupVersion
}

func (b *CollectionAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := collection.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = collection.AddKnownTypes(collection.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only one version right now
	return scheme.SetVersionPriority(collection.SchemeGroupVersion)
}

func (b *CollectionAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ bool, // dual write (not relevant)
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(collection.GROUP,
		scheme, metav1.ParameterCodec, codecs)

	storage := map[string]rest.Storage{}

	// Stars (from SQL)
	starInfo := collection.StarsResourceInfo
	starStorage := &legacyStorage{
		reg: b,
		tableConverter: utils.NewTableConverter(
			resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*collection.Stars)
				if !ok {
					return nil, fmt.Errorf("expected scope")
				}
				return []interface{}{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
	}
	storage[starInfo.StoragePath()] = starStorage

	// Now generic collections
	collectionStorage, err := newCollectionStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[collection.CollectionResourceInfo.StoragePath()] = collectionStorage

	apiGroupInfo.VersionedResourcesStorageMap[collection.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *CollectionAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return collection.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *CollectionAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}
