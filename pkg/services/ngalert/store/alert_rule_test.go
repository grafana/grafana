package store

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"math/rand/v2"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/google/uuid"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/grafana/grafana/pkg/infra/db"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func toInsertRules(rules []models.AlertRule) []models.InsertRule {
	result := make([]models.InsertRule, len(rules))
	for i := range rules {
		result[i] = models.InsertRule{
			AlertRule: rules[i],
			Message:   "",
		}
	}
	return result
}

func TestIntegrationUpdateAlertRules(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	logger := &logtest.Fake{}
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	usr := models.UserUID("1234")

	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval))
	recordingRuleGen := gen.With(gen.WithAllRecordingRules())

	t.Run("should increase version", func(t *testing.T) {
		rule := createRule(t, store, gen)
		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &alertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(alertRule{}).ID(rule.ID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
			return err
		})

		require.NoError(t, err)
		require.Equal(t, rule.Version+1, dbrule.Version)

		t.Run("should create version record", func(t *testing.T) {
			var count int64
			err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				count, err = sess.Table(alertRuleVersion{}).Where("rule_uid = ?", rule.UID).Count()
				return err
			})
			require.NoError(t, err)
			require.EqualValues(t, 1, count) // only the current version, insert did not create version.
		})
	})

	t.Run("updating record field should increase version", func(t *testing.T) {
		rule := createRule(t, store, recordingRuleGen)
		newRule := models.CopyRule(rule)
		newRule.Record.Metric = "new_metric"

		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &alertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(alertRule{}).ID(rule.ID).Get(dbrule)
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

		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})

		require.ErrorIs(t, err, ErrOptimisticLock)
	})

	t.Run("should emit event when rules are updated", func(t *testing.T) {
		rule := createRule(t, store, gen)
		called := false
		b.publishFn = func(ctx context.Context, msg bus.Msg) error {
			event, ok := msg.(*RuleChangeEvent)
			require.True(t, ok)
			require.NotNil(t, event)
			require.Len(t, event.RuleKeys, 1)
			require.Equal(t, rule.GetKey(), event.RuleKeys[0])
			called = true
			return nil
		}
		t.Cleanup(func() {
			b.publishFn = nil
		})

		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		}})
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("should set UpdatedBy", func(t *testing.T) {
		rule := createRule(t, store, gen)
		newRule := models.CopyRule(rule)
		newRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		dbrule := &alertRule{}
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(alertRule{}).ID(rule.ID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
			return err
		})

		require.NoError(t, err)
		require.NotNil(t, dbrule.UpdatedBy)
		require.Equal(t, string(usr), *dbrule.UpdatedBy)

		t.Run("should set CreatedBy in rule version table", func(t *testing.T) {
			dbVersion := &alertRuleVersion{}
			err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				exist, err := sess.Table(alertRuleVersion{}).Where("rule_uid = ? AND version = ?", dbrule.UID, dbrule.Version).Get(dbVersion)
				require.Truef(t, exist, "new version of the rule does not exist in version table")
				return err
			})
			require.NoError(t, err)
			require.NotNil(t, dbVersion.CreatedBy)
			require.Equal(t, *dbrule.UpdatedBy, *dbVersion.CreatedBy)
		})

		t.Run("nil identity should be handled correctly", func(t *testing.T) {
			rule.Version++
			newRule.Title = util.GenerateShortUID()
			err = store.UpdateAlertRules(context.Background(), nil, []models.UpdateRule{{
				Existing: rule,
				New:      *newRule,
			},
			})
			dbrule := &alertRule{}
			err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				exist, err := sess.Table(alertRule{}).ID(rule.ID).Get(dbrule)
				require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", rule.ID))
				return err
			})
			assert.Nil(t, dbrule.UpdatedBy)
		})
	})

	t.Run("should save noop update", func(t *testing.T) {
		rule := createRule(t, store, gen)
		newRule := models.CopyRule(rule)
		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *newRule,
		},
		})
		require.NoError(t, err)

		newRule, err = store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: rule.UID})
		require.NoError(t, err)

		assert.Equal(t, rule.Version+1, newRule.Version)

		t.Run("should not create version record", func(t *testing.T) {
			var count int64
			err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				count, err = sess.Table(alertRuleVersion{}).Where("rule_uid = ?", rule.UID).Count()
				return err
			})
			require.NoError(t, err)
			require.EqualValues(t, 1, count) // only the current version
		})
	})
}

func TestIntegration_GetAlertRulesForScheduling(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)) * time.Second,
	}

	sqlStore := db.InitTestDB(t)
	fakeFolderService := foldertest.NewFakeService()
	b := &fakeBus{}
	logger := &logtest.Fake{}
	store := createTestStore(sqlStore, fakeFolderService, logger, cfg.UnifiedAlerting, b)
	store.FeatureToggles = featuremgmt.WithFeatures()

	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithUniqueOrgID())
	recordingGen := gen.With(gen.WithAllRecordingRules())

	rule1 := createRule(t, store, gen)
	rule2 := createRule(t, store, gen)
	rule3 := createRule(t, store, recordingGen)

	parentFolderUid := uuid.NewString()
	parentFolderTitle := "Very Parent Folder"
	rule1FolderTitle := "folder-" + rule1.Title
	rule2FolderTitle := "folder-" + rule2.Title
	rule3FolderTitle := "folder-" + rule3.Title

	fakeFolderService.AddFolder(&folder.Folder{
		UID:       rule1.NamespaceUID,
		Title:     rule1FolderTitle,
		OrgID:     rule1.OrgID,
		ParentUID: parentFolderUid,
		Fullpath:  rule1FolderTitle,
	})
	fakeFolderService.AddFolder(&folder.Folder{
		UID:       rule2.NamespaceUID,
		Title:     rule2FolderTitle,
		OrgID:     rule2.OrgID,
		ParentUID: "",
		Fullpath:  rule2FolderTitle,
	})
	fakeFolderService.AddFolder(&folder.Folder{
		UID:       rule3.NamespaceUID,
		Title:     rule3FolderTitle,
		OrgID:     rule3.OrgID,
		ParentUID: "",
		Fullpath:  rule3FolderTitle,
	})
	fakeFolderService.AddFolder(&folder.Folder{
		UID:       parentFolderUid,
		Title:     parentFolderTitle,
		OrgID:     rule1.OrgID,
		ParentUID: "",
		Fullpath:  parentFolderTitle,
	})

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
		fakeFolderService.AddFolder(&folder.Folder{
			UID:       rule1.NamespaceUID,
			Title:     rule1FolderTitle,
			OrgID:     rule1.OrgID,
			ParentUID: parentFolderUid,
			Fullpath:  parentFolderTitle + "/" + rule1FolderTitle,
		})

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
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)

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
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
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

