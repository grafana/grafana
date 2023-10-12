package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	grafanarest "github.com/grafana/grafana/pkg/services/grafana-apiserver/rest"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

var _ grafanaapiserver.APIGroupBuilder = (*PlaylistAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PlaylistAPIBuilder struct {
	service    playlist.Service
	namespacer namespaceMapper
}

func RegisterAPIService(p playlist.Service,
	apiregistration grafanaapiserver.APIRegistrar,
	cfg *setting.Cfg,
) *PlaylistAPIBuilder {
	builder := &PlaylistAPIBuilder{
		service:    p,
		namespacer: getNamespaceMapper(cfg),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *PlaylistAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return SchemeGroupVersion
}

func (b *PlaylistAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := AddToScheme(scheme)
	if err != nil {
		return err
	}
	return scheme.SetVersionPriority(SchemeGroupVersion)
}

func (b *PlaylistAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service:    b.service,
		namespacer: b.namespacer,
	}
	storage["playlists"] = legacyStore

	// enable dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil {
		store, err := newStorage(scheme, optsGetter)
		if err != nil {
			return nil, err
		}
		storage["playlists"] = grafanarest.NewDualWriter(legacyStore, store)
	}

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *PlaylistAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return getOpenAPIDefinitions
}

func (b *PlaylistAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}

// SchemeGroupVersion is group version used to register these objects
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: VersionID}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

var (
	// SchemeBuilder points to a list of functions added to Scheme.
	SchemeBuilder      = runtime.NewSchemeBuilder(addKnownTypes)
	localSchemeBuilder = &SchemeBuilder
	// AddToScheme is a common registration function for mapping packaged scoped group & version keys to a scheme.
	AddToScheme = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&Playlist{},
		&PlaylistList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}
