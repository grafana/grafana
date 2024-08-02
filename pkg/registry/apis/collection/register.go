package collection

import (
	"fmt"
	"time"

	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var _ builder.APIGroupBuilder = (*CollectionsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type CollectionsAPIBuilder struct{}

func NewCollectionsAPIBuilder() *CollectionsAPIBuilder {
	return &CollectionsAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar) *CollectionsAPIBuilder {
	if !(features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs)) {
		return nil // skip registration unless explicitly added (or all experimental are added)
	}
	builder := NewCollectionsAPIBuilder()
	apiregistration.RegisterAPI(NewCollectionsAPIBuilder())
	return builder
}

func (b *CollectionsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *CollectionsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return collection.SchemeGroupVersion
}

func (b *CollectionsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := collection.AddKnownTypes(scheme, collection.VERSION); err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	if err := collection.AddKnownTypes(scheme, runtime.APIVersionInternal); err != nil {
		return err
	}

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, collection.SchemeGroupVersion)
	return scheme.SetVersionPriority(collection.SchemeGroupVersion)
}

func (b *CollectionsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(collection.GROUP, scheme, metav1.ParameterCodec, codecs)

	var err error
	storage := map[string]rest.Storage{}

	info := collection.UserStarsResourceInfo
	storage[info.StoragePath()] = &legacyStarsStorage{
		tableConverter: gapiutil.NewTableConverter(
			info.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*collection.UserStars)
				if !ok {
					return nil, fmt.Errorf("expected query template")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		)}

	if true {
		info = collection.CollectionResourceInfo
		storage[info.StoragePath()], err = newStorage(scheme, &info, gapiutil.NewTableConverter(
			info.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*collection.Collection)
				if !ok {
					return nil, fmt.Errorf("expected query template")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		), optsGetter)
		if err != nil {
			return nil, err
		}
	}

	apiGroupInfo.VersionedResourcesStorageMap[collection.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *CollectionsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (b *CollectionsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return collection.GetOpenAPIDefinitions
}

func (b *CollectionsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Collections"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}
