package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

// SetupTestEnv initializes a store to used by the tests.
func SetupTestEnv(t *testing.T, baseInterval time.Duration) (*ngalert.AlertNG, *store.DBstore) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: setting.SchedulerBaseInterval,
	}
	// AlertNG database migrations run and the relative database tables are created only when it's enabled
	cfg.UnifiedAlerting.Enabled = new(bool)
	*cfg.UnifiedAlerting.Enabled = true

	m := metrics.NewNGAlert(prometheus.NewRegistry())
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	ng, err := ngalert.ProvideService(
		cfg, nil, routing.NewRouteRegister(), sqlStore,
		nil, nil, nil, nil, secretsService, nil, m,
	)
	require.NoError(t, err)
	return ng, &store.DBstore{
		SQLStore:     ng.SQLStore,
		BaseInterval: baseInterval * time.Second,
		Logger:       log.New("ngalert-test"),
	}
}

// CreateTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t *testing.T, ctx context.Context, dbstore *store.DBstore, intervalSeconds int64, orgID int64) *models.AlertRule {
	ruleGroup := fmt.Sprintf("ruleGroup-%s", util.GenerateShortUID())
	err := dbstore.UpsertAlertRules(ctx, []store.UpsertRule{
		{
			New: models.AlertRule{
				ID:        0,
				OrgID:     orgID,
				Title:     fmt.Sprintf("an alert definition %s", util.GenerateShortUID()),
				Condition: "A",
				Data: []models.AlertQuery{
					{
						Model: json.RawMessage(`{
										"datasourceUid": "-100",
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
				IntervalSeconds: intervalSeconds,
				NamespaceUID:    "namespace",
				RuleGroup:       ruleGroup,
				NoDataState:     models.NoData,
				ExecErrState:    models.AlertingErrState,
			},
		},
	})
	require.NoError(t, err)

	q := models.ListRuleGroupAlertRulesQuery{
		OrgID:        orgID,
		NamespaceUID: "namespace",
		RuleGroup:    ruleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(ctx, &q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with title: %q interval: %d created", rule.GetKey(), rule.Title, rule.IntervalSeconds)
	return rule
}
