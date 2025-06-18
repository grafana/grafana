package rules

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	rulesResource "github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

type AlertingRulesAppProvider struct {
	app.Provider
}

func RegisterApp(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) *AlertingRulesAppProvider {
	if ng.IsDisabled() {
		return nil
	}

	appCfg := &runner.AppBuilderConfig{
		Authorizer:          getAuthorizer(ng.Api.AccessControl),
		LegacyStorageGetter: getLegacyStorage(request.GetNamespaceMapper(cfg), ng),
		OpenAPIDefGetter:    model.GetOpenAPIDefinitions,
		ManagedKinds:        rulesResource.GetKinds(),
	}

	return &AlertingRulesAppProvider{
		Provider: simple.NewAppProvider(rulesResource.LocalManifest(), appCfg, rulesApp.New),
	}
}

func getAuthorizer(authz accesscontrol.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case recordingrule.ResourceInfo.GroupResource().Resource:
				return recordingrule.Authorize(ctx, authz, a)
			case alertrule.ResourceInfo.GroupResource().Resource:
				return alertrule.Authorize(ctx, authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		},
	)
}

func getLegacyStorage(namespacer request.NamespaceMapper, ng *ngalert.AlertNG) runner.LegacyStorageGetter {
	return func(gvr schema.GroupVersionResource) grafanarest.Storage {
		switch gvr {
		case recordingrule.ResourceInfo.GroupVersionResource():
			return recordingrule.NewStorage(*ng.Api.AlertRules, namespacer)
		case alertrule.ResourceInfo.GroupVersionResource():
			return alertrule.NewStorage(*ng.Api.AlertRules, namespacer)
		default:
			panic("unknown legacy storage requested: " + gvr.String())
		}
	}
}
