package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationUpdateAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int63n(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore:      sqlStore,
		Cfg:           cfg.UnifiedAlerting,
		FolderService: setupFolderService(t, sqlStore, cfg),
		Logger:        &logtest.Fake{},
	}
	generator := models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval), models.WithUniqueID())

	t.Run("should increase version", func(t *testing.T) {
		rule := createRule(t, store, generator)
		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule.ID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
			return err
		})

		require.NoError(t, err)
		require.Equal(t, rule.Version+1, dbrule.Version)
	})

	t.Run("should fail due to optimistic locking if version does not match", func(t *testing.T) {
		rule := createRule(t, store, generator)
		rule.Version-- // simulate version discrepancy

		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})

		require.ErrorIs(t, err, ErrOptimisticLock)
	})
}

func TestIntegrationUpdateAlertRulesWithUniqueConstraintViolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int63n(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore:      sqlStore,
		Cfg:           cfg.UnifiedAlerting,
		FolderService: setupFolderService(t, sqlStore, cfg),
		Logger:        &logtest.Fake{},
	}

	idMutator := models.WithUniqueID()
	createRuleInFolder := func(title string, orgID int64, namespaceUID string) *models.AlertRule {
		generator := models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval), idMutator, models.WithNamespace(&folder.Folder{
			UID:   namespaceUID,
			Title: namespaceUID,
		}), withOrgID(orgID), models.WithTitle(title))
		return createRule(t, store, generator)
	}

	t.Run("should handle update chains without unique constraint violation", func(t *testing.T) {
		rule1 := createRuleInFolder("chain-rule1", 1, "my-namespace")
		rule2 := createRuleInFolder("chain-rule2", 1, "my-namespace")

		newRule1 := models.CopyRule(rule1)
		newRule2 := models.CopyRule(rule2)
		newRule1.Title = rule2.Title
		newRule2.Title = util.GenerateShortUID()

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule1,
			New:      *newRule1,
		}, {
			Existing: rule2,
			New:      *newRule2,
		},
		})
		require.NoError(t, err)

		dbrule1 := &models.AlertRule{}
		dbrule2 := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule1.ID).Get(dbrule1)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule1.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule2.ID).Get(dbrule2)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule2.ID))
			return nil
		})

		require.NoError(t, err)
		require.Equal(t, newRule1.Title, dbrule1.Title)
		require.Equal(t, newRule2.Title, dbrule2.Title)
	})

	t.Run("should handle update chains with cycle without unique constraint violation", func(t *testing.T) {
		rule1 := createRuleInFolder("cycle-rule1", 1, "my-namespace")
		rule2 := createRuleInFolder("cycle-rule2", 1, "my-namespace")
		rule3 := createRuleInFolder("cycle-rule3", 1, "my-namespace")

		newRule1 := models.CopyRule(rule1)
		newRule2 := models.CopyRule(rule2)
		newRule3 := models.CopyRule(rule3)
		newRule1.Title = rule2.Title
		newRule2.Title = rule3.Title
		newRule3.Title = rule1.Title

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule1,
			New:      *newRule1,
		}, {
			Existing: rule2,
			New:      *newRule2,
		}, {
			Existing: rule3,
			New:      *newRule3,
		},
		})
		require.NoError(t, err)

		dbrule1 := &models.AlertRule{}
		dbrule2 := &models.AlertRule{}
		dbrule3 := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule1.ID).Get(dbrule1)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule1.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule2.ID).Get(dbrule2)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule2.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule3.ID).Get(dbrule3)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule3.ID))
			return nil
		})

		require.NoError(t, err)
		require.Equal(t, newRule1.Title, dbrule1.Title)
		require.Equal(t, newRule2.Title, dbrule2.Title)
		require.Equal(t, newRule3.Title, dbrule3.Title)
	})

	t.Run("should handle case-insensitive intermediate collision without unique constraint violation", func(t *testing.T) {
		rule1 := createRuleInFolder("case-cycle-rule1", 1, "my-namespace")
		rule2 := createRuleInFolder("case-cycle-rule2", 1, "my-namespace")

		newRule1 := models.CopyRule(rule1)
		newRule2 := models.CopyRule(rule2)
		newRule1.Title = strings.ToUpper(rule2.Title)
		newRule2.Title = strings.ToUpper(rule1.Title)

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule1,
			New:      *newRule1,
		}, {
			Existing: rule2,
			New:      *newRule2,
		},
		})
		require.NoError(t, err)

		dbrule1 := &models.AlertRule{}
		dbrule2 := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule1.ID).Get(dbrule1)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule1.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule2.ID).Get(dbrule2)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule2.ID))
			return nil
		})

		require.NoError(t, err)
		require.Equal(t, newRule1.Title, dbrule1.Title)
		require.Equal(t, newRule2.Title, dbrule2.Title)
	})

	t.Run("should handle update multiple chains in different folders without unique constraint violation", func(t *testing.T) {
		rule1 := createRuleInFolder("multi-cycle-rule1", 1, "my-namespace")
		rule2 := createRuleInFolder("multi-cycle-rule2", 1, "my-namespace")
		rule3 := createRuleInFolder("multi-cycle-rule1", 1, "my-namespace2")
		rule4 := createRuleInFolder("multi-cycle-rule2", 1, "my-namespace2")

		newRule1 := models.CopyRule(rule1)
		newRule2 := models.CopyRule(rule2)
		newRule3 := models.CopyRule(rule3)
		newRule4 := models.CopyRule(rule4)
		newRule1.Title = rule2.Title
		newRule2.Title = rule1.Title
		newRule3.Title = rule4.Title
		newRule4.Title = rule3.Title

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule1,
			New:      *newRule1,
		}, {
			Existing: rule2,
			New:      *newRule2,
		}, {
			Existing: rule3,
			New:      *newRule3,
		}, {
			Existing: rule4,
			New:      *newRule4,
		},
		})
		require.NoError(t, err)

		dbrule1 := &models.AlertRule{}
		dbrule2 := &models.AlertRule{}
		dbrule3 := &models.AlertRule{}
		dbrule4 := &models.AlertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(models.AlertRule{}).ID(rule1.ID).Get(dbrule1)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule1.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule2.ID).Get(dbrule2)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule2.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule3.ID).Get(dbrule3)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule3.ID))

			exist, err = sess.Table(models.AlertRule{}).ID(rule4.ID).Get(dbrule4)
			if err != nil {
				return err
			}
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule4.ID))
			return nil
		})

		require.NoError(t, err)
		require.Equal(t, newRule1.Title, dbrule1.Title)
		require.Equal(t, newRule2.Title, dbrule2.Title)
		require.Equal(t, newRule3.Title, dbrule3.Title)
		require.Equal(t, newRule4.Title, dbrule4.Title)
	})
}

