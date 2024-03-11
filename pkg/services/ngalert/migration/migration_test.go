package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestDashAlertMigration tests the execution of the migration specifically for alert rules.
func TestDashAlertMigration(t *testing.T) {
	t.Run("when migrated rules contain duplicate titles", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
		alerts := []*models.Alert{
			createAlert(t, 1, 1, 1, "alert1", []string{}),
			createAlert(t, 1, 1, 2, "alert1", []string{}),
			createAlert(t, 1, 2, 3, "alert1", []string{}),
			createAlert(t, 1, 3, 4, "alert1", []string{}),
			createAlert(t, 1, 3, 5, "alert1", []string{}),
			createAlert(t, 1, 3, 6, "alert1", []string{}),
		}
		expected := map[int64][]string{
			int64(0): {"alert1", "alert1 #2"},
			int64(1): {"alert1"},
			int64(2): {"alert1", "alert1 #2", "alert1 #3"},
		}
		dashes := []*dashboards.Dashboard{
			createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			createDashboard(t, 2, 1, "dash2-1", "folder5-1", 5, nil),
			createDashboard(t, 3, 1, "dash3-1", "folder6-1", 6, nil),
		}

		for dashIndex := range expected {
			dashAlerts := make([]*models.Alert, 0)
			for _, a := range alerts {
				if a.DashboardID == dashes[dashIndex].ID {
					dashAlerts = append(dashAlerts, a)
				}
			}

			om := service.newOrgMigration(1)
			pairs := om.migrateAlerts(context.Background(), om.log, dashAlerts, dashes[dashIndex])
			err := migmodels.ExtractErrors(pairs, nil)
			require.NoError(t, err)

			expectedRules := expected[dashIndex]
			require.Len(t, pairs, len(expectedRules))
			for i, r := range pairs {
				assert.Equal(t, expectedRules[i], r.Rule.Title)
			}
		}
	})

	t.Run("when migrated rules contain titles that are too long", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
		alerts := []*models.Alert{
			createAlert(t, 1, 1, 1, strings.Repeat("a", store.AlertDefinitionMaxTitleLength+1), []string{}),
			createAlert(t, 1, 1, 2, strings.Repeat("a", store.AlertDefinitionMaxTitleLength+2), []string{}),
		}
		expected := map[int64]map[int64]string{
			int64(1): {
				1: strings.Repeat("a", store.AlertDefinitionMaxTitleLength),
				2: strings.Repeat("a", store.AlertDefinitionMaxTitleLength-3) + " #2",
			},
		}
		dashes := []*dashboards.Dashboard{
			createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
		}

		for orgId := range expected {
			om := service.newOrgMigration(orgId)
			pairs := om.migrateAlerts(context.Background(), om.log, alerts, dashes[0])
			err := migmodels.ExtractErrors(pairs, nil)
			require.NoError(t, err)

			expectedRulesMap := expected[orgId]
			require.Len(t, pairs, len(expectedRulesMap))
			for _, r := range pairs {
				exp := expectedRulesMap[*r.Rule.PanelID]
				require.Equal(t, exp, r.Rule.Title)
			}
		}
	})
}

const newQueryModel = `{"datasource":{"type":"prometheus","uid":"gdev-prometheus"},"expr":"up{job=\"fake-data-gen\"}","instant":false,"interval":"%s","intervalMs":%d,"maxDataPoints":1500,"refId":"%s"}`

func createAlertQueryWithModel(refId string, ds string, from string, to string, model string) ngModels.AlertQuery {
	rel, _ := getRelativeDuration(from, to)
	return ngModels.AlertQuery{
		RefID:             refId,
		RelativeTimeRange: ngModels.RelativeTimeRange{From: rel.From, To: rel.To},
		DatasourceUID:     ds,
		Model:             []byte(model),
	}
}

func createAlertQuery(refId string, ds string, from string, to string) ngModels.AlertQuery {
	dur, _ := calculateInterval(legacydata.NewDataTimeRange(from, to), simplejson.New(), nil)
	return createAlertQueryWithModel(refId, ds, from, to, fmt.Sprintf(newQueryModel, "", dur.Milliseconds(), refId))
}