func TestIntegration_DeleteAlertRulesByUID(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	cfg.UnifiedAlerting.RuleVersionRecordLimit = -1

	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, &fakeBus{})
	protoInstanceStore := ProtoInstanceDBStore{
		SQLStore:       sqlStore,
		Logger:         logger,
		FeatureToggles: featuremgmt.WithFeatures(),
	}

	gen := models.RuleGen

	t.Run("should emit event when rules are deleted", func(t *testing.T) {
		// Create a new store to pass the custom bus to check the signal
		b := &fakeBus{}
		logger := log.New("test-dbstore")
		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

		rule := createRule(t, store, gen)
		called := false
		b.publishFn = func(ctx context.Context, msg bus.Msg) error {
			event, ok := msg.(*RuleChangeEvent)
			require.True(t, ok)
			require.NotNil(t, event)
			require.Len(t, event.RuleKeys, 1)
			require.Equal(t, rule.GetKey(), event.RuleKeys[0])
			called = true
			return nil
		}
		err := store.DeleteAlertRulesByUID(context.Background(), rule.OrgID, &models.AlertingUserUID, false, rule.UID)
		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("should delete alert rule state", func(t *testing.T) {
		rule := createRule(t, store, gen)

		// Save state for the alert rule
		instances := []models.AlertInstance{
			{
				AlertInstanceKey: models.AlertInstanceKey{
					RuleUID:   rule.UID,
					RuleOrgID: rule.OrgID,
				},
			},
		}
		err := protoInstanceStore.SaveAlertInstancesForRule(context.Background(), rule.GetKeyWithGroup(), instances)
		require.NoError(t, err)
		savedInstances, err := protoInstanceStore.ListAlertInstances(context.Background(), &models.ListAlertInstancesQuery{
			RuleUID:   rule.UID,
			RuleOrgID: rule.OrgID,
		})
		require.NoError(t, err)
		require.Len(t, savedInstances, 1)

		// Delete the rule
		err = store.DeleteAlertRulesByUID(context.Background(), rule.OrgID, &models.AlertingUserUID, false, rule.UID)
		require.NoError(t, err)

		// Now there should be no alert rule state
		savedInstances, err = protoInstanceStore.ListAlertInstances(context.Background(), &models.ListAlertInstancesQuery{
			RuleUID:   rule.UID,
			RuleOrgID: rule.OrgID,
		})
		require.NoError(t, err)
		require.Empty(t, savedInstances)
	})

	t.Run("should remove all version and insert one with empty rule_uid when DeletedRuleRetention is set", func(t *testing.T) {
		orgID := int64(rand.IntN(1000)) + 1
		gen = gen.With(gen.WithOrgID(orgID))
		// Create a new store to pass the custom bus to check the signal
		b := &fakeBus{}
		logger := log.New("test-dbstore")

		cfg.UnifiedAlerting.DeletedRuleRetention = 1000 * time.Hour

		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
		store.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore)

		result, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, toInsertRules(gen.GenerateMany(3)))
		uids := make([]string, 0, len(result))
		for _, rule := range result {
			uids = append(uids, rule.UID)
		}
		require.NoError(t, err)
		rules, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{OrgID: orgID, RuleUIDs: uids})
		require.NoError(t, err)

		updates := make([]models.UpdateRule, 0, len(rules))
		for _, rule := range rules {
			rule2 := models.CopyRule(rule, gen.WithTitle(util.GenerateShortUID()))
			updates = append(updates, models.UpdateRule{
				Existing: rule,
				New:      *rule2,
			})
		}
		err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, updates)
		require.NoError(t, err)

		versions, err := store.GetAlertRuleVersions(context.Background(), orgID, rules[0].GUID)
		require.NoError(t, err)
		require.Len(t, versions, 2)

		err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), false, uids...)
		require.NoError(t, err)

		guids := make([]string, 0, len(rules))
		for _, rule := range rules {
			guids = append(guids, rule.GUID)
		}

		_ = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			var versions []alertRuleVersion
			err = sess.Table(alertRuleVersion{}).Where(`rule_uid = ''`).In("rule_guid", guids).Find(&versions)
			require.NoError(t, err)
			require.Len(t, versions, len(rules)) // should be one version per GUID

			for _, version := range versions {
				assert.Equal(t, "", version.RuleUID)
				assert.Equal(t, "test", *version.CreatedBy)
				// Remove the GUID from guids
				for i, guid := range guids {
					if guid == version.RuleGUID {
						guids = append(guids[:i], guids[i+1:]...)
						break
					}
				}
			}
			// Ensure that guids is empty
			assert.Empty(t, guids, "Some rules are left unrecoverable")
			return nil
		})
	})

	t.Run("should remove all versions and not keep history if DeletedRuleRetention = 0", func(t *testing.T) {
		orgID := int64(rand.IntN(1000)) + 1
		gen = gen.With(gen.WithOrgID(orgID))
		// Create a new store to pass the custom bus to check the signal
		b := &fakeBus{}
		logger := log.New("test-dbstore")

		cfg.UnifiedAlerting.DeletedRuleRetention = 0

		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
		store.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore)

		result, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, toInsertRules(gen.GenerateMany(3)))
		uids := make([]string, 0, len(result))
		for _, rule := range result {
			uids = append(uids, rule.UID)
		}
		require.NoError(t, err)
		rules, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{OrgID: orgID, RuleUIDs: uids})
		require.NoError(t, err)

		updates := make([]models.UpdateRule, 0, len(rules))
		for _, rule := range rules {
			rule2 := models.CopyRule(rule, gen.WithTitle(util.GenerateShortUID()))
			updates = append(updates, models.UpdateRule{
				Existing: rule,
				New:      *rule2,
			})
		}
		err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, updates)
		require.NoError(t, err)

		versions, err := store.GetAlertRuleVersions(context.Background(), orgID, rules[0].GUID)
		require.NoError(t, err)
		require.Len(t, versions, 2)

		err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), false, uids...)
		require.NoError(t, err)

		guids := make([]string, 0, len(rules))
		for _, rule := range rules {
			guids = append(guids, rule.GUID)
		}

		_ = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			var versions []alertRuleVersion
			err = sess.Table(alertRuleVersion{}).Where(`rule_uid = ''`).In("rule_guid", guids).Find(&versions)
			require.NoError(t, err)
			require.Emptyf(t, versions, "some rules were not permanently deleted") // should be one version per GUID
			return nil
		})
	})

	t.Run("should remove all versions and not keep history if permanently is true", func(t *testing.T) {
		orgID := int64(rand.IntN(1000)) + 1
		gen = gen.With(gen.WithOrgID(orgID))
		// Create a new store to pass the custom bus to check the signal
		b := &fakeBus{}
		logger := log.New("test-dbstore")

		cfg.UnifiedAlerting.DeletedRuleRetention = 1000 * time.Hour

		store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
		store.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore)

		result, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, toInsertRules(gen.GenerateMany(3)))
		uids := make([]string, 0, len(result))
		for _, rule := range result {
			uids = append(uids, rule.UID)
		}
		require.NoError(t, err)
		rules, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{OrgID: orgID, RuleUIDs: uids})
		require.NoError(t, err)

		updates := make([]models.UpdateRule, 0, len(rules))
		for _, rule := range rules {
			rule2 := models.CopyRule(rule, gen.WithTitle(util.GenerateShortUID()))
			updates = append(updates, models.UpdateRule{
				Existing: rule,
				New:      *rule2,
			})
		}
		err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, updates)
		require.NoError(t, err)

		versions, err := store.GetAlertRuleVersions(context.Background(), orgID, rules[0].GUID)
		require.NoError(t, err)
		require.Len(t, versions, 2)

		err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), true, uids...)
		require.NoError(t, err)

		guids := make([]string, 0, len(rules))
		for _, rule := range rules {
			guids = append(guids, rule.GUID)
		}

		_ = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			var versions []alertRuleVersion
			err = sess.Table(alertRuleVersion{}).Where(`rule_uid = ''`).In("rule_guid", guids).Find(&versions)
			require.NoError(t, err)
			require.Emptyf(t, versions, "some rules were not permanently deleted") // should be one version per GUID
			return nil
		})
	})
}

func TestIntegrationInsertAlertRules(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	orgID := int64(1)
	usr := models.UserUID("test")
	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

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

	ids, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(rules))
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

	t.Run("inserted rules should have UpdatedBy set", func(t *testing.T) {
		for _, rule := range dbRules {
			if assert.NotNil(t, rule.UpdatedBy) {
				assert.Equal(t, usr, *rule.UpdatedBy)
			}
		}
	})

	t.Run("inserted recording rules fail validation if metric name is invalid", func(t *testing.T) {
		t.Run("invalid UTF-8", func(t *testing.T) {
			invalidMetric := "my_metric\x80"
			invalidRule := recordingRulesGen.Generate()
			invalidRule.Record.Metric = invalidMetric
			_, err := store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: invalidRule}})
			require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
			require.ErrorContains(t, err, "metric name for recording rule must be a valid utf8 string")
		})
	})

	t.Run("clears fields that should not exist on recording rules", func(t *testing.T) {
		rule := recordingRulesGen.Generate()
		rules, err := store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: rule}})
		require.NoError(t, err)
		require.Len(t, rules, 1)
		ruleUID := rules[0].UID
		savedRule, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{
			OrgID: orgID,
			UID:   ruleUID,
		})
		require.NoError(t, err)
		require.Equal(t, "", savedRule.Condition)
		require.Equal(t, models.NoDataState(""), savedRule.NoDataState)
		require.Equal(t, models.ExecutionErrorState(""), savedRule.ExecErrState)
		require.Zero(t, savedRule.For)
		require.Nil(t, savedRule.NotificationSettings)
	})

	t.Run("fail to insert rules with same ID", func(t *testing.T) {
		_, err = store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: rules[0]}})
		require.ErrorIs(t, err, models.ErrAlertRuleConflictBase)
	})
	t.Run("should not fail insert rules with the same title in a folder", func(t *testing.T) {
		cp := models.CopyRule(&rules[0])
		cp.UID = cp.UID + "-new"
		_, err = store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: *cp}})
		require.NoError(t, err)
	})
	t.Run("should not let insert rules with the same UID", func(t *testing.T) {
		cp := models.CopyRule(&rules[0])
		cp.Title = "unique-test-title"
		_, err = store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: *cp}})
		require.ErrorIs(t, err, models.ErrAlertRuleConflictBase)
		require.ErrorContains(t, err, fmt.Sprintf("Failed to save alert rule '%s' in organization %d due to conflict", cp.UID, cp.OrgID))
	})

	t.Run("should emit event when rules are inserted", func(t *testing.T) {
		rule := gen.Generate()
		called := false
		t.Cleanup(func() {
			b.publishFn = nil
		})
		b.publishFn = func(ctx context.Context, msg bus.Msg) error {
			event, ok := msg.(*RuleChangeEvent)
			require.True(t, ok)
			require.NotNil(t, event)
			require.Len(t, event.RuleKeys, 1)
			require.Equal(t, rule.GetKey(), event.RuleKeys[0])
			called = true
			return nil
		}

		rules, err := store.InsertAlertRules(context.Background(), &usr, []models.InsertRule{{AlertRule: rule}})
		require.NoError(t, err)
		require.Len(t, rules, 1)
		require.True(t, called)
	})

	t.Run("nil identity should be handled correctly", func(t *testing.T) {
		rule := gen.Generate()
		ids, err = store.InsertAlertRules(context.Background(), nil, []models.InsertRule{{AlertRule: rule}})
		require.NoError(t, err)
		insertedRule, err := store.GetRuleByID(context.Background(), models.GetAlertRuleByIDQuery{
			ID:    ids[0].ID,
			OrgID: rule.OrgID,
		})
		require.NoError(t, err)
		require.Nil(t, insertedRule.UpdatedBy)
	})
}

