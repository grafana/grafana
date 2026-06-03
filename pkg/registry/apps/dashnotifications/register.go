package dashnotifications

import (
	"context"

	restclient "k8s.io/client-go/rest"
	k8sauthorizer "k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	notificationsapis "github.com/grafana/grafana/apps/notifications/pkg/apis/manifestdata"
	notificationsapp "github.com/grafana/grafana/apps/notifications/pkg/app"
	notificationslive "github.com/grafana/grafana/apps/notifications/pkg/live"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafalive "github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
	appinstaller "github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
)

var (
	_ appsdkapiserver.AppInstaller  = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	grafanaLive *grafalive.GrafanaLive,
) (*AppInstaller, error) {
	if !features.IsEnabled(context.Background(), featuremgmt.FlagGrafanaDashboardCommentNotifications) {
		return nil, nil
	}

	// Register the per-user Live channel handler under the "notifications" namespace.
	// This must happen while Wire is initialising so the handler is ready before
	// any client connects.
	if grafanaLive != nil {
		grafanaLive.GrafanaScope.Features["notifications"] = notificationslive.NewChannelHandler()
	}

	localManifest := notificationsapis.LocalManifest()

	var specificConfig app.SpecificConfig
	if grafanaLive != nil {
		specificConfig = &notificationsapp.Config{
			Publisher: notificationslive.NewPublisher(grafanaLive),
		}
	}

	provider := simple.NewAppProvider(localManifest, specificConfig, notificationsapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // overridden by InitializeApp
		ManifestData: *localManifest.ManifestData,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, notificationsapis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}

	return &AppInstaller{AppInstaller: i}, nil
}

// GetAuthorizer allows any authenticated user to CRUD their namespace-scoped notifications.
func (a *AppInstaller) GetAuthorizer() k8sauthorizer.Authorizer {
	return k8sauthorizer.AuthorizerFunc(func(ctx context.Context, attr k8sauthorizer.Attributes) (k8sauthorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return k8sauthorizer.DecisionNoOpinion, "", nil
		}
		if _, err := identity.GetRequester(ctx); err != nil {
			return k8sauthorizer.DecisionDeny, "valid user is required", err
		}
		return k8sauthorizer.DecisionAllow, "", nil
	})
}
