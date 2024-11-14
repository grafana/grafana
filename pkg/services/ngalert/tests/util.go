package tests

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	ngalertfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// SetupTestEnv initializes a store to used by the tests.
func SetupTestEnv(tb testing.TB, baseInterval time.Duration) (*ngalert.AlertNG, *store.DBstore) {
	tb.Helper()

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval:          setting.SchedulerBaseInterval,
		InitializationTimeout: 30 * time.Second,
	}
	// AlertNG database migrations run and the relative database tables are created only when it's enabled
	cfg.UnifiedAlerting.Enabled = new(bool)
	*cfg.UnifiedAlerting.Enabled = true

	m := metrics.NewNGAlert(prometheus.NewRegistry())
	sqlStore := db.InitTestDB(tb)
	secretsService := secretsManager.SetupTestService(tb, database.ProvideSecretsStore(sqlStore))

	ac := acmock.New()

	tracer := tracing.InitializeTracerForTest()
	bus := bus.ProvideBus(tracer)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	dashboardService, dashboardStore := testutil.SetupDashboardService(tb, sqlStore, folderStore, cfg)
	features := featuremgmt.WithFeatures()
	folderService := testutil.SetupFolderService(tb, cfg, sqlStore, dashboardStore, folderStore, bus, features, ac)
	ruleStore, err := store.ProvideDBStore(cfg, featuremgmt.WithFeatures(), sqlStore, folderService, &dashboards.FakeDashboardService{}, ac, bus)
	require.NoError(tb, err)
	ng, err := ngalert.ProvideService(
		cfg, features, nil, nil, routing.NewRouteRegister(), sqlStore, kvstore.NewFakeKVStore(), nil, nil, quotatest.New(false, nil),
		secretsService, nil, m, folderService, ac, &dashboards.FakeDashboardService{}, nil, bus, ac,
		annotationstest.NewFakeAnnotationsRepo(), &pluginstore.FakePluginStore{}, tracer, ruleStore, httpclient.NewProvider(), ngalertfakes.NewFakeReceiverPermissionsService(),
	)
	require.NoError(tb, err)
	return ng, &store.DBstore{
		FeatureToggles: features,
		SQLStore:       ng.SQLStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: baseInterval * time.Second,
		},
		Logger:           log.New("ngalert-test"),
		DashboardService: dashboardService,
		FolderService:    folderService,
		Bus:              bus,
	}
}

// CreateTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t testing.TB, ctx context.Context, dbstore *store.DBstore, intervalSeconds int64, orgID int64) *models.AlertRule {
	return CreateTestAlertRuleWithLabels(t, ctx, dbstore, intervalSeconds, orgID, nil)
}

func CreateTestAlertRuleWithLabels(t testing.TB, ctx context.Context, dbstore *store.DBstore, intervalSeconds int64, orgID int64, labels map[string]string) *models.AlertRule {
	ruleGroup := fmt.Sprintf("ruleGroup-%s", util.GenerateShortUID())
	folderUID := "namespace"
	user := &user.SignedInUser{
		UserID:         1,
		OrgID:          orgID,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
		Permissions: map[int64]map[string][]string{
			orgID: {dashboards.ActionFoldersCreate: {dashboards.ScopeFoldersAll}},
		},
	}

	ctx = identity.WithRequester(ctx, user)
	_, err := dbstore.FolderService.Create(ctx, &folder.CreateFolderCommand{OrgID: orgID, Title: "FOLDER-" + util.GenerateShortUID(), UID: folderUID, SignedInUser: user})
	// var foldr *folder.Folder
	if errors.Is(err, dashboards.ErrFolderWithSameUIDExists) || errors.Is(err, dashboards.ErrFolderVersionMismatch) {
		_, err = dbstore.FolderService.Get(ctx, &folder.GetFolderQuery{OrgID: orgID, UID: &folderUID, SignedInUser: user})
	}
	require.NoError(t, err)

	_, err = dbstore.InsertAlertRules(ctx, []models.AlertRule{
		{

			ID:        0,
			OrgID:     orgID,
			Title:     fmt.Sprintf("an alert definition %s", util.GenerateShortUID()),
			Condition: "A",
			Data: []models.AlertQuery{
				{
					Model: json.RawMessage(`{
										"datasourceUid": "__expr__",
										"type":"math",
										"expression":"2 + 2 > 1"
									}`),
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(5 * time.Hour),
						To:   models.Duration(3 * time.Hour),
					},
					RefID: "A",
				},
			},
			Labels:          labels,
			Annotations:     map[string]string{"testAnnoKey": "testAnnoValue"},
			IntervalSeconds: intervalSeconds,
			NamespaceUID:    folderUID,
			RuleGroup:       ruleGroup,
			NoDataState:     models.NoData,
			ExecErrState:    models.AlertingErrState,
		},
	})
	require.NoError(t, err)

	q := models.ListAlertRulesQuery{
		OrgID:         orgID,
		NamespaceUIDs: []string{folderUID},
		RuleGroups:    []string{ruleGroup},
	}
	ruleList, err := dbstore.ListAlertRules(ctx, &q)
	require.NoError(t, err)
	require.NotEmpty(t, ruleList)

	rule := ruleList[0]
	t.Logf("alert definition: %v with title: %q interval: %d folder: %s created", rule.GetKey(), rule.Title, rule.IntervalSeconds, folderUID)
	return rule
}