func createClassicConditionQuery(refId string, conditions []classicCondition) ngModels.AlertQuery {
	exprModel := struct {
		Type       string             `json:"type"`
		RefID      string             `json:"refId"`
		Conditions []classicCondition `json:"conditions"`
	}{
		"classic_conditions",
		refId,
		conditions,
	}
	exprModelJSON, _ := json.Marshal(&exprModel)

	q := ngModels.AlertQuery{
		RefID:         refId,
		DatasourceUID: expressionDatasourceUID,
		Model:         exprModelJSON,
	}
	// IntervalMS and MaxDataPoints are created PreSave by AlertQuery. They don't appear to be necessary for expressions,
	// but run PreSave here to match the expected model.
	_ = q.PreSave()
	return q
}

func cond(refId string, reducer string, evalType string, thresh float64) classicCondition {
	return classicCondition{
		Evaluator: evaluator{Params: []float64{thresh}, Type: evalType},
		Operator: struct {
			Type string `json:"type"`
		}{Type: "and"},
		Query: struct {
			Params []string `json:"params"`
		}{Params: []string{refId}},
		Reducer: struct {
			Type string `json:"type"`
		}{Type: reducer},
	}
}

// TestDashAlertQueryMigration tests the execution of the migration specifically for alert rule queries.
func TestDashAlertQueryMigration(t *testing.T) {
	genAlert := func(mutators ...ngModels.AlertRuleMutator) *ngModels.AlertRule {
		rule := &ngModels.AlertRule{
			ID:              1,
			OrgID:           1,
			Title:           "alert1",
			Condition:       "B",
			Data:            []ngModels.AlertQuery{},
			IntervalSeconds: 60,
			Version:         1,
			NamespaceUID:    "folder5-1",
			DashboardUID:    pointer("dash1-1"),
			PanelID:         pointer(int64(1)),
			RuleGroup:       "dash1-1",
			RuleGroupIndex:  1,
			NoDataState:     ngModels.NoData,
			ExecErrState:    ngModels.AlertingErrState,
			For:             60 * time.Second,
			Annotations: map[string]string{
				ngModels.MigratedMessageAnnotation: "message",
			},
			Labels:   map[string]string{},
			IsPaused: false,
		}

		for _, mutator := range mutators {
			mutator(rule)
		}

		rule.RuleGroup = fmt.Sprintf("%s - 1m", *rule.DashboardUID)

		rule.Annotations[ngModels.DashboardUIDAnnotation] = *rule.DashboardUID
		rule.Annotations[ngModels.PanelIDAnnotation] = strconv.FormatInt(*rule.PanelID, 10)
		return rule
	}

	type testcase struct {
		name      string
		alerts    []*models.Alert
		dashboard *dashboards.Dashboard

		expectedFolder *dashboards.Dashboard
		expected       []*ngModels.AlertRule
		expErrors      []string
	}

	tc := []testcase{
		{
			name: "simple query and condition",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{createCondition("A", "max", "gt", 42, 1, "5m", "now")}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicCondition{
						cond("A", "max", "gt", 42),
					}))
				}),
			},
		},
		{
			name: "multiple conditions",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("A", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("B", "max", "gt", 43, 2, "3m", "now"),
						createCondition("C", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "D"
					rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("B", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("C", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("D", []classicCondition{
						cond("A", "avg", "gt", 42),
						cond("B", "max", "gt", 43),
						cond("C", "min", "lt", 20),
					}))
				}),
			},
		},
		{
			name: "multiple conditions on same query with same timerange should not create multiple queries",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("A", "max", "gt", 42, 1, "5m", "now"),
						createCondition("A", "avg", "gt", 20, 1, "5m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "B"
					rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicCondition{
						cond("A", "max", "gt", 42),
						cond("A", "avg", "gt", 20),
					}))
				}),
			},
		},
		{
			name: "multiple conditions on same query with different timeranges should create multiple queries",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("A", "max", "gt", 42, 1, "5m", "now"),
						createCondition("A", "avg", "gt", 20, 1, "3m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "C"
					rule.Data = append(rule.Data, createAlertQuery("A", "ds1-1", "3m", "now")) // Ordered by time range.
					rule.Data = append(rule.Data, createAlertQuery("B", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("C", []classicCondition{
						cond("B", "max", "gt", 42),
						cond("A", "avg", "gt", 20),
					}))
				}),
			},
		},
		{
			name: "multiple conditions custom refIds",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("Q1", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("Q2", "max", "gt", 43, 2, "3m", "now"),
						createCondition("Q3", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "A"
					rule.Data = append(rule.Data, createClassicConditionQuery("A", []classicCondition{
						cond("Q1", "avg", "gt", 42),
						cond("Q2", "max", "gt", 43),
						cond("Q3", "min", "lt", 20),
					}))
					rule.Data = append(rule.Data, createAlertQuery("Q1", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("Q2", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("Q3", "ds2-1", "3m", "now"))
				}),
			},
		},
		{
			name: "multiple conditions out of order refIds, queries should be sorted by refId and conditions should be in original order",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("B", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("C", "max", "gt", 43, 2, "3m", "now"),
						createCondition("A", "min", "lt", 20, 2, "3m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "D"
					rule.Data = append(rule.Data, createAlertQuery("A", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("B", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("C", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("D", []classicCondition{
						cond("B", "avg", "gt", 42),
						cond("C", "max", "gt", 43),
						cond("A", "min", "lt", 20),
					}))
				}),
			},
		},
		{
			name: "multiple conditions out of order with duplicate refIds",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						createCondition("C", "avg", "gt", 42, 1, "5m", "now"),
						createCondition("C", "max", "gt", 43, 1, "3m", "now"),
						createCondition("B", "min", "lt", 20, 2, "5m", "now"),
						createCondition("B", "min", "lt", 21, 2, "3m", "now"),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Condition = "E"
					rule.Data = append(rule.Data, createAlertQuery("A", "ds2-1", "3m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("B", "ds2-1", "5m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("C", "ds1-1", "3m", "now"))
					rule.Data = append(rule.Data, createAlertQuery("D", "ds1-1", "5m", "now"))
					rule.Data = append(rule.Data, createClassicConditionQuery("E", []classicCondition{
						cond("D", "avg", "gt", 42),
						cond("C", "max", "gt", 43),
						cond("B", "min", "lt", 20),
						cond("A", "min", "lt", 21),
					}))
				}),
			},
		},
		{
			name: "alerts with unknown datasource id migrates with empty datasource uid",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{createCondition("A", "max", "gt", 42, 123, "5m", "now")}), // Unknown datasource id.
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Data = append(rule.Data, createAlertQuery("A", "", "5m", "now")) // Empty datasource UID.
					rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicCondition{
						cond("A", "max", "gt", 42),
					}))
				}),
			},
		},
		{
			name: "failed alert migration fails upgrade",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{{}}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expErrors: []string{"migrate alert 'alert1'"},
		},
		{
			name: "simple query with interval, calculates intervalMs using it as min interval",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						withQueryModel(
							createCondition("A", "max", "gt", 42, 1, "5m", "now"),
							fmt.Sprintf(queryModel, "A", "1s"),
						),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Data = append(rule.Data, createAlertQueryWithModel("A", "ds1-1", "5m", "now", fmt.Sprintf(newQueryModel, "1s", 1000, "A")))
					rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicCondition{
						cond("A", "max", "gt", 42),
					}))
				}),
			},
		},
		{
			name: "simple query with interval as variable, calculates intervalMs using default as min interval",
			alerts: []*models.Alert{
				createAlertWithCond(t, 1, 1, 1, "alert1", nil,
					[]dashAlertCondition{
						withQueryModel(
							createCondition("A", "max", "gt", 42, 1, "5m", "now"),
							fmt.Sprintf(queryModel, "A", "$min_interval"),
						),
					}),
			},
			dashboard: createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
			expected: []*ngModels.AlertRule{
				genAlert(func(rule *ngModels.AlertRule) {
					rule.Data = append(rule.Data, createAlertQueryWithModel("A", "ds1-1", "5m", "now", fmt.Sprintf(newQueryModel, "$min_interval", 1000, "A")))
					rule.Data = append(rule.Data, createClassicConditionQuery("B", []classicCondition{
						cond("A", "max", "gt", 42),
					}))
				}),
			},
		},
	}
	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			sqlStore := db.InitTestDB(t)
			x := sqlStore.GetEngine()
			setupOrgsAndDatasources(t, x)
			service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
			dashes := []*dashboards.Dashboard{
				createDashboard(t, 1, 1, "dash1-1", "folder5-1", 5, nil),
				createDashboard(t, 2, 1, "dash2-1", "folder5-1", 5, nil),
				createDashboard(t, 3, 2, "dash3-2", "folder6-2", 6, nil),
				createDashboard(t, 4, 2, "dash4-2", "folder6-2", 6, nil),
				createDashboard(t, 8, 1, "dash-in-general-1", "", 0, nil),
				createDashboard(t, 9, 2, "dash-in-general-2", "", 0, nil),
				createDashboard(t, 10, 1, "dash-with-acl-1", "folder5-1", 5, func(d *dashboards.Dashboard) {
					d.Title = "Dashboard With ACL 1"
					d.HasACL = true
				}),
			}

			getDashboard := func(dashUID string) *dashboards.Dashboard {
				for _, d := range dashes {
					if d.UID == dashUID {
						return d
					}
				}
				return nil
			}

			om := service.newOrgMigration(1)
			pairs := om.migrateAlerts(context.Background(), om.log, tt.alerts, tt.dashboard)
			err := migmodels.ExtractErrors(pairs, nil)
			if len(tt.expErrors) > 0 {
				for _, expErr := range tt.expErrors {
					require.ErrorContains(t, err, expErr)
				}
				return
			}
			require.NoError(t, err)

			rules := make([]*ngModels.AlertRule, 0, len(pairs))
			for _, p := range pairs {
				rules = append(rules, p.Rule)
			}

			for _, r := range rules {
				// If folder is created, we check if separately
				if tt.expectedFolder != nil {
					folder := getDashboard(r.NamespaceUID)
					require.Equal(t, tt.expectedFolder.Title, folder.Title)
					require.Equal(t, tt.expectedFolder.OrgID, folder.OrgID)
					require.Equal(t, tt.expectedFolder.FolderUID, folder.FolderUID)
				}
			}

			cOpt := []cmp.Option{
				cmpopts.SortSlices(func(a, b *ngModels.AlertRule) bool {
					return a.ID < b.ID
				}),
				cmpopts.IgnoreUnexported(ngModels.AlertRule{}, ngModels.AlertQuery{}),
				cmpopts.IgnoreFields(ngModels.AlertRule{}, "Updated", "UID", "ID"),
			}
			if tt.expectedFolder != nil {
				cOpt = append(cOpt, cmpopts.IgnoreFields(ngModels.AlertRule{}, "NamespaceUID"))
			}
			for i := 0; i < len(rules); i++ {
				rules[i].NamespaceUID = tt.expected[i].NamespaceUID
			}
			if !cmp.Equal(tt.expected, rules, cOpt...) {
				t.Errorf("Unexpected Rule: %v", cmp.Diff(tt.expected, rules, cOpt...))
			}
		})
	}
}

