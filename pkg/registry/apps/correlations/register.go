package correlations

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/correlations/pkg/apis"
	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	correlationsapp "github.com/grafana/grafana/apps/correlations/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller

	legacy *legacyStorage
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	service correlations.Service,
) (*AppInstaller, error) {
	installer := &AppInstaller{}
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, correlationsapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData: *apis.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	if service != nil {
		installer.legacy = &legacyStorage{
			service:    service,
			namespacer: request.GetNamespaceMapper(cfg),
		}
	}
	return installer, nil
}

func (a *AppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) rest.Storage {
	kind := correlationsV0.CorrelationKind()
	gvr := schema.GroupVersionResource{
		Group:    kind.Group(),
		Version:  kind.Version(),
		Resource: kind.Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	a.legacy.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Source", Type: "string", Format: "string"},
				{Name: "Target", Type: "string", Format: "string"},
				{Name: "Description", Type: "string", Format: "string"},
			},
			Reader: func(obj any) ([]any, error) {
				m, ok := obj.(*correlationsV0.Correlation)
				if !ok {
					return nil, fmt.Errorf("expected Correlation")
				}
				return []any{
					m.Name,
					m.Spec.Source.Name,
					m.Spec.Target.Name,
					m.Spec.Description,
				}, nil
			},
		},
	)

	return a.legacy
}
