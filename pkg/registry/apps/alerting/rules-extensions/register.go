package rulesextensions

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/manifestdata"
	rulesExtApp "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app"
	rulesExtConfig "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	reqns "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

// GetAuthorizer defers authorization to the alerting/rules app's authorizers — PrometheusRuleFile
// operations end up materializing AlertRule and RecordingRule objects, and we don't want this
// app to grant access broader than those already do. For now we DecisionAllow at the file level;
// downstream writes still go through the standard kind authorizers via the API server.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attrs authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	)
}

// RegisterAppInstaller wires the rules-extensions app into Grafana's app registry. It is
// disabled — returns (nil, nil) — whenever Unified Alerting is off, because the reconciler
// has no AlertRule / RecordingRule kinds to write to in that mode.
func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AppInstaller, error) {
	if ng == nil || ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Rules Extensions apiserver (rules-extensions.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	appSpecificConfig := rulesExtConfig.RuntimeConfig{
		// Validate folder existence the same way the alerting/rules app does so we don't
		// accept a PrometheusRuleFile pointing at a folder the caller can't actually see.
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
				// Without identity/org context don't block creation on folder existence —
				// the downstream AlertRule write will re-check with proper context.
				return true, nil
			}
			if _, err := ng.Api.RuleStore.GetNamespaceByUID(ctx, folderUID, orgID, user); err != nil {
				return false, nil
			}
			return true, nil
		},
		// Prefer the operator-configured default datasource for Prometheus conversion. If
		// not set, the app falls through to config.FallbackDatasourceUID ("grafanacloud-prom").
		DefaultDatasourceUID: cfg.UnifiedAlerting.PrometheusConversion.DefaultDatasourceUID,
	}

	return newAppInstaller(appSpecificConfig)
}

func newAppInstaller(appSpecificConfig rulesExtConfig.RuntimeConfig) (*AppInstaller, error) {
	installer := &AppInstaller{}

	provider := simple.NewAppProvider(manifestdata.LocalManifest(), appSpecificConfig, rulesExtApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
