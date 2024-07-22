package store

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationUpdateAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int63n(100)+1) * time.Second}
	sqlStore := db.InitTestReplDB(t)
	store := &DBstore{
		SQLStore:      sqlStore,
		Cfg:           cfg.UnifiedAlerting,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        &logtest.Fake{},
	}
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval))
	recordingRuleGen := gen.With(gen.WithAllRecordingRules())

	t.Run("should increase version", func(t *testing.T) {
		rule := createRule(t, store, gen)
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

	t.Run("updating record field should increase version", func(t *testing.T) {
		rule := createRule(t, store, recordingRuleGen)
		newRule := models.CopyRule(rule)
		newRule.Record.Metric = "new_metric"

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
		rule := createRule(t, store, gen)
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
	sqlStore := db.InitTestReplDB(t)
	store := &DBstore{
		SQLStore:      sqlStore,
		Cfg:           cfg.UnifiedAlerting,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        &logtest.Fake{},
	}

	gen := models.RuleGen
	createRuleInFolder := func(title string, orgID int64, namespaceUID string) *models.AlertRule {
		gen := gen.With(
			gen.WithOrgID(orgID),
			gen.WithIntervalMatching(store.Cfg.BaseInterval),
			gen.WithNamespaceUID(namespaceUID),
		)
		return createRule(t, store, gen)
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

	t.Run("should fail with unique constraint violation", func(t *testing.T) {
		rule1 := createRuleInFolder("unique-rule1", 1, "my-namespace")
		rule2 := createRuleInFolder("unique-rule2", 1, "my-namespace")

		newRule1 := models.CopyRule(rule1)
		newRule2 := models.CopyRule(rule2)
		newRule2.Title = newRule1.Title

		err := store.UpdateAlertRules(context.Background(), []models.UpdateRule{{
			Existing: rule2,
			New:      *newRule2,
		},
		})
		require.ErrorIs(t, err, models.ErrAlertRuleUniqueConstraintViolation)
		require.NotEqual(t, newRule2.UID, "")
		require.NotEqual(t, newRule2.Title, "")
		require.NotEqual(t, newRule2.NamespaceUID, "")
		require.ErrorContains(t, err, newRule2.UID)
		require.ErrorContains(t, err, newRule2.Title)
		require.ErrorContains(t, err, newRule2.NamespaceUID)
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

	sqlStore := db.InitTestReplDB(t)
	store := &DBstore{
		SQLStore:       sqlStore,
		Cfg:            cfg.UnifiedAlerting,
		FolderService:  setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		FeatureToggles: featuremgmt.WithFeatures(),
	}

	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithUniqueOrgID())
	recordingGen := gen.With(gen.WithAllRecordingRules())

	rule1 := createRule(t, store, gen)
	rule2 := createRule(t, store, gen)
	rule3 := createRule(t, store, recordingGen)

	parentFolderUid := uuid.NewString()
	parentFolderTitle := "Very Parent Folder"
	createFolder(t, store, parentFolderUid, parentFolderTitle, rule1.OrgID, "")
	rule1FolderTitle := "folder-" + rule1.Title
	rule2FolderTitle := "folder-" + rule2.Title
	rule3FolderTitle := "folder-" + rule3.Title
	createFolder(t, store, rule1.NamespaceUID, rule1FolderTitle, rule1.OrgID, parentFolderUid)
	createFolder(t, store, rule2.NamespaceUID, rule2FolderTitle, rule2.OrgID, "")
	createFolder(t, store, rule3.NamespaceUID, rule3FolderTitle, rule3.OrgID, "")

	createFolder(t, store, rule2.NamespaceUID, "same UID folder", gen.GenerateRef().OrgID, "") // create a folder with the same UID but in the different org

	tc := []struct {
		name         string
		rules        []string
		ruleGroups   []string
		disabledOrgs []int64
		folders      map[models.FolderKey]string
		flags        []string
	}{
		{
			name:  "without a rule group filter, it returns all created rules",
			rules: []string{rule1.Title, rule2.Title, rule3.Title},
		},
		{
			name:       "with a rule group filter, it only returns the rules that match on rule group",
			ruleGroups: []string{rule1.RuleGroup},
			rules:      []string{rule1.Title},
		},
		{
			name:       "with a rule group filter, should be case sensitive",
			ruleGroups: []string{strings.ToUpper(rule1.RuleGroup)},
			rules:      []string{},
		},
		{
			name:         "with a filter on orgs, it returns rules that do not belong to that org",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID, rule3.OrgID},
		},
		{
			name:    "with populate folders enabled, it returns them",
			rules:   []string{rule1.Title, rule2.Title, rule3.Title},
			folders: map[models.FolderKey]string{rule1.GetFolderKey(): rule1FolderTitle, rule2.GetFolderKey(): rule2FolderTitle, rule3.GetFolderKey(): rule3FolderTitle},
		},
		{
			name:         "with populate folders enabled and a filter on orgs, it only returns selected information",
			rules:        []string{rule1.Title},
			disabledOrgs: []int64{rule2.OrgID, rule3.OrgID},
			folders:      map[models.FolderKey]string{rule1.GetFolderKey(): rule1FolderTitle},
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

	t.Run("when nested folders are enabled folders should contain full path", func(t *testing.T) {
		store.FolderService = setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))
		query := &models.GetAlertRulesForSchedulingQuery{
			PopulateFolders: true,
		}
		require.NoError(t, store.GetAlertRulesForScheduling(context.Background(), query))

		expected := map[models.FolderKey]string{
			rule1.GetFolderKey(): parentFolderTitle + "/" + rule1FolderTitle,
			rule2.GetFolderKey(): rule2FolderTitle,
			rule3.GetFolderKey(): rule3FolderTitle,
		}
		require.Equal(t, expected, query.ResultFoldersTitles)
	})
}

func TestIntegration_CountAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	store := &DBstore{SQLStore: sqlStore, FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())}

	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithRandomRecordingRules())

	rule := createRule(t, store, gen)

	count := int64(5)
	manyGen := gen.With(gen.WithNamespaceUID("many rules"), gen.WithOrgID(123))
	for i := int64(0); i < count; i++ {
		_ = createRule(t, store, manyGen)
	}

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
		"multiple success": {
			&models.CountAlertRulesQuery{
				NamespaceUID: "many rules",
				OrgID:        123,
			},
			count,
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
			count, err := store.CountInFolders(context.Background(),
				test.query.OrgID, []string{test.query.NamespaceUID}, nil)
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

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
	}
	rule := createRule(t, store, nil)

	t.Run("should not be able to delete folder without permissions to delete rules", func(t *testing.T) {
		store.AccessControl = acmock.New()
		err := store.DeleteInFolders(context.Background(), rule.OrgID, []string{rule.NamespaceUID}, &user.SignedInUser{})
		require.ErrorIs(t, err, dashboards.ErrFolderAccessDenied)
	})

	t.Run("should be able to delete folder with permissions to delete rules", func(t *testing.T) {
		store.AccessControl = acmock.New().WithPermissions([]accesscontrol.Permission{
			{Action: accesscontrol.ActionAlertingRuleDelete, Scope: dashboards.ScopeFoldersAll},
		})
		err := store.DeleteInFolders(context.Background(), rule.OrgID, []string{rule.NamespaceUID}, &user.SignedInUser{})
		require.NoError(t, err)

		c, err := store.CountInFolders(context.Background(), rule.OrgID, []string{rule.NamespaceUID}, &user.SignedInUser{})
		require.NoError(t, err)
		require.Equal(t, int64(0), c)
	})
}

func TestIntegration_GetNamespaceByUID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
	}

	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	uid := uuid.NewString()
	parentUid := uuid.NewString()
	title := "folder/title"
	parentTitle := "parent-title"
	createFolder(t, store, parentUid, parentTitle, 1, "")
	createFolder(t, store, uid, title, 1, parentUid)

	actual, err := store.GetNamespaceByUID(context.Background(), uid, 1, u)
	require.NoError(t, err)
	require.Equal(t, title, actual.Title)
	require.Equal(t, uid, actual.UID)
	require.Equal(t, title, actual.Fullpath)

	t.Run("error when user does not have permissions", func(t *testing.T) {
		someUser := &user.SignedInUser{
			UserID:  2,
			OrgID:   1,
			OrgRole: org.RoleViewer,
		}
		_, err = store.GetNamespaceByUID(context.Background(), uid, 1, someUser)
		require.ErrorIs(t, err, dashboards.ErrFolderAccessDenied)
	})

	t.Run("when nested folders are enabled full path should be populated with correct value", func(t *testing.T) {
		store.FolderService = setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders))
		actual, err := store.GetNamespaceByUID(context.Background(), uid, 1, u)
		require.NoError(t, err)
		require.Equal(t, title, actual.Title)
		require.Equal(t, uid, actual.UID)
		require.Equal(t, "parent-title/folder\\/title", actual.Fullpath)
	})
}

