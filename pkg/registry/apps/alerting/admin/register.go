package admin

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/admin/pkg/apis/manifestdata"
	adminApp "github.com/grafana/grafana/apps/alerting/admin/pkg/app"
	adminAppConfig "github.com/grafana/grafana/apps/alerting/admin/pkg/app/config"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/admin/alertingconfig"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

// syncableAMImplementations must stay in sync with the matching constant in
// the legacy admin_config HTTP API (pkg/services/ngalert/api/api_configuration.go)
// so both validation paths accept the same set.
var syncableAMImplementations = []string{"mimir", "cortex"}

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	ng *ngalert.AlertNG
}

// GetAuthorizer routes per-resource. See alertingconfig.Authorize for the
// RBAC action model.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			switch attr.GetResource() {
			case alertingconfig.ResourceInfo.GroupResource().Resource:
				return alertingconfig.Authorize(ctx, authz, attr)
			}
			return authorizer.DecisionNoOpinion, "", nil
		},
	)
}

// newExternalSyncDatasourceValidator builds the admission check for
// spec.externalAlertmanagerSync.datasourceUid. Mirrors the legacy
// admin_config HTTP API (pkg/services/ngalert/api/api_configuration.go:138)
// so both surfaces accept the same inputs during the transition window.
//
// Check ordering is broad → narrow: feature flag (the global enabler) is
// checked before the ini-precedence rejection so when both apply, the user
// learns that sync isn't active at all before being told about the operator
// override. The ini check still rejects silent-accept once the flag is on,
// closing the snap-back risk if the operator later clears the override.
func newExternalSyncDatasourceValidator(cfg *setting.Cfg, ds datasources.DataSourceService) func(ctx context.Context, uid string) error {
	return func(ctx context.Context, uid string) error {
		ofClient := openfeature.NewDefaultClient()
		if !ofClient.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
			return fmt.Errorf("external alertmanager UID sync is disabled on this instance")
		}

		if cfg != nil && cfg.UnifiedAlerting.ExternalAlertmanagerUID != "" {
			return fmt.Errorf("external alertmanager UID is managed by the operator (unified_alerting.external_alertmanager_uid); cannot be changed via API")
		}

		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			return fmt.Errorf("resolve org from request namespace: %w", err)
		}

		got, err := ds.GetDataSource(ctx, &datasources.GetDataSourceQuery{
			UID:   uid,
			OrgID: ns.OrgID,
		})
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				return fmt.Errorf("datasource not found")
			}
			return fmt.Errorf("look up datasource: %w", err)
		}
		if got.Type != datasources.DS_ALERTMANAGER {
			return fmt.Errorf("datasource must be of type alertmanager")
		}
		impl := strings.ToLower(got.JsonData.Get("implementation").MustString(""))
		if !slices.Contains(syncableAMImplementations, impl) {
			return fmt.Errorf("%q implementation is not supported for sync (must be one of: %s); use the convert API for manual config import",
				impl, strings.Join(syncableAMImplementations, ", "))
		}
		return nil
	}
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
	datasourceService datasources.DataSourceService,
) (*AppInstaller, error) {
	if ng != nil && ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Admin apiserver (admin.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	return NewAppInstaller(cfg, ng, datasourceService)
}

func NewAppInstaller(cfg *setting.Cfg, ng *ngalert.AlertNG, datasourceService datasources.DataSourceService) (*AppInstaller, error) {
	installer := &AppInstaller{ng: ng}

	localManifest := manifestdata.LocalManifest()
	runtimeConfig := adminAppConfig.RuntimeConfig{
		ValidateExternalSyncDatasource: newExternalSyncDatasourceValidator(cfg, datasourceService),
	}

	provider := simple.NewAppProvider(localManifest, runtimeConfig, adminApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
		ManifestData:   *localManifest.ManifestData,
		SpecificConfig: runtimeConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
