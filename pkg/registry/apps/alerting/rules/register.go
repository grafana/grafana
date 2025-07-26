package rules

import (
	"context"
	"fmt"

	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AlertingRulesAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider    = (*AlertingRulesAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AlertingRulesAppInstaller)(nil)
	_ appinstaller.APIEnablementProvider = (*AlertingRulesAppInstaller)(nil)
)

type AlertingRulesAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
	ng  *ngalert.AlertNG
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AlertingRulesAppInstaller, error) {
	if ng.IsDisabled() {
		return nil, fmt.Errorf("alerting rules app installer cannot be registered when ngalert is disabled")
	}

	installer := &AlertingRulesAppInstaller{
		cfg: cfg,
		ng:  ng,
	}

	// specificConfig := &runner.AppBuilderConfig{
	// 	Authorizer:          getAuthorizer(),
	// 	LegacyStorageGetter: getLegacyStorage(request.GetNamespaceMapper(cfg), ng),
	// 	OpenAPIDefGetter:    model.GetOpenAPIDefinitions,
	// 	ManagedKinds:        rulesResource.GetKinds(),
	// }

	provider := simple.NewAppProvider(apis.LocalManifest(), nil, rulesApp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData: *apis.LocalManifest().ManifestData,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.ManifestGoTypeAssociator, apis.ManifestCustomRouteResponsesAssociator)
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (a *AlertingRulesAppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
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

func (a *AlertingRulesAppInstaller) GetLegacyStorage(gvr schema.GroupVersionResource) grafanarest.Storage {
	namespacer := request.GetNamespaceMapper(a.cfg)
	switch gvr {
	case recordingrule.ResourceInfo.GroupVersionResource():
		return recordingrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case alertrule.ResourceInfo.GroupVersionResource():
		return alertrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	default:
		panic("unknown legacy storage requested: " + gvr.String())
	}
}

// GetAllowedV0Alpha1Resources returns the list of resources that are allowed to be accessed in v0alpha1.
func (p *AlertingRulesAppInstaller) GetAllowedV0Alpha1Resources() []string {
	return []string{
		rulesv0alpha1.AlertRuleKind().Plural(),
		rulesv0alpha1.RecordingRuleKind().Plural(),
	}
}