func TestIntegrationInsertAlertRules(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	orgID := int64(1)
	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
		Cfg:           cfg.UnifiedAlerting,
	}

	gen := models.RuleGen.With(
		models.RuleGen.WithOrgID(orgID),
		models.RuleGen.WithIntervalMatching(store.Cfg.BaseInterval),
	)
	recordingRulesGen := gen.With(
		models.RuleGen.WithAllRecordingRules(),
		models.RuleGen.WithRecordFrom("A"),
		models.RuleGen.WithMetric("my_metric"),
	)

	rules := append(gen.GenerateMany(5), recordingRulesGen.GenerateMany(5)...)

	ids, err := store.InsertAlertRules(context.Background(), rules)
	require.NoError(t, err)
	require.Len(t, ids, len(rules))

	dbRules, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
		OrgID: 1,
	})
	require.NoError(t, err)
	for idx, keyWithID := range ids {
		found := false
		for _, rule := range dbRules {
			if rule.GetKey() == keyWithID.AlertRuleKey {
				expected := rules[idx]
				require.Equal(t, keyWithID.ID, rule.ID)
				require.Equal(t, expected.Title, rule.Title)
				found = true
				break
			}
		}
		require.Truef(t, found, "Rule with key %#v was not found in database", keyWithID)
	}

	t.Run("inserted alerting rules should have nil recording rule fields on model", func(t *testing.T) {
		for _, rule := range dbRules {
			if rule.Type() == models.RuleTypeAlerting {
				require.Nil(t, rule.Record)
			}
		}
	})

	t.Run("inserted recording rules map identical fields when listed", func(t *testing.T) {
		for _, rule := range dbRules {
			if rule.Type() == models.RuleTypeRecording {
				require.NotNil(t, rule.Record)
				require.Equal(t, "my_metric", rule.Record.Metric)
				require.Equal(t, "A", rule.Record.From)
			}
		}
	})

	t.Run("inserted recording rules have empty or default alert-specific settings", func(t *testing.T) {
		for _, rule := range dbRules {
			if rule.Type() == models.RuleTypeRecording {
				require.Empty(t, rule.Condition)
				require.Equal(t, models.NoDataState(""), rule.NoDataState)
				require.Equal(t, models.ExecutionErrorState(""), rule.ExecErrState)
				require.Zero(t, rule.For)
				require.Nil(t, rule.NotificationSettings)
			}
		}
	})

	t.Run("inserted recording rules fail validation if metric name is invalid", func(t *testing.T) {
		t.Run("invalid UTF-8", func(t *testing.T) {
			invalidMetric := "my_metric\x80"
			invalidRule := recordingRulesGen.Generate()
			invalidRule.Record.Metric = invalidMetric
			_, err := store.InsertAlertRules(context.Background(), []models.AlertRule{invalidRule})
			require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
			require.ErrorContains(t, err, "metric name for recording rule must be a valid utf8 string")
		})

		t.Run("invalid metric name", func(t *testing.T) {
			invalidMetric := "with-dashes"
			invalidRule := recordingRulesGen.Generate()
			invalidRule.Record.Metric = invalidMetric
			_, err := store.InsertAlertRules(context.Background(), []models.AlertRule{invalidRule})
			require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
			require.ErrorContains(t, err, "metric name for recording rule must be a valid Prometheus metric name")
		})
	})

	t.Run("fail to insert rules with same ID", func(t *testing.T) {
		_, err = store.InsertAlertRules(context.Background(), []models.AlertRule{rules[0]})
		require.ErrorIs(t, err, models.ErrAlertRuleConflictBase)
	})
	t.Run("fail insert rules with the same title in a folder", func(t *testing.T) {
		cp := models.CopyRule(&rules[0])
		cp.UID = cp.UID + "-new"
		_, err = store.InsertAlertRules(context.Background(), []models.AlertRule{*cp})
		require.ErrorIs(t, err, models.ErrAlertRuleConflictBase)
		require.ErrorIs(t, err, models.ErrAlertRuleUniqueConstraintViolation)
		require.NotEqual(t, rules[0].UID, "")
		require.NotEqual(t, rules[0].Title, "")
		require.NotEqual(t, rules[0].NamespaceUID, "")
		require.ErrorContains(t, err, rules[0].UID)
		require.ErrorContains(t, err, rules[0].Title)
		require.ErrorContains(t, err, rules[0].NamespaceUID)
	})
	t.Run("should not let insert rules with the same UID", func(t *testing.T) {
		cp := models.CopyRule(&rules[0])
		cp.Title = "unique-test-title"
		_, err = store.InsertAlertRules(context.Background(), []models.AlertRule{*cp})
		require.ErrorIs(t, err, models.ErrAlertRuleConflictBase)
		require.ErrorContains(t, err, "rule UID under the same organisation should be unique")
	})
}

func TestIntegrationAlertRulesNotificationSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	getKeyMap := func(r []*models.AlertRule) map[models.AlertRuleKey]struct{} {
		result := make(map[models.AlertRuleKey]struct{}, len(r))
		for _, rule := range r {
			result[rule.GetKey()] = struct{}{}
		}
		return result
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
		Cfg:           cfg.UnifiedAlerting,
	}

	receiverName := "receiver\"-" + uuid.NewString()
	timeIntervalName := "time-" + util.GenerateShortUID()

	gen := models.RuleGen
	gen = gen.With(gen.WithOrgID(1), gen.WithIntervalMatching(store.Cfg.BaseInterval))
	rules := gen.GenerateManyRef(3)
	receiveRules := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(receiverName)))).GenerateManyRef(3)
	timeIntervalRules := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithMuteTimeIntervals(timeIntervalName)))).GenerateManyRef(3)
	noise := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(timeIntervalName), models.NSMuts.WithMuteTimeIntervals(receiverName)))).GenerateManyRef(3)

	deref := make([]models.AlertRule, 0, len(rules)+len(receiveRules)+len(timeIntervalRules)+len(noise))
	for _, rule := range append(append(append(rules, receiveRules...), noise...), timeIntervalRules...) {
		r := *rule
		r.ID = 0
		deref = append(deref, r)
	}

	_, err := store.InsertAlertRules(context.Background(), deref)
	require.NoError(t, err)

	t.Run("should find rules by receiver name", func(t *testing.T) {
		expected := getKeyMap(receiveRules)
		actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID:        1,
			ReceiverName: receiverName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expected))
		for _, rule := range actual {
			assert.Contains(t, expected, rule.GetKey())
		}
	})

	t.Run("should find rules by time interval name", func(t *testing.T) {
		expected := getKeyMap(timeIntervalRules)
		actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID:            1,
			TimeIntervalName: timeIntervalName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expected))
		for _, rule := range actual {
			assert.Contains(t, expected, rule.GetKey())
		}
	})

	t.Run("should find rules by receiver and time-interval name", func(t *testing.T) {
		var receiver, intervalName string
		var expected []models.AlertRuleKey
		rand.Shuffle(len(deref), func(i, j int) {
			deref[i], deref[j] = deref[j], deref[i]
		})
		for _, rule := range deref {
			if len(rule.NotificationSettings) == 0 || rule.NotificationSettings[0].Receiver == "" || len(rule.NotificationSettings[0].MuteTimeIntervals) == 0 {
				continue
			}
			if len(expected) > 0 {
				if rule.NotificationSettings[0].Receiver == receiver && slices.Contains(rule.NotificationSettings[0].MuteTimeIntervals, intervalName) {
					expected = append(expected, rule.GetKey())
				}
			} else {
				receiver = rule.NotificationSettings[0].Receiver
				intervalName = rule.NotificationSettings[0].MuteTimeIntervals[0]
				expected = append(expected, rule.GetKey())
			}
		}
		actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID:            1,
			ReceiverName:     receiver,
			TimeIntervalName: intervalName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expected))
		for _, rule := range actual {
			assert.Contains(t, expected, rule.GetKey())
		}
	})

	t.Run("RenameReceiverInNotificationSettings should update all rules that refer to the old receiver", func(t *testing.T) {
		newName := "new-receiver"
		affected, err := store.RenameReceiverInNotificationSettings(context.Background(), 1, receiverName, newName)
		require.NoError(t, err)
		require.Equal(t, len(receiveRules), affected)

		expectedUIDs := map[string]struct{}{}
		for _, rule := range receiveRules {
			expectedUIDs[rule.UID] = struct{}{}
		}
		actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID:        1,
			ReceiverName: newName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expectedUIDs))
		for _, rule := range actual {
			assert.Contains(t, expectedUIDs, rule.UID)
		}

		actual, err = store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
			OrgID:        1,
			ReceiverName: receiverName,
		})
		require.NoError(t, err)
		require.Empty(t, actual)
	})
}