func TestIntegrationAlertRulesNotificationSettings(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")

	getKeyMap := func(r []*models.AlertRule) map[models.AlertRuleKey]struct{} {
		result := make(map[models.AlertRuleKey]struct{}, len(r))
		for _, rule := range r {
			result[rule.GetKey()] = struct{}{}
		}
		return result
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	receiverName := "receiver\"-" + uuid.NewString()
	timeIntervalName := "time-" + util.GenerateShortUID()

	gen := models.RuleGen
	gen = gen.With(gen.WithOrgID(1), gen.WithIntervalMatching(store.Cfg.BaseInterval))
	rules := gen.GenerateManyRef(3)
	receiveRules := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(receiverName)))).GenerateManyRef(3)
	mutetimeIntervalRules := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithMuteTimeIntervals(timeIntervalName)))).GenerateManyRef(3)
	activeTimeIntervalRules := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithActiveTimeIntervals(timeIntervalName)))).GenerateManyRef(3)
	timeIntervalRules := append(mutetimeIntervalRules, activeTimeIntervalRules...)
	noise := gen.With(gen.WithNotificationSettingsGen(models.NotificationSettingsGen(models.NSMuts.WithReceiver(timeIntervalName), models.NSMuts.WithMuteTimeIntervals(receiverName)))).GenerateManyRef(3)

	deref := make([]models.AlertRule, 0, len(rules)+len(receiveRules)+len(timeIntervalRules)+len(noise))
	for _, rule := range append(append(append(rules, receiveRules...), noise...), timeIntervalRules...) {
		r := *rule
		r.ID = 0
		deref = append(deref, r)
	}
	provenances := make(map[models.AlertRuleKey]models.Provenance, len(receiveRules)+len(timeIntervalRules))
	for idx, rule := range append(timeIntervalRules, receiveRules...) {
		p := models.KnownProvenances[idx%len(models.KnownProvenances)]
		provenances[rule.GetKey()] = p
		require.NoError(t, store.SetProvenance(context.Background(), rule, rule.OrgID, p))
	}

	_, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(deref))
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
			cpr := rule.ContactPointRouting()
			if cpr == nil || cpr.Receiver == "" || len(cpr.MuteTimeIntervals) == 0 || len(cpr.ActiveTimeIntervals) == 0 {
				continue
			}
			if len(expected) > 0 {
				if cpr.Receiver == receiver && (slices.Contains(cpr.MuteTimeIntervals, intervalName) || slices.Contains(cpr.ActiveTimeIntervals, intervalName)) {
					expected = append(expected, rule.GetKey())
				}
			} else {
				receiver = cpr.Receiver
				if len(cpr.MuteTimeIntervals) > 0 {
					intervalName = cpr.MuteTimeIntervals[0]
				}
				if len(cpr.ActiveTimeIntervals) > 0 {
					intervalName = cpr.ActiveTimeIntervals[0]
				}
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

	t.Run("RenameReceiverInNotificationSettings", func(t *testing.T) {
		newName := "new-receiver"

		alwaysTrue := func(p models.Provenance) bool {
			return true
		}

		t.Run("should do nothing if no rules that match the filter", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameReceiverInNotificationSettings(context.Background(), 1, "not-found", timeIntervalName, alwaysTrue, false)
			require.NoError(t, err)
			require.Empty(t, affected)
			require.Empty(t, invalidProvenance)
		})

		t.Run("should do nothing if at least one rule has provenance that is not allowed", func(t *testing.T) {
			calledTimes := 0
			alwaysFalse := func(p models.Provenance) bool {
				calledTimes++
				return false
			}

			affected, invalidProvenance, err := store.RenameReceiverInNotificationSettings(context.Background(), 1, receiverName, newName, alwaysFalse, false)

			expected := make([]models.AlertRuleKey, 0, len(receiveRules))
			for _, rule := range receiveRules {
				expected = append(expected, rule.GetKey())
			}

			require.NoError(t, err)
			require.Empty(t, affected)
			require.ElementsMatch(t, expected, invalidProvenance)
			assert.Equal(t, len(expected), calledTimes)

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:        1,
				ReceiverName: receiverName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(receiveRules))
		})

		t.Run("should do nothing if dry run is set to true", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameReceiverInNotificationSettings(context.Background(), 1, receiverName, newName, alwaysTrue, true)
			require.NoError(t, err)
			require.Empty(t, invalidProvenance)
			assert.Len(t, affected, len(receiveRules))
			expected := getKeyMap(receiveRules)
			for _, key := range affected {
				assert.Contains(t, expected, key)
			}

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:        1,
				ReceiverName: receiverName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(receiveRules))
		})

		t.Run("should update all rules that refer to the old receiver", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameReceiverInNotificationSettings(context.Background(), 1, receiverName, newName, alwaysTrue, false)
			require.NoError(t, err)
			require.Empty(t, invalidProvenance)
			assert.Len(t, affected, len(receiveRules))
			expected := getKeyMap(receiveRules)
			for _, key := range affected {
				assert.Contains(t, expected, key)
			}

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:        1,
				ReceiverName: newName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(expected))
			for _, rule := range actual {
				assert.Contains(t, expected, rule.GetKey())
			}

			actual, err = store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:        1,
				ReceiverName: receiverName,
			})
			require.NoError(t, err)
			require.Empty(t, actual)
		})
	})

	t.Run("RenameTimeIntervalInNotificationSettings", func(t *testing.T) {
		newName := "new-time-interval"

		alwaysTrue := func(p models.Provenance) bool {
			return true
		}

		t.Run("should do nothing if no rules that match the filter", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameTimeIntervalInNotificationSettings(context.Background(), 1, "not-found", timeIntervalName, alwaysTrue, false)
			require.NoError(t, err)
			require.Empty(t, affected)
			require.Empty(t, invalidProvenance)
		})

		t.Run("should do nothing if at least one rule has provenance that is not allowed", func(t *testing.T) {
			calledTimes := 0
			alwaysFalse := func(p models.Provenance) bool {
				calledTimes++
				return false
			}

			affected, invalidProvenance, err := store.RenameTimeIntervalInNotificationSettings(context.Background(), 1, timeIntervalName, newName, alwaysFalse, false)

			expected := make([]models.AlertRuleKey, 0, len(timeIntervalRules))
			for _, rule := range timeIntervalRules {
				expected = append(expected, rule.GetKey())
			}

			require.NoError(t, err)
			require.Empty(t, affected)
			require.ElementsMatch(t, expected, invalidProvenance)
			assert.Equal(t, len(expected), calledTimes)

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:            1,
				TimeIntervalName: timeIntervalName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(timeIntervalRules))
		})

		t.Run("should do nothing if dry run is set to true", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameTimeIntervalInNotificationSettings(context.Background(), 1, timeIntervalName, newName, alwaysTrue, true)
			require.NoError(t, err)
			require.Empty(t, invalidProvenance)
			assert.Len(t, affected, len(timeIntervalRules))
			expected := getKeyMap(timeIntervalRules)
			for _, key := range affected {
				assert.Contains(t, expected, key)
			}

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:            1,
				TimeIntervalName: timeIntervalName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(timeIntervalRules))
		})

		t.Run("should update all rules that refer to the old time interval", func(t *testing.T) {
			affected, invalidProvenance, err := store.RenameTimeIntervalInNotificationSettings(context.Background(), 1, timeIntervalName, newName, alwaysTrue, false)
			require.NoError(t, err)
			require.Empty(t, invalidProvenance)
			assert.Len(t, affected, len(timeIntervalRules))
			expected := getKeyMap(timeIntervalRules)
			for _, key := range affected {
				assert.Contains(t, expected, key)
			}

			actual, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:            1,
				TimeIntervalName: newName,
			})
			require.NoError(t, err)
			assert.Len(t, actual, len(expected))
			for _, rule := range actual {
				assert.Contains(t, expected, rule.GetKey())
			}

			actual, err = store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID:            1,
				TimeIntervalName: timeIntervalName,
			})
			require.NoError(t, err)
			require.Empty(t, actual)
		})
	})
}

