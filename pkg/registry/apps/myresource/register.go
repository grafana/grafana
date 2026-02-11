package myresource

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/myresource/pkg/apis"
	myresource "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
	myresourceapp "github.com/grafana/grafana/apps/myresource/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*MyResourceAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*MyResourceAppInstaller)(nil)
)

type MyResourceAppInstaller struct {
	appsdkapiserver.AppInstaller
	namespacer request.NamespaceMapper
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
) (*MyResourceAppInstaller, error) {
	installer := &MyResourceAppInstaller{
		namespacer: request.GetNamespaceMapper(cfg),
	}
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, myresourceapp.New)

	appCfg := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *apis.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (a *MyResourceAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return myresourceapp.GetAuthorizer()
}

func (s *MyResourceAppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := myresource.MyResourceKind().GroupVersionResource()
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		namespacer: s.namespacer,
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The title of the resource"},
				{Name: "Ready", Type: "boolean"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*myresource.MyResource)
				if !ok {
					return nil, fmt.Errorf("expected myresource")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.Status.Ready,
				}, nil
			},
		},
	)
	return legacyStore
}