func TestIntegrationListNotificationSettings(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
		Cfg:           cfg.UnifiedAlerting,
	}

	searchName := `name-%"-👍'test`
	gen := models.RuleGen
	gen = gen.With(gen.WithOrgID(1), gen.WithIntervalMatching(store.Cfg.BaseInterval))

	rulesWithNotificationsAndReceiver := gen.With(
		gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(searchName))),
	).GenerateMany(5)
	rulesWithNotificationsAndTimeInterval := gen.With(
		gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithMuteTimeIntervals(searchName))),
	).GenerateMany(5)

	rulesInOtherOrg := gen.With(
		gen.WithOrgID(2),
		gen.WithNotificationSettingsGen(models.NotificationSettingsGen()),
	).GenerateMany(5)

	rulesWithNoNotifications := gen.With(gen.WithNoNotificationSettings()).GenerateMany(5)

	deref := append(append(rulesWithNotificationsAndReceiver, rulesWithNoNotifications...), rulesInOtherOrg...)
	deref = append(deref, rulesWithNotificationsAndTimeInterval...)

	orgRules := append(rulesWithNotificationsAndReceiver, rulesWithNotificationsAndTimeInterval...)

	_, err := store.InsertAlertRules(context.Background(), deref)
	require.NoError(t, err)

	result, err := store.ListNotificationSettings(context.Background(), models.ListNotificationSettingsQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, result, len(orgRules))
	for _, rule := range rulesWithNotificationsAndReceiver {
		if !assert.Contains(t, result, rule.GetKey()) {
			continue
		}
		assert.EqualValues(t, rule.NotificationSettings, result[rule.GetKey()])
	}

	t.Run("should list notification settings by receiver name", func(t *testing.T) {
		expectedUIDs := map[models.AlertRuleKey]struct{}{}
		for _, rule := range rulesWithNotificationsAndReceiver {
			expectedUIDs[rule.GetKey()] = struct{}{}
		}

		actual, err := store.ListNotificationSettings(context.Background(), models.ListNotificationSettingsQuery{
			OrgID:        1,
			ReceiverName: searchName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expectedUIDs))
		for ruleKey := range actual {
			assert.Contains(t, expectedUIDs, ruleKey)
		}
	})
	t.Run("should filter notification settings by time interval name", func(t *testing.T) {
		expectedUIDs := map[models.AlertRuleKey]struct{}{}
		for _, rule := range rulesWithNotificationsAndTimeInterval {
			expectedUIDs[rule.GetKey()] = struct{}{}
		}

		actual, err := store.ListNotificationSettings(context.Background(), models.ListNotificationSettingsQuery{
			OrgID:            1,
			TimeIntervalName: searchName,
		})
		require.NoError(t, err)
		assert.Len(t, actual, len(expectedUIDs))
		for ruleKey := range actual {
			assert.Contains(t, expectedUIDs, ruleKey)
		}
	})
	t.Run("should return nothing if filter does not match", func(t *testing.T) {
		result, err := store.ListNotificationSettings(context.Background(), models.ListNotificationSettingsQuery{
			OrgID:            1,
			ReceiverName:     "not-found-receiver",
			TimeIntervalName: "not-found-time-interval",
		})
		require.NoError(t, err)
		require.Empty(t, result)
	})
	t.Run("should filter by time interval and receiver", func(t *testing.T) {
		var receiver, timeInterval string
		var expected []models.AlertRuleKey
		rand.Shuffle(len(orgRules), func(i, j int) {
			orgRules[i], orgRules[j] = orgRules[j], orgRules[i]
		})
		for _, rule := range orgRules {
			if len(rule.NotificationSettings) == 0 || rule.NotificationSettings[0].Receiver == "" || len(rule.NotificationSettings[0].MuteTimeIntervals) == 0 {
				continue
			}
			if len(expected) > 0 {
				if rule.NotificationSettings[0].Receiver == receiver && slices.Contains(rule.NotificationSettings[0].MuteTimeIntervals, timeInterval) {
					expected = append(expected, rule.GetKey())
				}
			} else {
				receiver = rule.NotificationSettings[0].Receiver
				timeInterval = rule.NotificationSettings[0].MuteTimeIntervals[0]
				expected = append(expected, rule.GetKey())
			}
		}

		actual, err := store.ListNotificationSettings(context.Background(), models.ListNotificationSettingsQuery{
			OrgID:            1,
			ReceiverName:     receiver,
			TimeIntervalName: timeInterval,
		})
		require.NoError(t, err)
		require.EqualValuesf(t, expected, maps.Keys(actual), "got more rules than expected: %#v", actual)
	})
}

