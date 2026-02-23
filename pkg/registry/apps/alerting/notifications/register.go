package notifications

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	notificationsApp "github.com/grafana/grafana/apps/alerting/notifications/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/inhibitionrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/integrationtypeschema"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/templategroup"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/timeinterval"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider    = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
	ng  *ngalert.AlertNG
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AppInstaller, error) {
	if ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Notifications API server (notifications.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AppInstaller{
		cfg: cfg,
		ng:  ng,
	}
	customCfg := notificationsApp.Config{
		ReceiverTestingHandler:       receiver.New(ng.Api.ReceiverTestService),
		IntegrationTypeSchemaHandler: integrationtypeschema.New(ac.NewReceiverAccess[*ngmodels.Receiver](ng.Api.AccessControl, false)),
	}

	localManifest := apis.LocalManifest()

	provider := simple.NewAppProvider(localManifest, nil, notificationsApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *localManifest.ManifestData,
		SpecificConfig: &customCfg,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func (a AppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case inhibitionrule.ResourceInfo.GroupResource().Resource:
				return inhibitionrule.Authorize(ctx, ac.NewInhibitionRuleAccess(authz), a)
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

func (a AppInstaller) GetLegacyStorage(gvr schema.GroupVersionResource) grafanarest.Storage {
	namespacer := request.GetNamespaceMapper(a.cfg)
	api := a.ng.Api
	if gvr == inhibitionrule.ResourceInfo.GroupVersionResource() {
		return inhibitionrule.NewStorage(api.InhibitionRules, namespacer)
	} else if gvr == receiver.ResourceInfo.GroupVersionResource() {
		return receiver.NewStorage(api.ReceiverService, namespacer, api.ReceiverService)
	} else if gvr == timeinterval.ResourceInfo.GroupVersionResource() {
		srv := api.MuteTimings
		//nolint:staticcheck // not yet migrated to OpenFeature
		if a.ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
			srv = srv.WithIncludeImported()
		}
		return timeinterval.NewStorage(srv, namespacer)
	} else if gvr == templategroup.ResourceInfo.GroupVersionResource() {
		srv := api.Templates
		//nolint:staticcheck // not yet migrated to OpenFeature
		if a.ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
			srv = srv.WithIncludeImported()
		}
		return templategroup.NewStorage(srv, namespacer)
	} else if gvr == routingtree.ResourceInfo.GroupVersionResource() {
		return routingtree.NewStorage(api.RouteService, namespacer)
	}
	panic("unknown legacy storage requested: " + gvr.String())
}
