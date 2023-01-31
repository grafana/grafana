package provisioning

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAlertRuleService(t *testing.T) {
	ruleService := createAlertRuleService(t)

	t.Run("alert rule creation should return the created id", func(t *testing.T) {
		var orgID int64 = 1
		rule, err := ruleService.CreateAlertRule(context.Background(), dummyRule("test#1", orgID), models.ProvenanceNone, 0)
		require.NoError(t, err)
		require.NotEqual(t, 0, rule.ID, "expected to get the created id and not the zero value")
	})

	t.Run("alert rule creation should set the right provenance", func(t *testing.T) {
		var orgID int64 = 1
		rule, err := ruleService.CreateAlertRule(context.Background(), dummyRule("test#2", orgID), models.ProvenanceAPI, 0)
		require.NoError(t, err)

		_, provenance, err := ruleService.GetAlertRule(context.Background(), orgID, rule.UID)
		require.NoError(t, err)
		require.Equal(t, models.ProvenanceAPI, provenance)
	})

	t.Run("group creation should set the right provenance", func(t *testing.T) {
		var orgID int64 = 1
		group := createDummyGroup("group-test-1", orgID)
		err := ruleService.ReplaceRuleGroup(context.Background(), orgID, group, 0, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), orgID, "my-namespace", "group-test-1")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		for _, rule := range readGroup.Rules {
			_, provenance, err := ruleService.GetAlertRule(context.Background(), orgID, rule.UID)
			require.NoError(t, err)
			require.Equal(t, models.ProvenanceAPI, provenance)
		}
	})

	t.Run("alert rule group should be updated correctly", func(t *testing.T) {
		var orgID int64 = 1
		rule := dummyRule("test#3", orgID)
		rule.RuleGroup = "a"
		rule, err := ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone, 0)
		require.NoError(t, err)
		require.Equal(t, int64(60), rule.IntervalSeconds)

		var interval int64 = 120
		err = ruleService.UpdateRuleGroup(context.Background(), orgID, rule.NamespaceUID, rule.RuleGroup, 120)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), orgID, rule.UID)
		require.NoError(t, err)
		require.Equal(t, interval, rule.IntervalSeconds)
	})

	t.Run("if a folder was renamed the interval should be fetched from the renamed folder", func(t *testing.T) {
		var orgID int64 = 2
		rule := dummyRule("test#1", orgID)
		rule.NamespaceUID = "123abc"
		rule, err := ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone, 0)
		require.NoError(t, err)

		rule.NamespaceUID = "abc123"
		_, err = ruleService.UpdateAlertRule(context.Background(),
			rule, models.ProvenanceNone)
		require.NoError(t, err)
	})

	t.Run("group creation should propagate group title correctly", func(t *testing.T) {
		var orgID int64 = 1
		group := createDummyGroup("group-test-3", orgID)
		group.Rules[0].RuleGroup = "something different"

		err := ruleService.ReplaceRuleGroup(context.Background(), orgID, group, 0, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), orgID, "my-namespace", "group-test-3")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		for _, rule := range readGroup.Rules {
			require.Equal(t, "group-test-3", rule.RuleGroup)
		}
	})

	t.Run("alert rule should get interval from existing rule group", func(t *testing.T) {
		var orgID int64 = 1
		rule := dummyRule("test#4", orgID)
		rule.RuleGroup = "b"
		rule, err := ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone, 0)
		require.NoError(t, err)

		var interval int64 = 120
		err = ruleService.UpdateRuleGroup(context.Background(), orgID, rule.NamespaceUID, rule.RuleGroup, 120)
		require.NoError(t, err)

		rule = dummyRule("test#4-1", orgID)
		rule.RuleGroup = "b"
		rule, err = ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone, 0)
		require.NoError(t, err)
		require.Equal(t, interval, rule.IntervalSeconds)
	})

	t.Run("updating a rule group's top level fields should bump the version number", func(t *testing.T) {
		const (
			orgID              = 123
			namespaceUID       = "abc"
			ruleUID            = "some_rule_uid"
			ruleGroup          = "abc"
			newInterval  int64 = 120
		)
		rule := dummyRule("my_rule", orgID)
		rule.UID = ruleUID
		rule.RuleGroup = ruleGroup
		rule.NamespaceUID = namespaceUID
		_, err := ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone, 0)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), orgID, ruleUID)
		require.NoError(t, err)
		require.Equal(t, int64(1), rule.Version)
		require.Equal(t, int64(60), rule.IntervalSeconds)

		err = ruleService.UpdateRuleGroup(context.Background(), orgID, namespaceUID, ruleGroup, newInterval)
		require.NoError(t, err)

		rule, _, err = ruleService.GetAlertRule(context.Background(), orgID, ruleUID)
		require.NoError(t, err)
		require.Equal(t, int64(2), rule.Version)
		require.Equal(t, newInterval, rule.IntervalSeconds)
	})

	t.Run("updating a group by updating a rule should bump that rule's data and version number", func(t *testing.T) {
		var orgID int64 = 1
		group := createDummyGroup("group-test-5", orgID)
		err := ruleService.ReplaceRuleGroup(context.Background(), orgID, group, 0, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), orgID, "my-namespace", "group-test-5")
		require.NoError(t, err)

		updatedGroup.Rules[0].Title = "some-other-title-asdf"
		err = ruleService.ReplaceRuleGroup(context.Background(), orgID, updatedGroup, 0, models.ProvenanceAPI)
		require.NoError(t, err)

		readGroup, err := ruleService.GetRuleGroup(context.Background(), orgID, "my-namespace", "group-test-5")
		require.NoError(t, err)
		require.NotEmpty(t, readGroup.Rules)
		require.Len(t, readGroup.Rules, 1)
		require.Equal(t, "some-other-title-asdf", readGroup.Rules[0].Title)
		require.Equal(t, int64(2), readGroup.Rules[0].Version)
	})

	t.Run("updating a group by updating a rule should not remove dashboard and panel ids", func(t *testing.T) {
		var orgID int64 = 1
		dashboardUid := "huYnkl7H"
		panelId := int64(5678)
		group := createDummyGroup("group-test-5", orgID)
		group.Rules[0].Annotations = map[string]string{
			models.DashboardUIDAnnotation: dashboardUid,
			models.PanelIDAnnotation:      strconv.FormatInt(panelId, 10),
		}

		err := ruleService.ReplaceRuleGroup(context.Background(), orgID, group, 0, models.ProvenanceAPI)
		require.NoError(t, err)
		updatedGroup, err := ruleService.GetRuleGroup(context.Background(), orgID, "my-namespace", "group-test-5")
		require.NoError(t, err)

		require.NotNil(t, updatedGroup.Rules[0].DashboardUID)
		require.NotNil(t, updatedGroup.Rules[0].PanelID)
		require.Equal(t, dashboardUid, *updatedGroup.Rules[0].DashboardUID)
		require.Equal(t, panelId, *updatedGroup.Rules[0].PanelID)
	})

	t.Run("alert rule provenace should be correctly checked", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				var orgID int64 = 1
				rule := dummyRule(t.Name(), orgID)
				rule, err := ruleService.CreateAlertRule(context.Background(), rule, test.from, 0)
				require.NoError(t, err)

				_, err = ruleService.UpdateAlertRule(context.Background(), rule, test.to)
				if test.errNil {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}
	})

	t.Run("alert rule provenace should be correctly checked when writing groups", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				var orgID int64 = 1
				group := createDummyGroup(t.Name(), orgID)
				err := ruleService.ReplaceRuleGroup(context.Background(), 1, group, 0, test.from)
				require.NoError(t, err)

				group.Rules[0].Title = t.Name()
				err = ruleService.ReplaceRuleGroup(context.Background(), 1, group, 0, test.to)
				if test.errNil {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}
			})
		}
	})

	t.Run("quota met causes create to be rejected", func(t *testing.T) {
		ruleService := createAlertRuleService(t)
		checker := &MockQuotaChecker{}
		checker.EXPECT().LimitExceeded()
		ruleService.quotas = checker

		_, err := ruleService.CreateAlertRule(context.Background(), dummyRule("test#1", 1), models.ProvenanceNone, 0)

		require.ErrorIs(t, err, models.ErrQuotaReached)
	})

	t.Run("quota met causes group write to be rejected", func(t *testing.T) {
		ruleService := createAlertRuleService(t)
		checker := &MockQuotaChecker{}
		checker.EXPECT().LimitExceeded()
		ruleService.quotas = checker

		group := createDummyGroup("quota-reached", 1)
		err := ruleService.ReplaceRuleGroup(context.Background(), 1, group, 0, models.ProvenanceAPI)

		require.ErrorIs(t, err, models.ErrQuotaReached)
	})
}