var (
	now = time.Now()
)

func withQueryModel(base dashAlertCondition, model string) dashAlertCondition {
	base.Query.Model = []byte(model)
	return base
}

var queryModel = `{"datasource":{"type":"prometheus","uid":"gdev-prometheus"},"expr":"up{job=\"fake-data-gen\"}","instant":false,"refId":"%s","interval":"%s"}`

func createCondition(refId string, reducer string, evalType string, thresh float64, datasourceId int64, from string, to string) dashAlertCondition {
	return dashAlertCondition{
		Evaluator: evaluator{
			Params: []float64{thresh},
			Type:   evalType,
		},
		Operator: struct {
			Type string `json:"type"`
		}{
			Type: "and",
		},
		Query: struct {
			Params       []string `json:"params"`
			DatasourceID int64    `json:"datasourceId"`
			Model        json.RawMessage
		}{
			Params:       []string{refId, from, to},
			DatasourceID: datasourceId,
			Model:        []byte(fmt.Sprintf(queryModel, refId, "")),
		},
		Reducer: struct {
			Type string `json:"type"`
		}{
			Type: reducer,
		},
	}
}

// createAlert creates a legacy alert rule for inserting into the test database.
func createAlert(t *testing.T, orgId int, dashboardId int, panelsId int, name string, notifierUids []string) *models.Alert {
	return createAlertWithCond(t, orgId, dashboardId, panelsId, name, notifierUids, []dashAlertCondition{})
}

