package notifications

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	notificationsApp "github.com/grafana/grafana/apps/alerting/notifications/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/templategroup"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/timeinterval"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AlertingNotificationsAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AlertingNotificationsAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider    = (*AlertingNotificationsAppInstaller)(nil)
)

type AlertingNotificationsAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
	ng  *ngalert.AlertNG
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AlertingNotificationsAppInstaller, error) {
	if ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Notifications API server (notifications.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AlertingNotificationsAppInstaller{
		cfg: cfg,
		ng:  ng,
	}

	localManifest := apis.LocalManifest()

	provider := simple.NewAppProvider(localManifest, nil, notificationsApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *localManifest.ManifestData,
		SpecificConfig: nil,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func (a AlertingNotificationsAppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case templategroup.ResourceInfo.GroupResource().Resource:
				return templategroup.Authorize(ctx, authz, a)
			case timeinterval.ResourceInfo.GroupResource().Resource:
				return timeinterval.Authorize(ctx, authz, a)
			case receiver.ResourceInfo.GroupResource().Resource:
				return receiver.Authorize(ctx, ac.NewReceiverAccess[*ngmodels.Receiver](authz, false), a)
			case routingtree.ResourceInfo.GroupResource().Resource:
				return routingtree.Authorize(ctx, authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		})
}

func (a AlertingNotificationsAppInstaller) GetLegacyStorage(gvr schema.GroupVersionResource) grafanarest.Storage {
	namespacer := request.GetNamespaceMapper(a.cfg)
	api := a.ng.Api
	if gvr == receiver.ResourceInfo.GroupVersionResource() {
		return receiver.NewStorage(api.ReceiverService, namespacer, api.ReceiverService)
	} else if gvr == timeinterval.ResourceInfo.GroupVersionResource() {
		return timeinterval.NewStorage(api.MuteTimings, namespacer)
	} else if gvr == templategroup.ResourceInfo.GroupVersionResource() {
		return templategroup.NewStorage(api.Templates, namespacer)
	} else if gvr == routingtree.ResourceInfo.GroupVersionResource() {
		return routingtree.NewStorage(api.Policies, namespacer)
	}
	panic("unknown legacy storage requested: " + gvr.String())
}
