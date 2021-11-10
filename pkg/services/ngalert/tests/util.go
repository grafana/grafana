package tests

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

// SetupTestEnv initializes a store to used by the tests.
func SetupTestEnv(t *testing.T, baseInterval time.Duration) (*ngalert.AlertNG, *store.DBstore) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.AlertingBaseInterval = baseInterval
	// AlertNG database migrations run and the relative database tables are created only when it's enabled
	cfg.UnifiedAlerting.Enabled = true

	m := metrics.NewNGAlert(prometheus.NewRegistry())
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	ng, err := ngalert.ProvideService(
		cfg, nil, routing.NewRouteRegister(), sqlStore,
		nil, nil, nil, nil, secretsService, m,
	)
	require.NoError(t, err)
	return ng, &store.DBstore{
		SQLStore:     ng.SQLStore,
		BaseInterval: baseInterval * time.Second,
		Logger:       log.New("ngalert-test"),
	}
}

// CreateTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t *testing.T, dbstore *store.DBstore, intervalSeconds int64, orgID int64) *models.AlertRule {
	ruleGroup := fmt.Sprintf("ruleGroup-%s", util.GenerateShortUID())
	err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:        orgID,
		NamespaceUID: "namespace",
		RuleGroupConfig: apimodels.PostableRuleGroupConfig{
			Name:     ruleGroup,
			Interval: model.Duration(time.Duration(intervalSeconds) * time.Second),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					ApiRuleNode: &apimodels.ApiRuleNode{
						Annotations: map[string]string{"testAnnoKey": "testAnnoValue"},
					},
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
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
					},
				},
			},
		},
	})
	require.NoError(t, err)

	q := models.ListRuleGroupAlertRulesQuery{
		OrgID:        orgID,
		NamespaceUID: "namespace",
		RuleGroup:    ruleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(&q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with title: %q interval: %d created", rule.GetKey(), rule.Title, rule.IntervalSeconds)
	return rule
}

// updateTestAlertRule update a dummy alert definition to be used by the tests.
func UpdateTestAlertRuleIntervalSeconds(t *testing.T, dbstore *store.DBstore, existingRule *models.AlertRule, intervalSeconds int64) *models.AlertRule {
	cmd := store.UpdateRuleGroupCmd{
		OrgID:        1,
		NamespaceUID: "namespace",
		RuleGroupConfig: apimodels.PostableRuleGroupConfig{
			Name:     existingRule.RuleGroup,
			Interval: model.Duration(time.Duration(intervalSeconds) * time.Second),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						UID: existingRule.UID,
					},
				},
			},
		},
	}

	err := dbstore.UpdateRuleGroup(cmd)
	require.NoError(t, err)

	q := models.ListRuleGroupAlertRulesQuery{
		OrgID:        1,
		NamespaceUID: "namespace",
		RuleGroup:    existingRule.RuleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(&q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with title: %s and interval: %d created", rule.GetKey(), rule.Title, rule.IntervalSeconds)
	return rule
}
