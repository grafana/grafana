package playlist

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	playlist "github.com/grafana/grafana/apps/playlist/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

var _ builder.APIGroupBuilder = (*PlaylistAPIBuilder)(nil)

// This is used just so wire has something unique to return
type PlaylistAPIBuilder struct {
	service    playlistsvc.Service
	namespacer request.NamespaceMapper
	gv         schema.GroupVersion
}

func RegisterAPIService(p playlistsvc.Service,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	kvStore kvstore.KVStore,
	registerer prometheus.Registerer,
) *PlaylistAPIBuilder {
	builder := &PlaylistAPIBuilder{
		service:    p,
		namespacer: request.GetNamespaceMapper(cfg),
		gv:         schema.GroupVersion{Group: playlist.PlaylistKind().Group(), Version: playlist.PlaylistKind().Version()},
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

func (b *PlaylistAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, dualWriteBuilder grafanarest.DualWriteBuilder) error {
	storage := map[string]rest.Storage{}

	gvr := schema.GroupVersionResource{
		Group:    playlist.PlaylistKind().Group(),
		Version:  playlist.PlaylistKind().Version(),
		Resource: playlist.PlaylistKind().Plural(),
	}

	legacyStore := &legacyStorage{
		service:    b.service,
		namespacer: b.namespacer,
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The playlist name"},
				{Name: "Interval", Type: "string", Format: "string", Description: "How often the playlist will update"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
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
		},
	)
	storage[gvr.Resource] = legacyStore

	// enable dual writes if a RESTOptionsGetter is provided
	if optsGetter != nil && dualWriteBuilder != nil {
		store, err := newStorage(scheme, optsGetter, legacyStore)
		if err != nil {
			return err
		}

		dualWriter, err := dualWriteBuilder(gvr.GroupResource(), legacyStore, store)
		if err != nil {
			return err
		}
		storage[gvr.Resource] = dualWriter
	}

	apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = storage
	return nil
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
