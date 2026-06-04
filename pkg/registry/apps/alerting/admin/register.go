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

// syncableAMImplementations lists the Mimir/Cortex alertmanager
// implementations whose datasource configuration the sync worker knows
// how to consume. Kept in sync with the matching constant in the legacy
// admin_config API (pkg/services/ngalert/api/api_configuration.go) — both
// validation paths must accept the same set.
var syncableAMImplementations = []string{"mimir", "cortex"}

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	ng *ngalert.AlertNG
}

// GetAuthorizer routes incoming k8s requests through the per-resource
// authorizer. Reads are exposed to viewers so the UI can render consistent
// state for all roles (e.g. the import-to-GMA button); writes are admin-only,
// matching the legacy /api/v1/ngalert/admin_config HTTP API.
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

// newExternalSyncDatasourceValidator returns the AlertingConfig admission
// validator function for spec.externalAlertmanagerSync.datasourceUid.
//
// Mirrors the four checks the legacy admin_config HTTP API performs (see
// pkg/services/ngalert/api/api_configuration.go:165). Keeping the two
// paths in step is important during the transition window so admins get
// the same UX regardless of which API they hit:
//   - The sync feature flag must be on. Without it the UID would be
//     stored but never read, so accepting the write would be confusing.
//   - The datasource must exist in the request's org.
//   - The datasource type must be alertmanager.
//   - Its JsonData.implementation must be in syncableAMImplementations
//     (Mimir/Cortex — others have no compatible sync protocol).
//
// Lives in this package (the parent process side of the admin app) rather
// than in the admin app's submodule so the submodule stays free of
// grafana-parent imports (datasource service, request package, openfeature
// flag client).
func newExternalSyncDatasourceValidator(ds datasources.DataSourceService) func(ctx context.Context, uid string) error {
	return func(ctx context.Context, uid string) error {
		ofClient := openfeature.NewDefaultClient()
		if !ofClient.Boolean(ctx, featuremgmt.FlagAlertingSyncExternalAlertmanager, false, openfeature.TransactionContext(ctx)) {
			return fmt.Errorf("external alertmanager UID sync is disabled on this instance")
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

	return NewAppInstaller(ng, datasourceService)
}

func NewAppInstaller(ng *ngalert.AlertNG, datasourceService datasources.DataSourceService) (*AppInstaller, error) {
	installer := &AppInstaller{ng: ng}

	localManifest := manifestdata.LocalManifest()
	runtimeConfig := adminAppConfig.RuntimeConfig{
		ValidateExternalSyncDatasource: newExternalSyncDatasourceValidator(datasourceService),
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