func TestIntegration_GetAlertRulesForScheduling(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int63n(100)) * time.Second,
	}

	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore:       sqlStore,
		Cfg:            cfg.UnifiedAlerting,
		FolderService:  setupFolderService(t, sqlStore, cfg),
		FeatureToggles: featuremgmt.WithFeatures(),
	}

	generator := models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval), models.WithUniqueID(), models.WithUniqueOrgID())
	rule1 := createRule(t, store, generator)
	rule2 := createRule(t, store, generator)
	createFolder(t, store, rule1.NamespaceUID, rule1.Title, rule1.OrgID)
	createFolder(t, store, rule2.NamespaceUID, rule2.Title, rule2.OrgID)

	tc := []struct {
		name         string
		rules        []string
		ruleGroups   []string
		disabledOrgs []int64
		folders      map[string]string
	}{
		{
			name:  "without a rule group filter, it returns all created rules",
			rules: []string{rule1.Title, rule2.Title},
		},
		{
			name:       "with a rule group filter, it only returns the rules that match on rule group",
			ruleGroups: []string{rule1.RuleGroup},
			rules:      []string{rule1.Title},
		},
		{
			name:         "with a filter on orgs, it returns rules that do not belong to that org",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID},
		},
		{
			name:    "with populate folders enabled, it returns them",
			rules:   []string{rule1.Title, rule2.Title},
			folders: map[string]string{rule1.NamespaceUID: rule1.Title, rule2.NamespaceUID: rule2.Title},
		},
		{
			name:         "with populate folders enabled and a filter on orgs, it only returns selected information",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID},
			folders:      map[string]string{rule1.NamespaceUID: rule1.Title},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			if len(tt.disabledOrgs) > 0 {
				store.Cfg.DisabledOrgs = map[int64]struct{}{}

				for _, orgID := range tt.disabledOrgs {
					store.Cfg.DisabledOrgs[orgID] = struct{}{}
					t.Cleanup(func() {
						delete(store.Cfg.DisabledOrgs, orgID)
					})
				}
			}

			populateFolders := len(tt.folders) > 0
			query := &models.GetAlertRulesForSchedulingQuery{
				RuleGroups:      tt.ruleGroups,
				PopulateFolders: populateFolders,
			}
			require.NoError(t, store.GetAlertRulesForScheduling(context.Background(), query))
			require.Len(t, query.ResultRules, len(tt.rules))

			r := make([]string, 0, len(query.ResultRules))
			for _, rule := range query.ResultRules {
				r = append(r, rule.Title)
			}

			require.ElementsMatch(t, r, tt.rules)

			if populateFolders {
				require.Equal(t, tt.folders, query.ResultFoldersTitles)
			}
		})
	}
}

