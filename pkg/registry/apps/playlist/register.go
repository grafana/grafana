package playlist

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*PlaylistAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*PlaylistAppInstaller)(nil)
	_ appinstaller.APIEnablementProvider = (*PlaylistAppInstaller)(nil)
)

type PlaylistAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg     *setting.Cfg
	service playlistsvc.Service
}

func RegisterAppInstaller(
	p playlistsvc.Service,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) (*PlaylistAppInstaller, error) {
	installer := &PlaylistAppInstaller{
		cfg:     cfg,
		service: p,
	}
	specificConfig := any(&playlistapp.PlaylistConfig{
		EnableReconcilers: features.IsEnabledGlobally(featuremgmt.FlagPlaylistsReconciler),
	})
	provider := simple.NewAppProvider(apis.LocalManifest(), specificConfig, playlistapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.ManifestGoTypeAssociator, apis.ManifestCustomRouteResponsesAssociator)
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

// GetLegacyStorage returns the legacy storage for the playlist app.
func (p *PlaylistAppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) grafanarest.Storage {
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

// GetAllowedV0Alpha1Resources returns the list of resources that are allowed to be accessed in v0alpha1.
func (p *PlaylistAppInstaller) GetAllowedV0Alpha1Resources() []string {
	return []string{
		playlistv0alpha1.PlaylistKind().Plural(),
	}
}