// createAlert creates a legacy alert rule for inserting into the test database.
func createAlertWithCond(t *testing.T, orgId int, dashboardId int, panelsId int, name string, notifierUids []string, cond []dashAlertCondition) *models.Alert {
	t.Helper()

	var settings = simplejson.New()
	if len(notifierUids) != 0 {
		notifiers := make([]any, 0)
		for _, n := range notifierUids {
			notifiers = append(notifiers, notificationKey{UID: n})
		}

		settings.Set("notifications", notifiers)
	}
	settings.Set("conditions", cond)

	return &models.Alert{
		OrgID:        int64(orgId),
		DashboardID:  int64(dashboardId),
		PanelID:      int64(panelsId),
		Name:         name,
		Message:      "message",
		Frequency:    int64(60),
		For:          60 * time.Second,
		State:        models.AlertStateOK,
		Settings:     settings,
		NewStateDate: now,
		Created:      now,
		Updated:      now,
	}
}

// createDashboard creates a dashboard for inserting into the test database.
func createDashboard(t *testing.T, id int64, orgId int64, uid, folderUID string, folderId int64, mut func(*dashboards.Dashboard)) *dashboards.Dashboard {
	t.Helper()
	d := &dashboards.Dashboard{
		ID:        id,
		OrgID:     orgId,
		UID:       uid,
		Created:   now,
		Updated:   now,
		Title:     uid, // Not tested, needed to satisfy constraint.
		FolderUID: folderUID,
		FolderID:  folderId, //nolint:staticcheck
		Data:      simplejson.New(),
		Version:   1,
	}
	if mut != nil {
		mut(d)
	}
	return d
}

