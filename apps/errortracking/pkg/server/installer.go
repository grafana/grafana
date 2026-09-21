package server

import (
	"fmt"
	"net/http"

	"github.com/emicklei/go-restful/v3"
	authlib "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/server/healthz"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/errortracking/pkg/apis/manifestdata"
	errortrackingapp "github.com/grafana/grafana/apps/errortracking/pkg/app"
	"github.com/grafana/grafana/apps/errortracking/pkg/storage"
)

var _ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	accessClient authlib.AccessClient
	store        *storage.Store
}

func (a AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return errortrackingapp.GetAuthorizer(a.accessClient)
}

// InstallAPIs adds storage readiness and discovery for this route-only API.
func (a AppInstaller) InstallAPIs(apiServer appsdkapiserver.GenericAPIServer, optsGetter generic.RESTOptionsGetter) error {
	if err := a.AppInstaller.InstallAPIs(apiServer, optsGetter); err != nil {
		return err
	}
	readyz, ok := apiServer.(interface {
		AddReadyzChecks(...healthz.HealthChecker) error
	})
	if !ok {
		return fmt.Errorf("errortracking API server does not support readiness checks")
	}
	if err := readyz.AddReadyzChecks(healthz.NamedCheck("errortracking-database", func(_ *http.Request) error {
		if a.store == nil {
			return fmt.Errorf("error tracking database is not configured")
		}
		return a.store.ReadinessCheck()
	})); err != nil {
		return fmt.Errorf("register errortracking database readiness check: %w", err)
	}

	const groupVersion = "error-tracking.grafana.app/v0alpha1"
	root := "/apis/" + groupVersion
	for _, service := range apiServer.RegisteredWebServices() {
		if service.RootPath() != root {
			continue
		}
		service.Route(service.GET("").
			Operation("getErrorTrackingVersionDiscovery").
			Writes(metav1.APIResourceList{}).
			To(func(_ *restful.Request, response *restful.Response) {
				// The response is already being written; a disconnected client cannot
				// receive a second error response.
				_ = response.WriteEntity(&metav1.APIResourceList{
					TypeMeta:     metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"},
					GroupVersion: groupVersion,
					APIResources: []metav1.APIResource{},
				})
			}))
		return nil
	}
	return fmt.Errorf("route-only API web service %q was not installed", root)
}

func NewAppInstaller(store *storage.Store, accessClient authlib.AccessClient) (*AppInstaller, error) {
	specificConfig := &errortrackingapp.Config{Store: store, AccessClient: accessClient}
	manifest := manifestdata.LocalManifest()
	provider := simple.NewAppProvider(manifest, specificConfig, errortrackingapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
		ManifestData:   *manifest.ManifestData,
		SpecificConfig: specificConfig,
	}
	installer, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	return &AppInstaller{AppInstaller: installer, accessClient: accessClient, store: store}, nil
}