func TestIntegrationListContactPointRoutings(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, setting.NewCfg(), featuremgmt.WithFeatures())
	logger := log.New("test-dbstore")
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

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

	_, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(deref))
	require.NoError(t, err)

	result, err := store.ListContactPointRoutings(context.Background(), models.ListContactPointRoutingsQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, result, len(orgRules))
	for _, rule := range rulesWithNotificationsAndReceiver {
		if !assert.Contains(t, result, rule.GetKey()) {
			continue
		}
		assert.EqualValues(t, *rule.ContactPointRouting(), result[rule.GetKey()])
	}

	t.Run("should list notification settings by receiver name", func(t *testing.T) {
		expectedUIDs := map[models.AlertRuleKey]struct{}{}
		for _, rule := range rulesWithNotificationsAndReceiver {
			expectedUIDs[rule.GetKey()] = struct{}{}
		}

		actual, err := store.ListContactPointRoutings(context.Background(), models.ListContactPointRoutingsQuery{
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

		actual, err := store.ListContactPointRoutings(context.Background(), models.ListContactPointRoutingsQuery{
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
		result, err := store.ListContactPointRoutings(context.Background(), models.ListContactPointRoutingsQuery{
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
			cpr := rule.ContactPointRouting()
			if cpr == nil || cpr.Receiver == "" || len(cpr.MuteTimeIntervals) == 0 {
				continue
			}
			if len(expected) > 0 {
				if cpr.Receiver == receiver && slices.Contains(cpr.MuteTimeIntervals, timeInterval) {
					expected = append(expected, rule.GetKey())
				}
			} else {
				receiver = cpr.Receiver
				timeInterval = cpr.MuteTimeIntervals[0]
				expected = append(expected, rule.GetKey())
			}
		}

		actual, err := store.ListContactPointRoutings(context.Background(), models.ListContactPointRoutingsQuery{
			OrgID:            1,
			ReceiverName:     receiver,
			TimeIntervalName: timeInterval,
		})
		require.NoError(t, err)
		require.EqualValuesf(t, expected, slices.Collect(maps.Keys(actual)), "got more rules than expected: %#v", actual)
	})
}

func TestIntegrationGetNamespacesByRuleUID(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)

	rules := models.RuleGen.With(models.RuleMuts.WithOrgID(1), models.RuleMuts.WithRandomRecordingRules()).GenerateMany(5)
	_, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(rules))
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
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	store.FeatureToggles = featuremgmt.WithFeatures()

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

	_, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(append(append(append(misc, group1...), group2...), group3...)))
	require.NoError(t, err)

	t.Run("GetAlertRulesGroupByRuleUID", func(t *testing.T) {
		t.Run("should return rules that belong to only that group", func(t *testing.T) {
			result, err := store.GetAlertRulesGroupByRuleUID(context.Background(), &models.GetAlertRulesGroupByRuleUIDQuery{
				UID:   group1[rand.IntN(len(group1))].UID,
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

// To address issues arising from case-insensitive collations in some databases (e.g., MySQL/MariaDB),
func TestIntegrationListAlertRulesByGroupCaseSensitiveOrdering(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, b)
	store.FeatureToggles = featuremgmt.WithFeatures()

	gen := models.RuleGen.With(models.RuleMuts.WithOrgID(1))

	// Create namespace and base group key
	groupKey := models.GenerateGroupKey(1)

	// Create groups with case-sensitive names: "TEST", "Test", "test"
	groupKeyUpper := groupKey
	groupKeyUpper.RuleGroup = "TEST"

	groupKeyMixed := groupKey
	groupKeyMixed.RuleGroup = "Test"

	groupKeyLower := groupKey
	groupKeyLower.RuleGroup = "test"

	// Generate rules for each group
	groupUpper := gen.With(gen.WithGroupKey(groupKeyUpper)).GenerateMany(2)
	groupMixed := gen.With(gen.WithGroupKey(groupKeyMixed)).GenerateMany(2)
	groupLower := gen.With(gen.WithGroupKey(groupKeyLower)).GenerateMany(2)

	// Insert all rules
	allRules := append(append(groupUpper, groupMixed...), groupLower...)
	_, err := store.InsertAlertRules(context.Background(), &usr, toInsertRules(allRules))
	require.NoError(t, err)

	t.Run("should order groups case-sensitively", func(t *testing.T) {
		result, _, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: 1},
		})
		require.NoError(t, err)
		require.Len(t, result, 6, "should return all 6 rules")

		// Extract group names in order
		var groupOrder []string
		for _, rule := range result {
			if len(groupOrder) == 0 || groupOrder[len(groupOrder)-1] != rule.RuleGroup {
				groupOrder = append(groupOrder, rule.RuleGroup)
			}
		}

		// Verify case-sensitive alphabetical ordering
		expectedOrder := []string{"TEST", "Test", "test"}
		if !slices.Equal(groupOrder, expectedOrder) {
			t.Fatalf("groups are not ordered case-sensitively as expected. got: %v, want: %v", groupOrder, expectedOrder)
		}

		// Verify each group contains the correct rules
		groupRules := make(map[string][]*models.AlertRule)
		for _, rule := range result {
			groupRules[rule.RuleGroup] = append(groupRules[rule.RuleGroup], rule)
		}

		require.Len(t, groupRules["TEST"], 2, "TEST group should have 2 rules")
		require.Len(t, groupRules["Test"], 2, "Test group should have 2 rules")
		require.Len(t, groupRules["test"], 2, "test group should have 2 rules")
	})

	t.Run("should respect group limit with case-sensitive ordering", func(t *testing.T) {
		// Test with limit of 2 groups - should get first 2 groups in case-sensitive order
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: 1},
			Limit:               2,
		})
		require.NoError(t, err)
		require.Len(t, result, 4, "should return 4 rules (2 rules from first 2 groups)")
		require.NotEmpty(t, continueToken, "should have continue token when limit is reached")

		// Extract group names from limited result
		var limitedGroupOrder []string
		for _, rule := range result {
			if len(limitedGroupOrder) == 0 || limitedGroupOrder[len(limitedGroupOrder)-1] != rule.RuleGroup {
				limitedGroupOrder = append(limitedGroupOrder, rule.RuleGroup)
			}
		}

		// Should get first 2 groups in case-sensitive order: "TEST", "Test" or "test", "Test"
		expectedLimitedOrder := []string{"TEST", "Test"}
		alternateExpectedOrder := []string{"test", "Test"}
		matchesDescLexOrder := slices.Equal(limitedGroupOrder, expectedLimitedOrder)
		matchesAscLexOrder := slices.Equal(limitedGroupOrder, alternateExpectedOrder)
		if !matchesDescLexOrder && !matchesAscLexOrder {
			t.Fatalf("limited groups are not ordered case-sensitively as expected. got: %v, want: %v or %v", limitedGroupOrder, expectedLimitedOrder, alternateExpectedOrder)
		}

		// Continue from token to get remaining groups
		remainingResult, nextToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: 1},
			ContinueToken:       continueToken,
		})
		require.NoError(t, err)
		require.Len(t, remainingResult, 2, "should return 2 rules from remaining group")
		require.Empty(t, nextToken, "should not have continue token when all groups are fetched")

		lastGroup := "test"
		if matchesAscLexOrder {
			lastGroup = "TEST"
		}

		// Verify the remaining group is "test"
		for _, rule := range remainingResult {
			require.Equal(t, lastGroup, rule.RuleGroup, "remaining group should be 'test'")
		}
	})

	t.Run("should handle group limit of 1 correctly", func(t *testing.T) {
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: 1},
			Limit:               1,
		})
		require.NoError(t, err)
		require.Len(t, result, 2, "should return 2 rules from first group")
		require.NotEmpty(t, continueToken, "should have continue token")

		// Should only get the first group which can be "TEST" or "test" depending on charset
		expectedGroup := "TEST"
		if result[0].RuleGroup == "test" {
			expectedGroup = "test"
		}

		for _, rule := range result {
			require.Equal(t, expectedGroup, rule.RuleGroup, "all rules should be from the first group")
		}
	})
}

func TestIntegrationIncreaseVersionForAllRulesInNamespaces(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
	orgID := int64(1)
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval)).With(gen.WithOrgID(orgID))

	alertRules := make([]*models.AlertRule, 0, 5)
	for i := 0; i < 5; i++ {
		alertRules = append(alertRules, createRule(t, store, gen))
	}
	alertRuleNamespaceUIDs := make([]string, 0, len(alertRules))
	for _, rule := range alertRules {
		alertRuleNamespaceUIDs = append(alertRuleNamespaceUIDs, rule.NamespaceUID)
	}
	alertRuleInAnotherNamespace := createRule(t, store, gen)

	requireAlertRuleVersion := func(t *testing.T, ruleID int64, orgID int64, expectedVersion int64) {
		t.Helper()
		dbrule := &alertRule{}
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			exist, err := sess.Table(alertRule{}).ID(ruleID).Get(dbrule)
			require.Truef(t, exist, fmt.Sprintf("rule with ID %d does not exist", ruleID))
			return err
		})
		require.NoError(t, err)
		require.Equal(t, expectedVersion, dbrule.Version)
	}

	t.Run("should increase version for all rules", func(t *testing.T) {
		_, err := store.IncreaseVersionForAllRulesInNamespaces(context.Background(), orgID, alertRuleNamespaceUIDs)
		require.NoError(t, err)

		for _, rule := range alertRules {
			requireAlertRuleVersion(t, rule.ID, orgID, rule.Version+1)
		}

		// this rule's version should not be changed
		requireAlertRuleVersion(t, alertRuleInAnotherNamespace.ID, orgID, alertRuleInAnotherNamespace.Version)
	})
}

func TestIntegrationGetRuleVersions(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
	orgID := int64(1)
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithOrgID(orgID), gen.WithVersion(1))

	inserted, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, []models.InsertRule{{AlertRule: gen.Generate()}})
	require.NoError(t, err)
	ruleV1, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: inserted[0].UID})
	require.NoError(t, err)
	ruleV2 := models.CopyRule(ruleV1, gen.WithTitle(util.GenerateShortUID()), gen.WithGroupIndex(rand.Int()))

	err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{
		{
			Existing: ruleV1,
			New:      *ruleV2,
		},
	})
	require.NoError(t, err)

	t.Run("should return rule versions sorted in decreasing order", func(t *testing.T) {
		versions, err := store.GetAlertRuleVersions(context.Background(), ruleV2.OrgID, ruleV2.GUID)
		require.NoError(t, err)
		assert.Len(t, versions, 2)
		assert.IsDecreasing(t, versions[0].ID, versions[1].ID)
		diff := versions[1].Diff(&versions[0].AlertRule, AlertRuleFieldsToIgnoreInDiff[:]...)
		assert.ElementsMatch(t, []string{"Title", "RuleGroupIndex"}, diff.Paths())
	})

	t.Run("should not remove versions without diff", func(t *testing.T) {
		for i := 0; i < rand.IntN(2)+1; i++ {
			r, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: ruleV2.UID})
			require.NoError(t, err)
			rn := models.CopyRule(r)
			err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{
				{
					Existing: r,
					New:      *rn,
				},
			})
			require.NoError(t, err)
		}
		ruleV2, err = store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: ruleV2.UID})
		ruleV3 := models.CopyRule(ruleV2, gen.WithGroupName(util.GenerateShortUID()), gen.WithNamespaceUID(util.GenerateShortUID()))

		err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{
			{
				Existing: ruleV2,
				New:      *ruleV3,
			},
		})

		versions, err := store.GetAlertRuleVersions(context.Background(), ruleV3.OrgID, ruleV3.GUID)
		require.NoError(t, err)
		assert.Len(t, versions, 3)
		diff := versions[0].Diff(&versions[1].AlertRule, AlertRuleFieldsToIgnoreInDiff[:]...)
		assert.ElementsMatch(t, []string{"RuleGroup", "NamespaceUID"}, diff.Paths())
	})
}

func TestIntegrationGetAlertRuleVersionFolders(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	// Setup.
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second}
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
	orgID := int64(1)
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithOrgID(orgID), gen.WithVersion(1))

	inserted, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, []models.InsertRule{{AlertRule: gen.Generate()}})
	require.NoError(t, err)
	ruleV1, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: inserted[0].UID})
	require.NoError(t, err)

	oldRule := ruleV1
	updatedRule := ruleV1
	updateRule := func(title string, folderUID string) {
		oldRule = updatedRule
		updatedRule = models.CopyRule(oldRule, gen.WithTitle(title), gen.WithNamespaceUID(folderUID))
		require.NoError(t, store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{{Existing: oldRule, New: *updatedRule}}))
		updatedRule.Version++ // Simulate version increment after update to avoid conflict errors.
	}

	// Update rule a couple of times to create versions.
	originalFolder := oldRule.NamespaceUID
	updateRule(util.GenerateShortUID(), originalFolder)
	updateRule(util.GenerateShortUID(), "newfolder-1")
	updateRule(util.GenerateShortUID(), "newfolder-2")
	updateRule(util.GenerateShortUID(), "newfolder-2")
	updateRule(util.GenerateShortUID(), originalFolder)
	updateRule(util.GenerateShortUID(), "current-folder")

	t.Run("should return rule versions folders sorted in decreasing order", func(t *testing.T) {
		historicalFolders, err := store.GetAlertRuleVersionFolders(context.Background(), updatedRule.OrgID, updatedRule.GUID)
		require.NoError(t, err)
		assert.Equal(t, []string{ // Return folders with more recent first.
			"current-folder",
			originalFolder,
			"newfolder-2",
			"newfolder-1",
		}, historicalFolders)
	})
}

