package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_UpdateFolderFullpathsForFolders(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting = setting.UnifiedAlertingSettings{
		BaseInterval: 1,
	}
	sqlStore := db.InitTestDB(t)
	fakeFolderService := foldertest.NewFakeService()
	b := &fakeBus{}
	store := createTestStore(sqlStore, fakeFolderService, &logtest.Fake{}, cfg.UnifiedAlerting, b)

	orgID := int64(1)
	gen := models.RuleGen.With(
		models.RuleGen.WithOrgID(orgID),
		models.RuleGen.WithIntervalMatching(store.Cfg.BaseInterval),
	)

	ctx := context.Background()

	t.Run("should populate folder_fullpath for rules with NULL fullpath", func(t *testing.T) {
		// Add parent and child folders to the fake service
		parentFolderUID := "parent-folder-uid"
		childFolderUID := "child-folder-uid"

		fakeFolderService.AddFolder(&folder.Folder{
			UID:      parentFolderUID,
			Title:    "Parent Folder",
			OrgID:    orgID,
			Fullpath: "Parent Folder",
		})

		fakeFolderService.AddFolder(&folder.Folder{
			UID:       childFolderUID,
			Title:     "Child Folder",
			OrgID:     orgID,
			ParentUID: parentFolderUID,
			Fullpath:  "Parent Folder/Child Folder",
		})

		// Create alert rule in child folder using createRule helper
		// This bypasses the automatic fullpath population in InsertAlertRules
		ruleGen := gen.With(models.RuleGen.WithNamespaceUID(childFolderUID))
		rule := createRule(t, store, ruleGen)

		// Manually clear the folder_fullpath to simulate pre-migration state
		err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = NULL WHERE uid = ?", rule.UID)
			return err
		})
		require.NoError(t, err)

		// Run the backfill for the child folder
		err = store.UpdateFolderFullpathsForFolders(ctx, orgID, []string{childFolderUID})
		require.NoError(t, err)

		// Verify folder_fullpath is now populated
		var fullpath string
		err = sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.SQL("SELECT folder_fullpath FROM alert_rule WHERE uid = ?", rule.UID).Get(&fullpath)
			return err
		})
		require.NoError(t, err)
		require.NotEmpty(t, fullpath, "folder_fullpath should be populated after backfill")
		assert.Equal(t, "Parent Folder/Child Folder", fullpath, "folder_fullpath should match the nested folder structure")
	})

	t.Run("should handle multiple folders in a single call", func(t *testing.T) {
		// Add two folders to the fake service
		folder1UID := "folder-one-uid"
		folder2UID := "folder-two-uid"

		fakeFolderService.AddFolder(&folder.Folder{
			UID:      folder1UID,
			Title:    "Folder One",
			OrgID:    orgID,
			Fullpath: "Folder One",
		})

		fakeFolderService.AddFolder(&folder.Folder{
			UID:      folder2UID,
			Title:    "Folder Two",
			OrgID:    orgID,
			Fullpath: "Folder Two",
		})

		// Create rules in both folders
		rule1Gen := gen.With(models.RuleGen.WithNamespaceUID(folder1UID))
		rule1 := createRule(t, store, rule1Gen)

		rule2Gen := gen.With(models.RuleGen.WithNamespaceUID(folder2UID))
		rule2 := createRule(t, store, rule2Gen)

		// Clear folder_fullpath for both rules
		err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = NULL WHERE uid IN (?, ?)", rule1.UID, rule2.UID)
			return err
		})
		require.NoError(t, err)

		// Run backfill for both folders at once
		err = store.UpdateFolderFullpathsForFolders(ctx, orgID, []string{folder1UID, folder2UID})
		require.NoError(t, err)

		// Verify both rules have correct fullpaths
		var fullpath1, fullpath2 string
		err = sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.SQL("SELECT folder_fullpath FROM alert_rule WHERE uid = ?", rule1.UID).Get(&fullpath1)
			if err != nil {
				return err
			}
			_, err = sess.SQL("SELECT folder_fullpath FROM alert_rule WHERE uid = ?", rule2.UID).Get(&fullpath2)
			return err
		})
		require.NoError(t, err)
		require.NotEmpty(t, fullpath1)
		require.NotEmpty(t, fullpath2)
		assert.Equal(t, "Folder One", fullpath1)
		assert.Equal(t, "Folder Two", fullpath2)
	})

	t.Run("should skip folders that don't exist", func(t *testing.T) {
		// Add a folder to the fake service
		folder3UID := "folder-three-uid"

		fakeFolderService.AddFolder(&folder.Folder{
			UID:      folder3UID,
			Title:    "Folder Three",
			OrgID:    orgID,
			Fullpath: "Folder Three",
		})

		rule3Gen := gen.With(models.RuleGen.WithNamespaceUID(folder3UID))
		rule3 := createRule(t, store, rule3Gen)

		// Clear folder_fullpath
		err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE alert_rule SET folder_fullpath = NULL WHERE uid = ?", rule3.UID)
			return err
		})
		require.NoError(t, err)

		// Try to backfill with both existing and non-existing folders
		err = store.UpdateFolderFullpathsForFolders(ctx, orgID, []string{folder3UID, "non-existent-folder-uid"})
		require.NoError(t, err, "should not error on non-existent folders")

		// Verify the existing folder's rule was updated
		var fullpath3 string
		err = sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.SQL("SELECT folder_fullpath FROM alert_rule WHERE uid = ?", rule3.UID).Get(&fullpath3)
			return err
		})
		require.NoError(t, err)
		require.NotEmpty(t, fullpath3)
		assert.Equal(t, "Folder Three", fullpath3)
	})

	t.Run("should do nothing when folder UIDs list is empty", func(t *testing.T) {
		err := store.UpdateFolderFullpathsForFolders(ctx, orgID, []string{})
		require.NoError(t, err)
	})
}
