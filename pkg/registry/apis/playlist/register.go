package playlist

import (
	"context"
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
	common "k8s.io/kube-openapi/pkg/common"

	playlist "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*PlaylistAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PlaylistAPIBuilder struct {
	service    playlistsvc.Service
	namespacer request.NamespaceMapper
	gv         schema.GroupVersion
	features   featuremgmt.FeatureToggles
	kvStore    kvstore.KVStore
}

func RegisterAPIService(p playlistsvc.Service,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	kvStore kvstore.KVStore,
) *PlaylistAPIBuilder {
	builder := &PlaylistAPIBuilder{
		service:    p,
		namespacer: request.GetNamespaceMapper(cfg),
		gv:         playlist.PlaylistResourceInfo.GroupVersion(),
		features:   features,
		kvStore:    kvStore,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *PlaylistAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&playlist.Playlist{},
		&playlist.PlaylistList{},
	)
}

func (b *PlaylistAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, b.gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *PlaylistAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWrite bool,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(playlist.GROUP, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	resource := playlist.PlaylistResourceInfo
	legacyStore := &legacyStorage{
		service:    b.service,
		namespacer: b.namespacer,
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		resource.GroupResource(),
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The playlist name"},
			{Name: "Interval", Type: "string", Format: "string", Description: "How often the playlist will update"},
			{Name: "Created At", Type: "date"},
		},
		func(obj any) ([]interface{}, error) {
			m, ok := obj.(*playlist.Playlist)
			if !ok {
				return nil, fmt.Errorf("expected playlist")
			}
			return []interface{}{
				m.Name,
				m.Spec.Title,
				m.Spec.Interval,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	)
	storage[resource.StoragePath()] = legacyStore

	// enable dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil && dualWrite {
		store, err := newStorage(scheme, optsGetter, legacyStore)
		if err != nil {
			return nil, err
		}

		storage[resource.StoragePath()] = setDualWritingMode(b.kvStore, b.features, legacyStore, store)
	}

	apiGroupInfo.VersionedResourcesStorageMap[playlist.VERSION] = storage
	return &apiGroupInfo, nil
}

/*
TODOS
- pass cfg.StackID into GetAPIGRoupInfo so that we can include it in the key for the kvstore entry
- fix kvstore get request to include orgID and namespace. potentially switch to namespacedkvstore instead.
- review how to define modes in code. kvstore returns string mode but currently modes are defined as iota.
- figure out where setDualWritingMode should live
- what should the key name for the kvstore entry? what about value? decide between iota versus integer
- Figure out if we want pods to acquire a lock to go from mode 1 to mode 2
- Add error handling
- context.Background() --> use something else?
*/

func setDualWritingMode(kv kvstore.KVStore, features featuremgmt.FeatureToggles, legacy grafanarest.LegacyStorage, storage grafanarest.Storage) grafanarest.DualWriter {
	toMode := map[string]grafanarest.DualWriterMode{
		"1": grafanarest.Mode1,
		"2": grafanarest.Mode2,
		"3": grafanarest.Mode3,
		"4": grafanarest.Mode4,
	}

	key := "playlist-" // + stackID
	m, ok, err := kv.Get(context.Background(), 0, "", key)
	if err != nil {
		fmt.Println(err)
	}
	if !ok {
		// default to mode 1
		m = "1"
		err := kv.Set(context.Background(), 0, "", key, m)
		if err != nil {
			fmt.Println(err)
		}
	}

	mode := toMode[m]

	if features.IsEnabledGlobally(featuremgmt.FlagDualWritePlaylistsMode2) {
		// This is where we go through the different gates to allow the instance to migrate from mode 1 to mode 2.
		// There are none between mode 1 and mode 2
		mode = grafanarest.Mode2
	}

	return grafanarest.NewDualWriter(mode, legacy, storage)
}

func (b *PlaylistAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return playlist.GetOpenAPIDefinitions
}

func (b *PlaylistAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

func (b *PlaylistAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}