// createAlertRule creates an alert rule in the database and returns it.
// If a generator is not specified, uniqueness of primary key is not guaranteed.
func createRule(tb testing.TB, store *DBstore, generator *models.AlertRuleGenerator) *models.AlertRule {
	tb.Helper()
	if generator == nil {
		generator = models.RuleGen.With(models.RuleMuts.WithIntervalMatching(store.Cfg.BaseInterval))
	}
	rule := generator.GenerateRef()
	converted, err := alertRuleFromModelsAlertRule(*rule)
	require.NoError(tb, err)
	err = store.SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		converted.ID = 0
		_, err := sess.Table(alertRule{}).InsertOne(&converted)
		if err != nil {
			return err
		}
		dbRule := &alertRule{}
		exist, err := sess.Table(alertRule{}).ID(converted.ID).Get(dbRule)
		if err != nil {
			return err
		}
		if !exist {
			return errors.New("cannot read inserted record")
		}
		r, err := alertRuleToModelsAlertRule(*dbRule, &logtest.Fake{})
		rule = &r
		return err
	})
	require.NoError(tb, err)

	return rule
}

func setupFolderService(t testing.TB, sqlStore db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) folder.Service {
	tracer := tracing.InitializeTracerForTest()
	inProcBus := bus.ProvideBus(tracer)
	_, dashboardStore := testutil.SetupDashboardService(t, sqlStore, cfg)

	return testutil.SetupFolderService(t, cfg, sqlStore, dashboardStore, inProcBus, features, &actest.FakeAccessControl{ExpectedEvaluate: true})
}

func TestIntegration_AlertRuleVersionsCleanup(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	usr := models.UserUID("test")
	cfg := setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second,
	}
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, setting.NewCfg(), featuremgmt.WithFeatures())
	b := &fakeBus{}

	generator := models.RuleGen
	generator = generator.With(generator.WithIntervalMatching(cfg.BaseInterval), generator.WithUniqueOrgID())

	t.Run("when calling the cleanup with fewer records than the limit all records should stay", func(t *testing.T) {
		cfg := setting.UnifiedAlertingSettings{BaseInterval: cfg.BaseInterval, RuleVersionRecordLimit: 10}
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg, b)

		rule := createRule(t, store, generator)
		firstNewRule := models.CopyRule(rule)
		firstNewRule.Title = util.GenerateShortUID()
		err := store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: rule,
			New:      *firstNewRule,
		},
		})
		require.NoError(t, err)
		firstNewRule.Version = firstNewRule.Version + 1
		secondNewRule := models.CopyRule(firstNewRule)
		secondNewRule.Title = util.GenerateShortUID()
		err = store.UpdateAlertRules(context.Background(), &usr, []models.UpdateRule{{
			Existing: firstNewRule,
			New:      *secondNewRule,
		},
		})
		require.NoError(t, err)
		titleMap := map[string]bool{
			secondNewRule.Title: false,
			rule.Title:          false,
		}

		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			alertRuleVersions := make([]*alertRuleVersion, 0)
			err := sess.Table(alertRuleVersion{}).Desc("id").Where("rule_org_id = ? and rule_uid = ?", rule.OrgID, rule.UID).Find(&alertRuleVersions)
			if err != nil {
				return err
			}
			require.NoError(t, err)
			assert.Len(t, alertRuleVersions, 2)
			for _, value := range alertRuleVersions {
				assert.False(t, titleMap[value.Title])
				titleMap[value.Title] = true
			}
			assert.Equal(t, true, titleMap[firstNewRule.Title])
			assert.Equal(t, true, titleMap[secondNewRule.Title])
			return err
		})
		require.NoError(t, err)
	})

	t.Run("only oldest records surpassing the limit should be deleted", func(t *testing.T) {
		cfg := setting.UnifiedAlertingSettings{BaseInterval: cfg.BaseInterval, RuleVersionRecordLimit: 2}
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg, b)
		rule := createRule(t, store, generator)

		for i := 0; i < 4; i++ {
			r, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: rule.UID})
			require.NoError(t, err)
			rn := models.CopyRule(r)
			rn.Title = util.GenerateShortUID()
			err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{
				{
					Existing: r,
					New:      *rn,
				},
			})
			require.NoError(t, err)
		}

		rule, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: rule.UID})
		require.NoError(t, err)

		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			var alertRuleVersions []*alertRuleVersion
			err := sess.Table(alertRuleVersion{}).Desc("id").Where("rule_org_id = ? and rule_uid = ?", rule.OrgID, rule.UID).Find(&alertRuleVersions)
			if err != nil {
				return err
			}
			require.NoError(t, err)
			assert.Len(t, alertRuleVersions, 2)
			assert.Equal(t, rule.Title, alertRuleVersions[0].Title)
			assert.Equal(t, rule.Version, alertRuleVersions[0].Version)
			return err
		})
		require.NoError(t, err)
	})
}

func TestIntegration_ListAlertRulesByGroup(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)+1) * time.Second,
	}
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	bus := &fakeBus{}
	orgID := int64(1)
	ruleGen := models.RuleGen.With(
		models.RuleMuts.WithIntervalMatching(cfg.UnifiedAlerting.BaseInterval),
		models.RuleMuts.WithOrgID(orgID),
	)
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, bus)

	// set test params
	numFolders := 10
	numRules := 50
	rulesPerGroup := 5
	totalGroups := numRules / rulesPerGroup // 10

	// create rules with different group names
	rules, _ := createManyRules(t,
		store,
		ruleGen,
		numFolders,
		numRules,
		rulesPerGroup,
	)
	// sort rules by folder, then group, then group index
	slices.SortStableFunc(rules, func(a, b *models.AlertRule) int {
		if a.NamespaceUID != b.NamespaceUID {
			return strings.Compare(a.NamespaceUID, b.NamespaceUID)
		}
		if a.RuleGroup != b.RuleGroup {
			return strings.Compare(a.RuleGroup, b.RuleGroup)
		}
		return a.RuleGroupIndex - b.RuleGroupIndex
	})

	t.Run("should return all rules when no limit passed", func(t *testing.T) {
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: orgID},
		})
		require.NoError(t, err)
		require.Len(t, result, 50, "should return all rules when no limit is set")
		require.Empty(t, continueToken, "continue token should be empty when no limit is set")
	})

	t.Run("should return paginated results when group limit is set", func(t *testing.T) {
		// random number from 1 to totalGroups - 1 (to ensure we always receive less than totalGroups)
		groupLimit := rand.Int64N(int64(totalGroups)-1) + 1
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: orgID},
			Limit:               groupLimit,
		})
		require.NoError(t, err)
		expectedRuleCount := groupLimit * int64(rulesPerGroup)
		require.Len(t, result, int(expectedRuleCount), fmt.Sprintf("should return %d rules when group limit is set", expectedRuleCount))
		require.NotEmpty(t, continueToken, "continue token should not be empty when limit is set")
	})

	t.Run("pagination should all for continuation", func(t *testing.T) {
		groupLimit := int64(2) // fixed group limit for this test
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: orgID},
			Limit:               groupLimit,
		})
		require.NoError(t, err)
		require.Len(t, result, int(groupLimit*int64(rulesPerGroup)), "should return rules for the first two groups")
		require.NotEmpty(t, continueToken, "continue token should not be empty")

		for i, rule := range result {
			expected := rules[i].RuleGroup
			actual := rule.RuleGroup
			require.Equal(t, expected, actual, "rules should be ordered by group name")
		}

		resultRules := make([]*models.AlertRule, 0, len(result))
		resultRules = append(resultRules, result...)

		// Continue from previous, fetching the rest of the rules
		result, continueToken, err = store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: orgID},
			ContinueToken:       continueToken,
		})
		require.NoError(t, err)
		resultRules = append(resultRules, result...)
		require.Len(t, resultRules, numRules, "should return all rules when continuing from the last token")
		require.Empty(t, continueToken, "continue token should be empty when all rules are fetched")
		for i, rule := range resultRules {
			expected := rules[i].RuleGroup
			actual := rule.RuleGroup
			require.Equal(t, expected, actual, "rules should be ordered by group name")
		}
	})

	t.Run("SearchTitle filter should be applied across all pages", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService2 := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService2, &logtest.Fake{}, cfg.UnifiedAlerting, &fakeBus{})

		searchTitle := "str"

		// Create rules across multiple groups with some having "str" in title
		// Group 1: 2 rules, one with "str", one without
		// Group 2: 2 rules, none with "str"
		// Group 3: 2 rules, one with "str", one without
		ruleGen := models.RuleGen.With(
			models.RuleMuts.WithIntervalMatching(cfg.UnifiedAlerting.BaseInterval),
			models.RuleMuts.WithOrgID(orgID),
		)

		ns := "test-ns"
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-1"),
			models.RuleMuts.WithTitle("rule-1 with str"),
		))
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-1"),
			models.RuleMuts.WithTitle("rule-2"),
		))
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-2"),
			models.RuleMuts.WithTitle("rule-3"),
		))
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-2"),
			models.RuleMuts.WithTitle("rule-4"),
		))
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-3"),
			models.RuleMuts.WithTitle("rule-5 with str"),
		))
		createRule(t, store, ruleGen.With(
			ruleGen.WithNamespaceUID(ns),
			ruleGen.WithGroupName("group-3"),
			models.RuleMuts.WithTitle("rule-6"),
		))

		// First page: get 1 group with SearchTitle filter
		result, continueToken, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{
				OrgID:       orgID,
				SearchTitle: searchTitle,
			},
			Limit: 1,
		})
		require.NoError(t, err)
		require.NotEmpty(t, continueToken, "should have more pages")

		// Verify first page only has rules with "str" in title
		require.Len(t, result, 1)
		for _, rule := range result {
			require.Contains(t, strings.ToLower(rule.Title), searchTitle)
			require.Equal(t, "group-1", rule.RuleGroup)
		}

		// Second page
		result2, continueToken2, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
			ListAlertRulesQuery: models.ListAlertRulesQuery{
				OrgID:       orgID,
				SearchTitle: searchTitle,
			},
			Limit:         1,
			ContinueToken: continueToken,
		})
		require.NoError(t, err)

		// Verify second page also only has rules with "str" in title
		require.Len(t, result2, 1)
		for _, rule := range result2 {
			require.Contains(t, strings.ToLower(rule.Title), searchTitle)
			require.Equal(t, "group-3", rule.RuleGroup)
		}

		// After all pages, token should be empty
		require.Empty(t, continueToken2, "should be no more pages")
	})
}

