package migration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/alerting"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func NewTestMigrationService(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) *migrationService {
	t.Helper()
	if cfg == nil {
		cfg = setting.NewCfg()
	}

	svc, err := ProvideService(
		serverlock.ProvideService(sqlStore, tracing.InitializeTracerForTest()),
		cfg,
		featuremgmt.WithFeatures(),
		sqlStore,
		migrationStore.NewTestMigrationStore(t, sqlStore, cfg),
		fake_secrets.NewFakeSecretsService(),
		&fakeDashAlertExtractor{},
	)
	require.NoError(t, err)
	return svc.(*migrationService)
}

func NewFakeMigrationService(t testing.TB) *fakeMigrationService {
	t.Helper()
	return &fakeMigrationService{}
}

type fakeMigrationService struct {
	UpgradeService
}

func (ms *fakeMigrationService) Run(_ context.Context) error {
	// Do nothing.
	return nil
}

type fakeDashAlertExtractor struct {
	expectedAlerts []*legacymodels.Alert
}

func (f *fakeDashAlertExtractor) ValidateAlerts(ctx context.Context, dashAlertInfo alerting.DashAlertInfo) error {
	return nil
}

func (f *fakeDashAlertExtractor) GetAlerts(ctx context.Context, dashAlertInfo alerting.DashAlertInfo) ([]*legacymodels.Alert, error) {
	return f.expectedAlerts, nil
}
