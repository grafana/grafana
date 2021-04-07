package tests

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/guardian"

	"github.com/grafana/grafana/pkg/models"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/common/model"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// setupTestEnv initializes a store to used by the tests.
func setupTestEnv(t *testing.T, baseIntervalSeconds int64) *store.DBstore {
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
func createTestAlertRule(t *testing.T, dbstore *store.DBstore, intervalSeconds int64) *ngmodels.AlertRule {
	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanAdminValue: true,
		CanSaveValue:  true,
		CanViewValue:  true,
	})

	d := rand.Intn(1000)
	ruleGroup := fmt.Sprintf("ruleGroup-%d", d)
	namespace := "namespace"
	var orgID int64 = 1
	var userId int64 = 1
	signedInUser := models.SignedInUser{OrgId: orgID, UserId: userId}
	err := dbstore.UpdateRuleGroup(store.UpdateRuleGroupCmd{
		OrgID:       orgID,
		RequestedBy: &signedInUser,
		Namespace:   namespace,
		RuleGroupConfig: apimodels.PostableRuleGroupConfig{
			Name:     ruleGroup,
			Interval: model.Duration(time.Duration(intervalSeconds) * time.Second),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						OrgID:     1,
						Title:     fmt.Sprintf("an alert definition %d", d),
						Condition: "A",
						Data: []ngmodels.AlertQuery{
							{
								Model: json.RawMessage(`{
										"datasource": "__expr__",
										"type":"math",
										"expression":"2 + 2 > 1"
									}`),
								RelativeTimeRange: ngmodels.RelativeTimeRange{
									From: ngmodels.Duration(5 * time.Hour),
									To:   ngmodels.Duration(3 * time.Hour),
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

	namespaceUID, err := dbstore.GetNamespaceUIDBySlug(namespace, orgID, &signedInUser, false)
	require.NoError(t, err)

	q := ngmodels.ListRuleGroupAlertRulesQuery{
		OrgID:        1,
		NamespaceUID: namespaceUID,
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
func updateTestAlertRuleIntervalSeconds(t *testing.T, dbstore *store.DBstore, existingRule *ngmodels.AlertRule, intervalSeconds int64) *ngmodels.AlertRule {
	namespace := "namespace"
	var orgID int64 = 1
	var userId int64 = 1
	signedInUser := models.SignedInUser{OrgId: orgID, UserId: userId}
	cmd := store.UpdateRuleGroupCmd{
		OrgID:       orgID,
		RequestedBy: &signedInUser,
		Namespace:   "namespace",
		RuleGroupConfig: apimodels.PostableRuleGroupConfig{
			Name:     existingRule.RuleGroup,
			Interval: model.Duration(time.Duration(intervalSeconds) * time.Second),
			Rules: []apimodels.PostableExtendedRuleNode{
				{
					GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
						OrgID: 1,
						UID:   existingRule.UID,
					},
				},
			},
		},
	}

	err := dbstore.UpdateRuleGroup(cmd)
	require.NoError(t, err)

	namespaceUID, err := dbstore.GetNamespaceUIDBySlug(namespace, orgID, &signedInUser, false)
	require.NoError(t, err)

	q := ngmodels.ListRuleGroupAlertRulesQuery{
		OrgID:        1,
		NamespaceUID: namespaceUID,
		RuleGroup:    existingRule.RuleGroup,
	}
	err = dbstore.GetRuleGroupAlertRules(&q)
	require.NoError(t, err)
	require.NotEmpty(t, q.Result)

	rule := q.Result[0]
	t.Logf("alert definition: %v with interval: %d created", rule.GetKey(), rule.IntervalSeconds)
	return rule
}