func Benchmark_ListAlertRules(b *testing.B) {
	orgID := int64(1)
	ruleGen := models.RuleGen

	// init
	sqlStore := db.InitTestDB(b)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)) * time.Second,
	}
	folderService := setupFolderService(b, sqlStore, cfg, featuremgmt.WithFeatures())
	bus := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, bus)

	ruleGen = ruleGen.With(
		ruleGen.WithIntervalMatching(cfg.UnifiedAlerting.BaseInterval),
		ruleGen.WithOrgID(orgID),
	)

	// define benchmark parameters
	numFolders := 5
	numRules := 10000
	rulesPerGroup := 100
	assert.Greater(b, numRules, rulesPerGroup, "n must be greater than rulesPerGroup")
	assert.Equal(b, 0, numRules%rulesPerGroup, "n % rulesPerGroup must be zero to create equal groups")

	// create rules and folders (5 folders, each with n/rulesPerGroup rules)
	_, _ = createManyRules(b,
		store,
		ruleGen,
		numFolders,    // number of folders
		numRules,      // total number of rules
		rulesPerGroup, // rules per group
	)

	b.Run(fmt.Sprintf("list %d rules unpaginated", numRules), func(b *testing.B) {
		for b.Loop() {
			_, err := store.ListAlertRules(context.Background(), &models.ListAlertRulesQuery{
				OrgID: orgID,
			})
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	for _, groupLimit := range []int{1, 2, 5, 10, 50, 100} {
		b.Run(fmt.Sprintf("list %d groups paginated", groupLimit), func(b *testing.B) {
			for b.Loop() {
				_, _, err := store.ListAlertRulesByGroup(context.Background(), &models.ListAlertRulesExtendedQuery{
					ListAlertRulesQuery: models.ListAlertRulesQuery{OrgID: orgID},
					Limit:               int64(groupLimit),
				})
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func TestIntegration_ListAlertRules(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)) * time.Second,
	}
	b := &fakeBus{}
	orgID := int64(1)
	ruleGen := models.RuleGen
	ruleGen = ruleGen.With(
		ruleGen.WithIntervalMatching(cfg.UnifiedAlerting.BaseInterval),
		ruleGen.WithOrgID(orgID),
	)
	t.Run("filter by HasPrometheusRuleDefinition", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		regularRule := createRule(t, store, ruleGen)
		importedRule := createRule(t, store, ruleGen.With(
			models.RuleMuts.WithPrometheusOriginalRuleDefinition("data"),
		))
		tc := []struct {
			name                   string
			importedPrometheusRule *bool
			expectedRules          []*models.AlertRule
		}{
			{
				name:                   "should return only imported prometheus rules when filter is true",
				importedPrometheusRule: util.Pointer(true),
				expectedRules:          []*models.AlertRule{importedRule},
			},
			{
				name:                   "should return only non-imported rules when filter is false",
				importedPrometheusRule: util.Pointer(false),
				expectedRules:          []*models.AlertRule{regularRule},
			},
			{
				name:                   "should return all rules when filter is not set",
				importedPrometheusRule: nil,
				expectedRules:          []*models.AlertRule{regularRule, importedRule},
			},
		}
		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesQuery{
					OrgID:                       orgID,
					HasPrometheusRuleDefinition: tt.importedPrometheusRule,
				}
				result, err := store.ListAlertRules(context.Background(), query)
				require.NoError(t, err)
				require.ElementsMatch(t, tt.expectedRules, result)
			})
		}
	})

	t.Run("filter by DataSourceUIDs", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)

		// Create rules with different data sources.
		const (
			uid1     = "uid-1"
			uid2     = "uid-2"
			uid3     = "uid-3"
			rule1UID = "rule-1"
			rule2UID = "rule-2"
			rule3UID = "rule-3"
			rule4UID = "rule-4"
			rule5UID = "rule-5"
			rule6UID = "rule-6"
		)

		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule1UID), models.RuleGen.WithDataSourceUID(uid1)))
		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule2UID), models.RuleMuts.WithDataSourceUID(uid2)))
		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule3UID), models.RuleMuts.WithDataSourceUID(uid3)))
		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule4UID), models.RuleGen.WithDataSourceUID(uid1, uid2)))
		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule5UID), models.RuleMuts.WithDataSourceUID(uid2, uid3)))
		createRule(t, store, ruleGen.With(models.RuleGen.WithUID(rule6UID), models.RuleMuts.WithDataSourceUID(uid1, uid2, uid3)))

		tc := []struct {
			name         string
			dsUIDs       []string
			expectedUIDs []string
		}{
			{
				name:         "searching for uid-1 returns rules using it",
				dsUIDs:       []string{uid1},
				expectedUIDs: []string{rule1UID, rule4UID, rule6UID},
			},
			{
				name:         "searching for uid-1 and uid-2 returns rules using them",
				dsUIDs:       []string{uid1, uid2},
				expectedUIDs: []string{rule1UID, rule2UID, rule4UID, rule5UID, rule6UID},
			},
			{
				name:         "searching for uid-1, uid-2, and uid-3 returns all rules",
				dsUIDs:       []string{uid1, uid2, uid3},
				expectedUIDs: []string{rule1UID, rule2UID, rule3UID, rule4UID, rule5UID, rule6UID},
			},
			{
				name:   "searching for a non-existing UID returns no rules",
				dsUIDs: []string{"non-existing"},
			},
			{
				name:         "searching for uid-1 and a non-existing UID returns the rules using uid-1",
				dsUIDs:       []string{"non-existing", uid1},
				expectedUIDs: []string{rule1UID, rule4UID, rule6UID},
			},
			{
				name:         "no data source filter should return all rules",
				expectedUIDs: []string{rule1UID, rule2UID, rule3UID, rule4UID, rule5UID, rule6UID},
			},
		}

		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesQuery{
					OrgID:          orgID,
					DataSourceUIDs: tt.dsUIDs,
				}
				result, err := store.ListAlertRules(context.Background(), query)
				require.NoError(t, err)

				got := make([]string, 0, len(result))
				for _, r := range result {
					got = append(got, r.UID)
				}
				require.ElementsMatch(t, tt.expectedUIDs, got)
			})
		}
	})

	t.Run("filter by SearchTitle", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		rule1 := createRule(t, store, ruleGen.With(models.RuleMuts.WithTitle("CPU Usage Alert")))
		rule2 := createRule(t, store, ruleGen.With(models.RuleMuts.WithTitle("Memory Usage Alert")))
		rule3 := createRule(t, store, ruleGen.With(models.RuleMuts.WithTitle("Disk Space Alert")))
		rule4 := createRule(t, store, ruleGen.With(models.RuleMuts.WithTitle("Application Error Rate")))

		tc := []struct {
			name          string
			titleSearch   string
			expectedRules []*models.AlertRule
		}{
			{
				name:          "should find rules",
				titleSearch:   "alert",
				expectedRules: []*models.AlertRule{rule1, rule2, rule3},
			},
			{
				name:          "should find rule with partial match",
				titleSearch:   "aPpl",
				expectedRules: []*models.AlertRule{rule4},
			},
			{
				name:          "should return no rules when no match",
				titleSearch:   "nonexistent",
				expectedRules: []*models.AlertRule{},
			},
			{
				name:          "should return all rules when empty",
				titleSearch:   "",
				expectedRules: []*models.AlertRule{rule1, rule2, rule3, rule4},
			},
			{
				name:          "should not find rules when word order is reversed",
				titleSearch:   "usage cpu",
				expectedRules: []*models.AlertRule{},
			},
			{
				name:          "should find multiple rules matching sequential words",
				titleSearch:   "usage alert",
				expectedRules: []*models.AlertRule{rule1, rule2},
			},
			{
				name:          "should handle extra whitespace between words",
				titleSearch:   "  cpu   usage  ",
				expectedRules: []*models.AlertRule{rule1},
			},
			{
				name:          "should handle multiple words with partial matches",
				titleSearch:   "aPp erR",
				expectedRules: []*models.AlertRule{rule4},
			},
		}

		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesQuery{
					OrgID:       orgID,
					SearchTitle: tt.titleSearch,
				}
				result, err := store.ListAlertRules(context.Background(), query)
				require.NoError(t, err)
				require.ElementsMatch(t, tt.expectedRules, result)
			})
		}
	})

	t.Run("filter by SearchRuleGroup", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		rule1 := createRule(t, store, ruleGen.With(models.RuleMuts.WithGroupName("database-alerts")))
		rule2 := createRule(t, store, ruleGen.With(models.RuleMuts.WithGroupName("application-alerts")))
		rule3 := createRule(t, store, ruleGen.With(models.RuleMuts.WithGroupName("network-alerts")))
		rule4 := createRule(t, store, ruleGen.With(models.RuleMuts.WithGroupName("critical-monitoring")))

		tc := []struct {
			name          string
			groupSearch   string
			expectedRules []*models.AlertRule
		}{
			{
				name:          "should find rules",
				groupSearch:   "alerts",
				expectedRules: []*models.AlertRule{rule1, rule2, rule3},
			},
			{
				name:          "should find rule with partial match",
				groupSearch:   "mOnItOrInG",
				expectedRules: []*models.AlertRule{rule4},
			},
			{
				name:          "should return no rules when no match",
				groupSearch:   "nonexistent",
				expectedRules: []*models.AlertRule{},
			},
			{
				name:          "should return all rules when empty",
				groupSearch:   "",
				expectedRules: []*models.AlertRule{rule1, rule2, rule3, rule4},
			},
			{
				name:          "should not find rules when word order is reversed",
				groupSearch:   "alerts database",
				expectedRules: []*models.AlertRule{},
			},
			{
				name:          "should find multiple rules matching sequential words",
				groupSearch:   "database alert",
				expectedRules: []*models.AlertRule{rule1},
			},
			{
				name:          "should handle extra whitespace between words",
				groupSearch:   "  network   alerts  ",
				expectedRules: []*models.AlertRule{rule3},
			},
			{
				name:          "should handle multiple words with partial matches",
				groupSearch:   "crit mon",
				expectedRules: []*models.AlertRule{rule4},
			},
		}

		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesQuery{
					OrgID:           orgID,
					SearchRuleGroup: tt.groupSearch,
				}
				result, err := store.ListAlertRules(context.Background(), query)
				require.NoError(t, err)
				require.ElementsMatch(t, tt.expectedRules, result)
			})
		}
	})

	t.Run("filter by LabelMatchers", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)

		ruleLower := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"team": "alerting", "severity": "warning"}),
			ruleGen.WithTitle("rule_lowercase")))
		ruleUpper := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"team": "Alerting", "severity": "critical"}),
			ruleGen.WithTitle("rule_uppercase")))
		ruleSpecial := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"key": `value"with"quotes`}),
			ruleGen.WithTitle("rule_special")))
		ruleGlob := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"glob": "*[?]"}),
			ruleGen.WithTitle("rule_glob")))
		ruleSpecialChars := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"label-with-hyphen": "line1\nline2\\end\"quote"}),
			ruleGen.WithTitle("rule_special_chars")))
		ruleEmpty := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"empty": ""}),
			ruleGen.WithTitle("rule_empty")))
		ruleNonempty := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{"empty": "nonempty"}),
			ruleGen.WithTitle("rule_nonempty")))
		// include a rule with no labels at all,
		// to ensure we handle that case correctly.
		// JSON functions need to be able to handle null and empty string values.
		ruleNoLabels := createRule(t, store, ruleGen.With(
			ruleGen.WithLabels(map[string]string{}),
			ruleGen.WithTitle("rule_no_labels")))

		tc := []struct {
			name          string
			labelMatchers labels.Matchers
			expectedRules []*models.AlertRule
		}{
			{
				name: "equality matcher is case-sensitive",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "team", "alerting"); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleLower},
			},
			{
				name: "equality matcher matches uppercase when specified",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "team", "Alerting"); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleUpper},
			},
			{
				name: "inequality matcher is case-sensitive",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchNotEqual, "team", "alerting"); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleUpper, ruleSpecial, ruleGlob, ruleSpecialChars, ruleEmpty, ruleNonempty, ruleNoLabels},
			},
			{
				name: "special characters in labels are handled correctly",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher {
						m, _ := labels.NewMatcher(labels.MatchEqual, "key", `value"with"quotes`)
						return m
					}(),
				},
				expectedRules: []*models.AlertRule{ruleSpecial},
			},
			{
				name: "matcher with non-existent label returns no rules",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "nonexistent", "value"); return m }(),
				},
				expectedRules: []*models.AlertRule{},
			},
			{
				name: "multiple matchers are ANDed",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "team", "Alerting"); return m }(),
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "severity", "critical"); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleUpper},
			},
			{
				name: "GLOB special characters are escaped correctly",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "glob", "*[?]"); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleGlob},
			},
			{
				name: "JSON escape characters are handled correctly",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher {
						m, _ := labels.NewMatcher(labels.MatchEqual, "label-with-hyphen", "line1\nline2\\end\"quote")
						return m
					}(),
				},
				expectedRules: []*models.AlertRule{ruleSpecialChars},
			},
			{
				name: "empty string value matches correctly",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchEqual, "empty", ""); return m }(),
				},
				expectedRules: []*models.AlertRule{ruleLower, ruleUpper, ruleSpecial, ruleGlob, ruleSpecialChars, ruleEmpty, ruleNoLabels},
			},
			{
				name: "inequality matcher on non-existent label matches all rules",
				labelMatchers: labels.Matchers{
					func() *labels.Matcher {
						m, _ := labels.NewMatcher(labels.MatchNotEqual, "nonexistent", "value")
						return m
					}(),
				},
				expectedRules: []*models.AlertRule{ruleLower, ruleUpper, ruleSpecial, ruleGlob, ruleSpecialChars, ruleEmpty, ruleNonempty, ruleNoLabels},
			},
		}

		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesQuery{
					OrgID:         orgID,
					LabelMatchers: tt.labelMatchers,
				}
				result, err := store.ListAlertRules(context.Background(), query)
				require.NoError(t, err)
				require.ElementsMatch(t, tt.expectedRules, result)
			})
		}

		t.Run("regex matcher returns error from store", func(t *testing.T) {
			query := &models.ListAlertRulesQuery{
				OrgID: orgID,
				LabelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchRegexp, "team", "alert.*"); return m }(),
				},
			}
			_, err := store.ListAlertRules(context.Background(), query)
			require.Error(t, err)
			require.ErrorContains(t, err, "is not supported")
		})

		t.Run("not-regex matcher returns error from store", func(t *testing.T) {
			query := &models.ListAlertRulesQuery{
				OrgID: orgID,
				LabelMatchers: labels.Matchers{
					func() *labels.Matcher { m, _ := labels.NewMatcher(labels.MatchNotRegexp, "team", "alert.*"); return m }(),
				},
			}
			_, err := store.ListAlertRules(context.Background(), query)
			require.Error(t, err)
			require.ErrorContains(t, err, "is not supported")
		})
	})

	t.Run("filter by PluginOriginFilter", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		testOrgID := int64(12345)
		testRuleGen := ruleGen.With(models.RuleMuts.WithOrgID(testOrgID))

		regularRule := createRule(t, store, testRuleGen)
		pluginRule := createRule(t, store, testRuleGen.With(
			models.RuleMuts.WithLabel(models.PluginGrafanaOriginLabel, "plugin/grafana-slo-app"),
		))

		tc := []struct {
			name          string
			filter        models.PluginOriginFilter
			expectedRules []*models.AlertRule
		}{
			{
				name:          "should return all rules when PluginOriginFilterNone",
				filter:        models.PluginOriginFilterNone,
				expectedRules: []*models.AlertRule{regularRule, pluginRule},
			},
			{
				name:          "should filter out plugin rules when PluginOriginFilterHide",
				filter:        models.PluginOriginFilterHide,
				expectedRules: []*models.AlertRule{regularRule},
			},
			{
				name:          "should return only plugin rules when PluginOriginFilterOnly",
				filter:        models.PluginOriginFilterOnly,
				expectedRules: []*models.AlertRule{pluginRule},
			},
		}
		for _, tt := range tc {
			t.Run(tt.name, func(t *testing.T) {
				query := &models.ListAlertRulesExtendedQuery{
					ListAlertRulesQuery: models.ListAlertRulesQuery{
						OrgID: testOrgID,
					},
					PluginOriginFilter: tt.filter,
				}
				result, _, err := store.ListAlertRulesByGroup(context.Background(), query)
				require.NoError(t, err)
				require.ElementsMatch(t, tt.expectedRules, result)
			})
		}
	})
}

