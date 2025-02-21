package playlist

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

type PlaylistAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
	service playlistsvc.Service
}

func RegisterApp(
	p playlistsvc.Service,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) *PlaylistAppProvider {
	provider := &PlaylistAppProvider{
		cfg:     cfg,
		service: p,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:    playlistv0alpha1.GetOpenAPIDefinitions,
		LegacyStorageGetter: provider.legacyStorageGetter,
		ManagedKinds:        playlistapp.GetKinds(),
		CustomConfig: any(&playlistapp.PlaylistConfig{
			EnableReconcilers: features.IsEnabledGlobally(featuremgmt.FlagPlaylistsReconciler),
		}),
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, playlistapp.New)
	return provider
}

func (p *PlaylistAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.LegacyStorage {
	gvr := schema.GroupVersionResource{
		Group:    playlistv0alpha1.PlaylistKind().Group(),
		Version:  playlistv0alpha1.PlaylistKind().Version(),
		Resource: playlistv0alpha1.PlaylistKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		service:    p.service,
		namespacer: request.GetNamespaceMapper(p.cfg),
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
				m, ok := obj.(*playlistv0alpha1.Playlist)
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
	return legacyStore
}
