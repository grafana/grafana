package rules

import (
	"context"

	restclient "k8s.io/client-go/rest"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	rulesAppConfig "github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	reqns "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AlertingRulesAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider    = (*AlertingRulesAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AlertingRulesAppInstaller)(nil)
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
		log.New("app-registry").Info("Skipping Kubernetes Alerting Rules apiserver (rules.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AlertingRulesAppInstaller{
		cfg: cfg,
		ng:  ng,
	}

	appSpecificConfig := rulesAppConfig.RuntimeConfig{
		// Validate folder existence using the folder service
		FolderValidator: func(ctx context.Context, folderUID string) (bool, error) {
			if folderUID == "" {
				return false, nil
			}
			orgID, err := reqns.OrgIDForList(ctx)
			user, _ := identity.GetRequester(ctx)
			if (err != nil || orgID < 1) && user != nil {
				orgID = user.GetOrgID()
			}
			if user == nil || orgID < 1 {
				// If we can't resolve identity/org in this context, don't block creation based on existence
				return true, nil
			}
			// Use the RuleStore to check namespace (folder) visibility
			_, err = ng.Api.RuleStore.GetNamespaceByUID(ctx, folderUID, orgID, user)
			if err != nil {
				return false, nil
			}
			return true, nil
		},
		BaseEvaluationInterval: ng.Cfg.UnifiedAlerting.BaseInterval,
		ReservedLabelKeys:      ngmodels.LabelsUserCannotSpecify,
		// Validate that the configured notification receiver exists in the Alertmanager config
		NotificationSettingsValidator: func(ctx context.Context, receiver string) (bool, error) {
			if receiver == "" {
				return false, nil
			}
			orgID, err := reqns.OrgIDForList(ctx)
			if err != nil || orgID < 1 {
				if user, _ := identity.GetRequester(ctx); user != nil {
					orgID = user.GetOrgID()
				}
			}
			if orgID < 1 {
				// Without org context, skip validation rather than block
				return true, nil
			}
			provider := notifier.NewCachedNotificationSettingsValidationService(ng.Api.AlertingStore)
			vd, err := provider.Validator(ctx, orgID)
			if err != nil {
				log.New("alerting.rules.app").Error("failed to create notification settings validator", "error", err)
				// If we cannot build a validator, don't block admission
				return true, nil
			}
			// Only validate receiver presence; construct minimal settings
			if err := vd.Validate(ngmodels.NotificationSettings{Receiver: receiver}); err != nil {
				return false, nil
			}
			return true, nil
		},
	}

	provider := simple.NewAppProvider(apis.LocalManifest(), appSpecificConfig, rulesApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
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
	namespacer := reqns.GetNamespaceMapper(a.cfg)
	switch gvr {
	case recordingrule.ResourceInfo.GroupVersionResource():
		return recordingrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case alertrule.ResourceInfo.GroupVersionResource():
		return alertrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	default:
		panic("unknown legacy storage requested: " + gvr.String())
	}
}