func TestIntegration_ListAlertRulesPaginated(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: time.Duration(rand.Int64N(100)) * time.Second,
	}
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	orgID := int64(1)
	ruleGen := models.RuleGen
	ruleGen = ruleGen.With(
		ruleGen.WithIntervalMatching(cfg.UnifiedAlerting.BaseInterval),
		ruleGen.WithOrgID(orgID),
	)
	t.Run("filter by RuleType", func(t *testing.T) {
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		alertingGen := ruleGen
		recordingGen := ruleGen.With(models.RuleMuts.WithAllRecordingRules(), models.RuleMuts.WithMetric("metric1"), models.RuleMuts.WithRecordFrom("A"))

		alertingRules := []*models.AlertRule{
			createRule(t, store, alertingGen),
			createRule(t, store, alertingGen),
		}
		recordingRules := []*models.AlertRule{
			createRule(t, store, recordingGen),
			createRule(t, store, recordingGen),
		}

		t.Run("should return only alerting rules", func(t *testing.T) {
			query := &models.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: models.ListAlertRulesQuery{
					OrgID: orgID,
				},
				RuleType: models.RuleTypeFilterAlerting,
			}
			result, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Empty(t, continueToken, "continue token should be empty when no pagination is applied")
			require.NotEmpty(t, result)
			for _, rule := range result {
				require.Equal(t, models.RuleTypeAlerting, rule.Type())
			}
		})

		t.Run("should return only recording rules", func(t *testing.T) {
			query := &models.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: models.ListAlertRulesQuery{
					OrgID: orgID,
				},
				RuleType: models.RuleTypeFilterRecording,
			}
			result, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Empty(t, continueToken, "continue token should be empty when no pagination is applied")
			require.NotEmpty(t, result)
			for _, rule := range result {
				require.Equal(t, models.RuleTypeRecording, rule.Type())
			}
		})

		t.Run("should return both alerting and recording rules when RuleType is not set", func(t *testing.T) {
			query := &models.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: models.ListAlertRulesQuery{
					OrgID: orgID,
				},
			}
			result, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Empty(t, continueToken, "continue token should be empty when no pagination is applied")
			require.NotEmpty(t, result)
			var alertingCount, recordingCount int
			for _, rule := range result {
				switch rule.Type() {
				case models.RuleTypeAlerting:
					alertingCount++
				case models.RuleTypeRecording:
					recordingCount++
				}
			}
			require.GreaterOrEqual(t, alertingCount, len(alertingRules))
			require.GreaterOrEqual(t, recordingCount, len(recordingRules))
		})
		t.Run("should return both alerting and recording rules when RuleType is all", func(t *testing.T) {
			query := &models.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: models.ListAlertRulesQuery{
					OrgID: orgID,
				},
				RuleType: models.RuleTypeFilterAll,
			}
			result, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Empty(t, continueToken, "continue token should be empty when no pagination is applied")
			require.NotEmpty(t, result)
			var alertingCount, recordingCount int
			for _, rule := range result {
				switch rule.Type() {
				case models.RuleTypeAlerting:
					alertingCount++
				case models.RuleTypeRecording:
					recordingCount++
				}
			}
			require.GreaterOrEqual(t, alertingCount, len(alertingRules))
			require.GreaterOrEqual(t, recordingCount, len(recordingRules))
		})
	})
	t.Run("list rules with pagination", func(t *testing.T) {
		store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
		alertingGen := ruleGen.With(ruleGen.WithNamespaceUID("paginate-test"))
		for i := 0; i < 10; i++ {
			createRule(t, store, alertingGen)
		}
		t.Run("should return paginated results", func(t *testing.T) {
			query := &models.ListAlertRulesExtendedQuery{
				ListAlertRulesQuery: models.ListAlertRulesQuery{
					OrgID:         orgID,
					NamespaceUIDs: []string{"paginate-test"},
				},
				Limit: 5, // set page size to 5
			}
			result, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Len(t, result, 5, "should return 5 rules as per page size")
			require.NotEmpty(t, continueToken, "continue token should not be empty for paginated results")

			// continue with the next page
			query.ContinueToken = continueToken
			result2, continueToken, err := store.ListAlertRulesPaginated(context.Background(), query)
			require.NoError(t, err)
			require.Len(t, result2, 5, "should return next 5 rules")
			require.Empty(t, continueToken, "continue token should be empty when all rules are fetched")

			require.NotElementsMatch(t, result, result2, "should not have same rules in both pages")
		})
	})
}