func createAlertRuleService(t *testing.T) AlertRuleService {
	t.Helper()
	sqlStore := db.InitTestDB(t)
	store := store.DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Second * 10,
		},
		Logger: log.NewNopLogger(),
	}
	quotas := MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	return AlertRuleService{
		ruleStore:              store,
		provenanceStore:        store,
		quotas:                 &quotas,
		xact:                   sqlStore,
		log:                    log.New("testing"),
		baseIntervalSeconds:    10,
		defaultIntervalSeconds: 60,
	}
}

func dummyRule(title string, orgID int64) models.AlertRule {
	return createTestRule(title, "my-cool-group", orgID)
}

func createTestRule(title string, groupTitle string, orgID int64) models.AlertRule {
	return models.AlertRule{
		OrgID:           orgID,
		Title:           title,
		Condition:       "A",
		Version:         1,
		IntervalSeconds: 60,
		Data: []models.AlertQuery{
			{
				RefID:         "A",
				Model:         json.RawMessage("{}"),
				DatasourceUID: expr.DatasourceUID,
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(60),
					To:   models.Duration(0),
				},
			},
		},
		NamespaceUID: "my-namespace",
		RuleGroup:    groupTitle,
		For:          time.Second * 60,
		NoDataState:  models.OK,
		ExecErrState: models.OkErrState,
	}
}

func createDummyGroup(title string, orgID int64) models.AlertRuleGroup {
	return models.AlertRuleGroup{
		Title:     title,
		Interval:  60,
		FolderUID: "my-namespace",
		Rules: []models.AlertRule{
			dummyRule(title+"-"+"rule-1", orgID),
		},
	}
}