func withIntervalMatching(baseInterval time.Duration) func(*models.AlertRule) {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = int64(baseInterval.Seconds()) * (rand.Int63n(10) + 1)
		rule.For = time.Duration(rule.IntervalSeconds*rand.Int63n(9)+1) * time.Second
	}
}

func TestIntegration_CountAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	store := &DBstore{SQLStore: sqlStore, FolderService: setupFolderService(t, sqlStore, cfg)}
	rule := createRule(t, store, nil)

	tests := map[string]struct {
		query     *models.CountAlertRulesQuery
		expected  int64
		expectErr bool
	}{
		"basic success": {
			&models.CountAlertRulesQuery{
				NamespaceUID: rule.NamespaceUID,
				OrgID:        rule.OrgID,
			},
			1,
			false,
		},
		"successfully returning no results": {
			&models.CountAlertRulesQuery{
				NamespaceUID: "probably not a uid we'd generate",
				OrgID:        rule.OrgID,
			},
			0,
			false,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			count, err := store.CountInFolder(context.Background(),
				test.query.OrgID, test.query.NamespaceUID, nil)
			if test.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, test.expected, count)
			}
		})
	}
}

func TestIntegration_DeleteInFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg),
		Logger:        log.New("test-dbstore"),
	}
	rule := createRule(t, store, nil)

	err := store.DeleteInFolder(context.Background(), rule.OrgID, rule.NamespaceUID)
	require.NoError(t, err)

	c, err := store.CountInFolder(context.Background(), rule.OrgID, rule.NamespaceUID, nil)
	require.NoError(t, err)
	require.Equal(t, int64(0), c)
}

func createRule(t *testing.T, store *DBstore, generate func() *models.AlertRule) *models.AlertRule {
	t.Helper()
	if generate == nil {
		generate = models.AlertRuleGen(withIntervalMatching(store.Cfg.BaseInterval), models.WithUniqueID())
	}
	rule := generate()
	err := store.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Table(models.AlertRule{}).InsertOne(rule)
		if err != nil {
			return err
		}
		dbRule := &models.AlertRule{}
		exist, err := sess.Table(models.AlertRule{}).ID(rule.ID).Get(dbRule)
		if err != nil {
			return err
		}
		if !exist {
			return errors.New("cannot read inserted record")
		}
		rule = dbRule

		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	return rule
}

func createFolder(t *testing.T, store *DBstore, namespace, title string, orgID int64) {
	t.Helper()
	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          orgID,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	_, err := store.FolderService.Create(context.Background(), &folder.CreateFolderCommand{
		UID:          namespace,
		OrgID:        orgID,
		Title:        title,
		Description:  "",
		SignedInUser: u,
	})

	require.NoError(t, err)
}

func setupFolderService(t *testing.T, sqlStore *sqlstore.SQLStore, cfg *setting.Cfg) folder.Service {
	tracer := tracing.InitializeTracerForTest()
	inProcBus := bus.ProvideBus(tracer)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	_, dashboardStore := testutil.SetupDashboardService(t, sqlStore, folderStore, cfg)

	return testutil.SetupFolderService(t, cfg, dashboardStore, folderStore, inProcBus)
}