func TestIntegration_ListDeletedRules(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval:           1 * time.Second,
		RuleVersionRecordLimit: -1,
		DeletedRuleRetention:   10 * time.Hour,
	}
	sqlStore := db.InitTestDB(t)
	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	b := &fakeBus{}
	store := createTestStore(sqlStore, folderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)
	store.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore)

	oldT := TimeNow
	t.Cleanup(func() {
		TimeNow = oldT
	})
	clk := clock.NewMock()
	TimeNow = func() time.Time {
		return clk.Now()
	}

	orgID := int64(1)
	gen := models.RuleGen
	gen = gen.With(gen.WithIntervalMatching(store.Cfg.BaseInterval), gen.WithOrgID(orgID))

	result, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, []models.InsertRule{{AlertRule: gen.Generate()}, {AlertRule: gen.Generate()}})
	require.NoError(t, err)
	rule1, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: result[0].UID})
	require.NoError(t, err)
	rule2, err := store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: result[1].UID})
	require.NoError(t, err)

	clk.Add(1 * time.Hour)
	rule1v2 := models.CopyRule(rule1, gen.WithTitle(util.GenerateShortUID()))
	err = store.UpdateAlertRules(context.Background(), &models.AlertingUserUID, []models.UpdateRule{
		{
			Existing: rule1,
			New:      *rule1v2,
		},
	})
	require.NoError(t, err)
	rule1v2, err = store.GetAlertRuleByUID(context.Background(), &models.GetAlertRuleByUIDQuery{UID: result[0].UID})
	require.NoError(t, err)

	versions, err := store.GetAlertRuleVersions(context.Background(), orgID, rule1.GUID)
	require.NoError(t, err)
	require.Len(t, versions, 2)

	t.Run("should not return if rule is not deleted", func(t *testing.T) {
		list, err := store.ListDeletedRules(context.Background(), orgID)
		require.NoError(t, err)
		require.Empty(t, list)
	})

	// delete the second rule
	clk.Add(1 * time.Hour)
	err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), false, rule2.UID)
	require.NoError(t, err)

	// and the first rule hour later
	clk.Add(1 * time.Hour)
	err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), false, rule1.UID)
	require.NoError(t, err)

	t.Run("should return deleted rules sorted by date desc", func(t *testing.T) {
		list, err := store.ListDeletedRules(context.Background(), orgID)
		require.NoError(t, err)
		require.Len(t, list, 2)
		require.Equal(t, rule1.GUID, list[0].GUID)
		require.Equal(t, rule2.GUID, list[1].GUID)
	})

	t.Run("should return the last deleted rule", func(t *testing.T) {
		list, err := store.ListDeletedRules(context.Background(), orgID)
		require.NoError(t, err)
		assert.Empty(t, list[0].UID)
		assert.Empty(t, rule1v2.Diff(list[0], "ID", "UID", "DashboardUID", "PanelID", "Updated", "UpdatedBy")) // ignore updated because it's not
		assert.Equal(t, list[0].Updated.UTC(), clk.Now().UTC())
		assert.EqualValues(t, list[0].UpdatedBy, util.Pointer(models.UserUID("test")))
	})
}

func TestIntegration_CleanUpDeletedAlertRules(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	oldClk := TimeNow
	t.Cleanup(func() {
		TimeNow = oldClk
	})

	t0 := time.Now().UTC().Truncate(time.Second)
	TimeNow = func() time.Time {
		return t0
	}

	sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{
		Cfg: nil,
	})
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 1 * time.Second
	cfg.UnifiedAlerting.RuleVersionRecordLimit = -1
	cfg.UnifiedAlerting.DeletedRuleRetention = 10 * time.Second

	folderService := setupFolderService(t, sqlStore, cfg, featuremgmt.WithFeatures())
	logger := log.New("test-dbstore")
	store := createTestStore(sqlStore, folderService, logger, cfg.UnifiedAlerting, &fakeBus{})
	store.FeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagAlertRuleRestore)

	gen := models.RuleGen
	orgID := int64(rand.IntN(1000)) + 1

	gen = gen.With(gen.WithOrgID(orgID))

	result, err := store.InsertAlertRules(context.Background(), &models.AlertingUserUID, toInsertRules(gen.GenerateMany(3)))
	uids := make([]string, 0, len(result))
	for _, rule := range result {
		uids = append(uids, rule.UID)
	}
	require.NoError(t, err)

	// simulate rule deletion at different time.
	// t0, t0+10s, t0+20s
	for idx, uid := range uids {
		TimeNow = func() time.Time {
			return t0.Add(time.Duration(idx) * 10 * time.Second)
		}
		err = store.DeleteAlertRulesByUID(context.Background(), orgID, util.Pointer(models.UserUID("test")), false, uid)
		require.NoError(t, err)
	}

	before, err := store.ListDeletedRules(context.Background(), orgID)
	require.NoError(t, err)
	require.Len(t, before, 3)

	// retention is 10s, now=t+20s, therefore, only one row should be deleted
	_, err = store.CleanUpDeletedAlertRules(context.Background())
	require.NoError(t, err)

	after, err := store.ListDeletedRules(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, after, 1)
	for _, rule := range after {
		assert.GreaterOrEqual(t, rule.Updated, TimeNow().Add(-cfg.UnifiedAlerting.DeletedRuleRetention))
	}
}

func createTestStore(
	sqlStore db.DB,
	folderService folder.Service,
	logger log.Logger,
	cfg setting.UnifiedAlertingSettings,
	bus bus.Bus,
) *DBstore {
	return &DBstore{
		SQLStore:       sqlStore,
		FolderService:  folderService,
		Logger:         logger,
		Cfg:            cfg,
		Bus:            bus,
		FeatureToggles: featuremgmt.WithFeatures(),
	}
}

type fakeBus struct {
	publishFn func(ctx context.Context, msg bus.Msg) error
}

func (f *fakeBus) AddEventListener(handler bus.HandlerFunc) {}

func (f *fakeBus) Publish(ctx context.Context, msg bus.Msg) error {
	if f.publishFn != nil {
		return f.publishFn(ctx, msg)
	}

	return nil
}

func createManyRules(tb testing.TB, store *DBstore, ruleGen *models.AlertRuleGenerator, numFolders, numRules, rulesPerGroup int) ([]*models.AlertRule, []string) {
	tb.Helper()

	require.Greater(tb, numRules, 0, "numRules must be greater than 0")
	require.Greater(tb, numFolders, 0, "numFolders must be greater than 0")
	require.Greater(tb, numRules, rulesPerGroup, "numRules must be greater than rulesPerGroup")
	require.Greater(tb, rulesPerGroup, 0, "rulesPerGroup must be greater than 0")
	require.Equal(tb, numRules%rulesPerGroup, 0, "numRules % rulesPerGroup must be zero to create equal groups")

	rules := make([]*models.AlertRule, 0, numRules)
	namespaceUIDs := make([]string, numFolders)
	for i := range namespaceUIDs {
		namespaceUIDs[i] = fmt.Sprintf("ns-%d", i)
	}
	for i := 0; i < numRules; i++ {
		gen := ruleGen.With(
			ruleGen.WithNamespaceUID(namespaceUIDs[i%numFolders]),
			ruleGen.WithGroupName(fmt.Sprintf("group_%d", i%(numRules/rulesPerGroup))),
		)
		rules = append(rules, createRule(tb, store, gen))
	}
	return rules, namespaceUIDs
}
