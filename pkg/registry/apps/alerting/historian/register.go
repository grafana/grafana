package historian

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis"
	historianApp "github.com/grafana/grafana/apps/alerting/historian/pkg/app"
	historianAppConfig "github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiconfig"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	)
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AppInstaller, error) {
	appSpecificConfig := historianAppConfig.RuntimeConfig{}

	// If we're provided some config, then we can enable some things.
	if cfg != nil {
		nhCfg := cfg.UnifiedAlerting.NotificationHistory

		// Only parse config if enabled.
		if nhCfg.Enabled {
			lokiConfig, err := lokiconfig.NewLokiConfig(cfg.UnifiedAlerting.NotificationHistory.LokiSettings)
			if err != nil {
				return nil, err
			}

			appSpecificConfig.Notification = historianAppConfig.NotificationConfig{
				Enabled: nhCfg.Enabled,
				Loki: historianAppConfig.LokiConfig{
					LokiConfig: lokiConfig,
				},
			}
		}
	}

	// If we're provided an AlertNG, then call back into that for things we need.
	// This is a temporary whilst building out the app; we should not depend on it.
	if ng != nil {
		if ng.IsDisabled() {
			log.New("app-registry").Info("Skipping Kubernetes Alerting Historian apiserver (historian.alerting.grafana.app): Unified Alerting is disabled")
			return nil, nil
		}

		handlers := &handlers{
			historian: ng.Api.Historian,
		}
		appSpecificConfig.GetAlertStateHistoryHandler = handlers.GetAlertStateHistoryHandler
		appSpecificConfig.RuleAccess = &ruleAccessBridge{
			ac:    accesscontrol.NewRuleService(ng.Api.AccessControl),
			store: ng.Api.RuleStore,
		}
	}

	return NewAppInstaller(appSpecificConfig)
}

// ruleStore is the subset of the alert rule store needed for RBAC checks.
type ruleStore interface {
	ListAlertRules(ctx context.Context, query *ngModels.ListAlertRulesQuery) (ngModels.RulesGroup, error)
}

// ruleAccessBridge adapts Grafana's accesscontrol and rule store into the
// historian app's config.RuleAccessChecker interface.
type ruleAccessBridge struct {
	ac    *accesscontrol.RuleService
	store ruleStore
}

func (b *ruleAccessBridge) CanReadAllRules(ctx context.Context) (bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return false, err
	}
	return b.ac.CanReadAllRules(ctx, user)
}

func (b *ruleAccessBridge) AccessibleRuleUIDs(ctx context.Context, ruleUIDs []string) (map[string]bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := user.GetOrgID()

	// Fetch the requested rules in a single query to get their folder UIDs.
	rules, err := b.store.ListAlertRules(ctx, &ngModels.ListAlertRulesQuery{
		OrgID:    orgID,
		RuleUIDs: ruleUIDs,
	})
	if err != nil {
		return nil, err
	}

	// Build a set of folder UIDs referenced by the requested rules.
	folderUIDs := make(map[string]struct{})
	ruleToFolder := make(map[string]string, len(rules))
	for _, rule := range rules {
		ruleToFolder[rule.UID] = rule.NamespaceUID
		folderUIDs[rule.NamespaceUID] = struct{}{}
	}

	// Check folder access once per unique folder.
	accessibleFolders := make(map[string]bool, len(folderUIDs))
	for folderUID := range folderUIDs {
		ok, err := b.ac.HasAccessInFolder(ctx, user, ngModels.NewNamespaceUID(folderUID))
		if err != nil {
			return nil, err
		}
		accessibleFolders[folderUID] = ok
	}

	result := make(map[string]bool, len(ruleUIDs))
	for _, uid := range ruleUIDs {
		if fUID, ok := ruleToFolder[uid]; ok {
			result[uid] = accessibleFolders[fUID]
		}
	}
	return result, nil
}

func NewAppInstaller(appSpecificConfig historianAppConfig.RuntimeConfig) (*AppInstaller, error) {
	installer := &AppInstaller{}

	provider := simple.NewAppProvider(apis.LocalManifest(), appSpecificConfig, historianApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
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