func TestIntegrationGetNamespacesByRuleUID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	store := &DBstore{
		SQLStore:      sqlStore,
		FolderService: setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:        log.New("test-dbstore"),
		Cfg:           cfg.UnifiedAlerting,
	}

	rules := models.RuleGen.With(models.RuleMuts.WithOrgID(1), models.RuleMuts.WithRandomRecordingRules()).GenerateMany(5)
	_, err := store.InsertAlertRules(context.Background(), rules)
	require.NoError(t, err)

	uids := make([]string, 0, len(rules))
	for _, rule := range rules {
		uids = append(uids, rule.UID)
	}

	result, err := store.GetNamespacesByRuleUID(context.Background(), 1, uids...)
	require.NoError(t, err)
	require.Len(t, result, len(rules))
	for _, rule := range rules {
		if !assert.Contains(t, result, rule.UID) {
			continue
		}
		assert.EqualValues(t, rule.NamespaceUID, result[rule.UID])
	}

	// Now test with a subset of uids.
	subset := uids[:3]
	result, err = store.GetNamespacesByRuleUID(context.Background(), 1, subset...)
	require.NoError(t, err)
	require.Len(t, result, len(subset))
	for _, uid := range subset {
		if !assert.Contains(t, result, uid) {
			continue
		}
		for _, rule := range rules {
			if rule.UID == uid {
				assert.EqualValues(t, rule.NamespaceUID, result[uid])
			}
		}
	}
}

