package tests

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// SetupTestEnv initializes a store to used by the tests.
func SetupTestEnv(t *testing.T, baseIntervalSeconds int64) *store.DBstore {
	cfg := setting.NewCfg()
	// AlertNG is disabled by default and only if it's enabled
	// its database migrations run and the relative database tables are created
	cfg.FeatureToggles = map[string]bool{"ngalert": true}

	ng := overrideAlertNGInRegistry(t, cfg)
	ng.SQLStore = sqlstore.InitTestDB(t)

	err := ng.Init()
	require.NoError(t, err)
	return &store.DBstore{SQLStore: ng.SQLStore, BaseInterval: time.Duration(baseIntervalSeconds) * time.Second}
}

func overrideAlertNGInRegistry(t *testing.T, cfg *setting.Cfg) ngalert.AlertNG {
	ng := ngalert.AlertNG{
		Cfg:           cfg,
		RouteRegister: routing.NewRouteRegister(),
		Log:           log.New("ngalert-test"),
		Metrics:       metrics.NewMetrics(prometheus.NewRegistry()),
	}

	// hook for initialising the service after the Cfg is populated
	// so that database migrations will run
	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*ngalert.AlertNG); ok {
			return &registry.Descriptor{
				Name:         descriptor.Name,
				Instance:     &ng,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}

	registry.RegisterOverride(overrideServiceFunc)

	return ng
}

// createTestAlertRule creates a dummy alert definition to be used by the tests.
func CreateTestAlertRule(t *testing.T, dbstore *store.DBstore, intervalSeconds int64) *models.AlertRule {
	d := rand.Intn(1000)
	ruleGroup := fmt.Sprintf("ruleGroup-%d", d)
	err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:        1,
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
						Title:     fmt.Sprintf("an alert definition %d", d),
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
		OrgID:        1,
		NamespaceUID: "namespace",
		RuleGroup:    ruleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(&q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with interval: %d created", rule.GetKey(), rule.IntervalSeconds)
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
	t.Logf("alert definition: %v with interval: %d created", rule.GetKey(), rule.IntervalSeconds)
	return rule
}
