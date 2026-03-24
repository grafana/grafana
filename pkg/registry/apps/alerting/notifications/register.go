package notifications

import (
	"context"
	"unsafe"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	v0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	v1beta1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
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
	// Match on group+resource only (ignoring version) so that both v0alpha1 and v1beta1
	// requests are served by the same legacy storage.
	switch gvr.Resource {
	case inhibitionrule.ResourceInfo.GroupResource().Resource:
		return inhibitionrule.NewStorage(api.InhibitionRules, namespacer)
	case receiver.ResourceInfo.GroupResource().Resource:
		return receiver.NewStorage(api.ReceiverService, namespacer, api.ReceiverService)
	case timeinterval.ResourceInfo.GroupResource().Resource:
		srv := api.MuteTimings
		//nolint:staticcheck // not yet migrated to OpenFeature
		if a.ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
			srv = srv.WithIncludeImported()
		}
		return timeinterval.NewStorage(srv, namespacer)
	case templategroup.ResourceInfo.GroupResource().Resource:
		srv := api.Templates
		//nolint:staticcheck // not yet migrated to OpenFeature
		if a.ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI) {
			srv = srv.WithIncludeImported()
		}
		return templategroup.NewStorage(srv, namespacer)
	case routingtree.ResourceInfo.GroupResource().Resource:
		return routingtree.NewStorage(api.RouteService, namespacer)
	}
	panic("unknown legacy storage requested: " + gvr.String())
}

// AddToScheme overrides the embedded AppInstaller to also register list conversion functions
// between v0alpha1 and v1beta1. The SDK only registers conversions for individual kinds;
// list conversions must be added manually.
func (a AppInstaller) AddToScheme(scheme *runtime.Scheme) error {
	if err := a.AppInstaller.AddToScheme(scheme); err != nil {
		return err
	}
	// All list types have identical memory layouts between v0alpha1 and v1beta1
	// (same fields: TypeMeta, ListMeta, Items), so we can reinterpret the pointer
	// directly — the same approach used by conversion-gen for layout-identical types.
	type convPair struct {
		src, dst  interface{}
		convertFn conversion.ConversionFunc
	}
	pairs := []convPair{
		{
			(*v0alpha1.ReceiverList)(nil), (*v1beta1.ReceiverList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v1beta1.ReceiverList) = *(*v1beta1.ReceiverList)(unsafe.Pointer(in.(*v0alpha1.ReceiverList))) // #nosec G103
				return nil
			},
		},
		{
			(*v1beta1.ReceiverList)(nil), (*v0alpha1.ReceiverList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v0alpha1.ReceiverList) = *(*v0alpha1.ReceiverList)(unsafe.Pointer(in.(*v1beta1.ReceiverList))) // #nosec G103
				return nil
			},
		},
		{
			(*v0alpha1.InhibitionRuleList)(nil), (*v1beta1.InhibitionRuleList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v1beta1.InhibitionRuleList) = *(*v1beta1.InhibitionRuleList)(unsafe.Pointer(in.(*v0alpha1.InhibitionRuleList))) // #nosec G103
				return nil
			},
		},
		{
			(*v1beta1.InhibitionRuleList)(nil), (*v0alpha1.InhibitionRuleList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v0alpha1.InhibitionRuleList) = *(*v0alpha1.InhibitionRuleList)(unsafe.Pointer(in.(*v1beta1.InhibitionRuleList))) // #nosec G103
				return nil
			},
		},
		{
			(*v0alpha1.RoutingTreeList)(nil), (*v1beta1.RoutingTreeList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v1beta1.RoutingTreeList) = *(*v1beta1.RoutingTreeList)(unsafe.Pointer(in.(*v0alpha1.RoutingTreeList))) // #nosec G103
				return nil
			},
		},
		{
			(*v1beta1.RoutingTreeList)(nil), (*v0alpha1.RoutingTreeList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v0alpha1.RoutingTreeList) = *(*v0alpha1.RoutingTreeList)(unsafe.Pointer(in.(*v1beta1.RoutingTreeList))) // #nosec G103
				return nil
			},
		},
		{
			(*v0alpha1.TemplateGroupList)(nil), (*v1beta1.TemplateGroupList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v1beta1.TemplateGroupList) = *(*v1beta1.TemplateGroupList)(unsafe.Pointer(in.(*v0alpha1.TemplateGroupList))) // #nosec G103
				return nil
			},
		},
		{
			(*v1beta1.TemplateGroupList)(nil), (*v0alpha1.TemplateGroupList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v0alpha1.TemplateGroupList) = *(*v0alpha1.TemplateGroupList)(unsafe.Pointer(in.(*v1beta1.TemplateGroupList))) // #nosec G103
				return nil
			},
		},
		{
			(*v0alpha1.TimeIntervalList)(nil), (*v1beta1.TimeIntervalList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v1beta1.TimeIntervalList) = *(*v1beta1.TimeIntervalList)(unsafe.Pointer(in.(*v0alpha1.TimeIntervalList))) // #nosec G103
				return nil
			},
		},
		{
			(*v1beta1.TimeIntervalList)(nil), (*v0alpha1.TimeIntervalList)(nil),
			func(in, out interface{}, _ conversion.Scope) error {
				*out.(*v0alpha1.TimeIntervalList) = *(*v0alpha1.TimeIntervalList)(unsafe.Pointer(in.(*v1beta1.TimeIntervalList))) // #nosec G103
				return nil
			},
		},
	}
	for _, p := range pairs {
		if err := scheme.AddConversionFunc(p.src, p.dst, p.convertFn); err != nil {
			return err
		}
	}
	return nil
}