func TestIntegrationRuleGroupsCaseSensitive(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestReplDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	store := &DBstore{
		SQLStore:       sqlStore,
		FolderService:  setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures()),
		Logger:         log.New("test-dbstore"),
		Cfg:            cfg.UnifiedAlerting,
		FeatureToggles: featuremgmt.WithFeatures(),
	}

	gen := models.RuleGen.With(models.RuleMuts.WithOrgID(1))
	misc := gen.GenerateMany(5, 10)
	groupKey1 := models.GenerateGroupKey(1)
	groupKey1.RuleGroup = strings.ToLower(groupKey1.RuleGroup)
	groupKey2 := groupKey1
	groupKey2.RuleGroup = strings.ToUpper(groupKey2.RuleGroup)
	groupKey3 := groupKey1
	groupKey3.OrgID = 2

	group1 := gen.With(gen.WithGroupKey(groupKey1)).GenerateMany(3)
	group2 := gen.With(gen.WithGroupKey(groupKey2)).GenerateMany(1, 3)
	group3 := gen.With(gen.WithGroupKey(groupKey3)).GenerateMany(1, 3)

	_, err := store.InsertAlertRules(context.Background(), append(append(append(misc, group1...), group2...), group3...))
	require.NoError(t, err)

	t.Run("GetAlertRulesGroupByRuleUID", func(t *testing.T) {
		t.Run("should return rules that belong to only that group", func(t *testing.T) {
			result, err := store.GetAlertRulesGroupByRuleUID(context.Background(), &models.GetAlertRulesGroupByRuleUIDQuery{
				UID:   group1[rand.Intn(len(group1))].UID,
				OrgID: groupKey1.OrgID,
			})
			require.NoError(t, err)
			assert.Len(t, result, len(group1))
			for _, rule := range result {
				assert.Equal(t, groupKey1, rule.GetGroupKey())
				assert.Truef(t, slices.ContainsFunc(group1, func(r models.AlertRule) bool {
					return r.UID == rule.UID
				}), "rule with group key [%v] should not be in group [%v]", rule.GetGroupKey(), group1)
			}
			if t.Failed() {
				deref := make([]models.AlertRule, 0, len(result))
				for _, rule := range result {
					deref = append(deref, *rule)
				}
				t.Logf("expected rules in group %v: %v\ngot:%v", groupKey1, group1, deref)
			}
		})
	})

	t.Run("ListAlertRules", func(t *testing.T) {
		t.Run("should find only group with exact case", func(t *testing.T) {
			result, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:      1,
				RuleGroups: []string{groupKey1.RuleGroup},
			})
			require.NoError(t, err)
			assert.Len(t, result, len(group1))
			for _, rule := range result {
				assert.Equal(t, groupKey1, rule.GetGroupKey())
				assert.Truef(t, slices.ContainsFunc(group1, func(r models.AlertRule) bool {
					return r.UID == rule.UID
				}), "rule with group key [%v] should not be in group [%v]", rule.GetGroupKey(), group1)
			}
			if t.Failed() {
				deref := make([]models.AlertRule, 0, len(result))
				for _, rule := range result {
					deref = append(deref, *rule)
				}
				t.Logf("expected rules in group %v: %v\ngot:%v", groupKey1, group1, deref)
			}
		})
	})

	t.Run("GetAlertRulesForScheduling", func(t *testing.T) {
		t.Run("should find only group with exact case", func(t *testing.T) {
			q := &models.GetAlertRulesForSchedulingQuery{
				PopulateFolders: false,
				RuleGroups:      []string{groupKey1.RuleGroup},
			}
			err := store.GetAlertRulesForScheduling(context.Background(), q)
			require.NoError(t, err)
			result := q.ResultRules
			expected := append(group1, group3...)
			assert.Len(t, result, len(expected)) // query fetches all orgs
			for _, rule := range result {
				assert.Equal(t, groupKey1.RuleGroup, rule.RuleGroup)
				assert.Truef(t, slices.ContainsFunc(expected, func(r models.AlertRule) bool {
					return r.UID == rule.UID
				}), "rule with group key [%v] should not be in group [%v]", rule.GetGroupKey(), group1)
			}
			if t.Failed() {
				deref := make([]models.AlertRule, 0, len(result))
				for _, rule := range result {
					deref = append(deref, *rule)
				}
				t.Logf("expected rules in group %v: %v\ngot:%v", groupKey1.RuleGroup, expected, deref)
			}
		})
	})
}

