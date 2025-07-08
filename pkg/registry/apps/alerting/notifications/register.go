package notifications

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	notificationsResource "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
	notificationsApp "github.com/grafana/grafana/apps/alerting/notifications/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/templategroup"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications/timeinterval"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

type AlertingNotificationsAppProvider struct {
	app.Provider
}

func RegisterApp(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) *AlertingNotificationsAppProvider {
	if ng.IsDisabled() {
		return nil
	}
	appCfg := &runner.AppBuilderConfig{
		Authorizer:               getAuthorizer(ng.Api.AccessControl),
		LegacyStorageGetter:      getLegacyStorage(request.GetNamespaceMapper(cfg), ng),
		OpenAPIDefGetter:         v0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:             notificationsResource.GetKinds(),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}

	return &AlertingNotificationsAppProvider{
		Provider: simple.NewAppProvider(notificationsResource.LocalManifest(), appCfg, notificationsApp.New),
	}
}

func getAuthorizer(authz accesscontrol.AccessControl) authorizer.Authorizer {
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

func getLegacyStorage(namespacer request.NamespaceMapper, ng *ngalert.AlertNG) runner.LegacyStorageGetter {
	return func(gvr schema.GroupVersionResource) grafanarest.Storage {
		if gvr == receiver.ResourceInfo.GroupVersionResource() {
			return receiver.NewStorage(ng.Api.ReceiverService, namespacer, ng.Api.ReceiverService)
		} else if gvr == timeinterval.ResourceInfo.GroupVersionResource() {
			return timeinterval.NewStorage(ng.Api.MuteTimings, namespacer)
		} else if gvr == templategroup.ResourceInfo.GroupVersionResource() {
			return templategroup.NewStorage(ng.Api.Templates, namespacer)
		} else if gvr == routingtree.ResourceInfo.GroupVersionResource() {
			return routingtree.NewStorage(ng.Api.Policies, namespacer)
		}
		panic("unknown legacy storage requested: " + gvr.String())
	}
}