// createDatasource creates a datasource for inserting into the test database.
func createDatasource(t *testing.T, id int64, orgId int64, uid string) *datasources.DataSource {
	t.Helper()
	return &datasources.DataSource{
		ID:      id,
		OrgID:   orgId,
		UID:     uid,
		Created: now,
		Updated: now,
		Name:    uid, // Not tested, needed to satisfy constraint.
	}
}

func createOrg(t *testing.T, id int64) *org.Org {
	t.Helper()
	return &org.Org{
		ID:      id,
		Version: 1,
		Name:    fmt.Sprintf("org_%d", id),
		Created: time.Now(),
		Updated: time.Now(),
	}
}

// setupOrgsAndDatasources inserts org and datasource data for testing.
func setupOrgsAndDatasources(t *testing.T, x *xorm.Engine) {
	orgs := []org.Org{
		*createOrg(t, 1),
		*createOrg(t, 2),
	}

	// Setup data_sources.
	dataSources := []datasources.DataSource{
		*createDatasource(t, 1, 1, "ds1-1"),
		*createDatasource(t, 2, 1, "ds2-1"),
		*createDatasource(t, 3, 2, "ds3-2"),
		*createDatasource(t, 4, 2, "ds4-2"),
	}

	_, errOrgs := x.Insert(orgs)
	require.NoError(t, errOrgs)

	_, errDataSourcess := x.Insert(dataSources)
	require.NoError(t, errDataSourcess)
}

func pointer[T any](b T) *T {
	return &b
}