// createAlertRule creates an alert rule in the database and returns it.
// If a generator is not specified, uniqueness of primary key is not guaranteed.
func createRule(t *testing.T, store *DBstore, generator *models.AlertRuleGenerator) *models.AlertRule {
	t.Helper()
	if generator == nil {
		generator = models.RuleGen.With(models.RuleMuts.WithIntervalMatching(store.Cfg.BaseInterval))
	}
	rule := generator.GenerateRef()
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

func createFolder(t *testing.T, store *DBstore, uid, title string, orgID int64, parentUID string) {
	t.Helper()
	u := &user.SignedInUser{
		UserID:         1,
		OrgID:          orgID,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	_, err := store.FolderService.Create(context.Background(), &folder.CreateFolderCommand{
		UID:          uid,
		OrgID:        orgID,
		Title:        title,
		Description:  "",
		SignedInUser: u,
		ParentUID:    parentUID,
	})

	require.NoError(t, err)
}

func setupFolderService(t *testing.T, sqlStore db.ReplDB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) folder.Service {
	tracer := tracing.InitializeTracerForTest()
	inProcBus := bus.ProvideBus(tracer)
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore.DB())
	_, dashboardStore := testutil.SetupDashboardService(t, sqlStore, folderStore, cfg)

	return testutil.SetupFolderService(t, cfg, sqlStore.DB(), dashboardStore, folderStore, inProcBus, features, &actest.FakeAccessControl{})
}
