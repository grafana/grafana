package libraryelements

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// enableHealFlag turns the heal toggle on, which is what makes the cleanup gate apply.
func enableHealFlag(t *testing.T) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(
		map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagLibraryElementFolderUIDHeal: {
				Key:            featuremgmt.FlagLibraryElementFolderUIDHeal,
				DefaultVariant: "enabled",
				Variants:       map[string]any{"enabled": true, "disabled": false},
			},
		})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

func markHealComplete(t *testing.T, heal *FolderUIDHealService) {
	t.Helper()
	require.NoError(t, heal.kv.Set(context.Background(), kvstore.AllOrganizations,
		healKVNamespace, healKVKeyAllOrgs, healKVDone))
}

func consumerSetup(t *testing.T) (*FolderConsumer, db.DB, *FolderUIDHealService) {
	t.Helper()
	store := db.InitTestDB(t)
	heal := &FolderUIDHealService{store: store, kv: kvstore.NewFakeKVStore(), log: log.New("test")}
	svc := &LibraryElementService{SQLStore: store, log: log.New("test")}
	return ProvideFolderConsumer(svc, heal), store, heal
}

func TestIntegration_FolderConsumer_FoldersInUse(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// The heal ships disabled, so this is the default state: cleanup must not act on library
	// elements until a repair has actually run.
	t.Run("reports nothing until the heal has run", func(t *testing.T) {
		c, store, _ := consumerSetup(t)
		healInsert(t, store, "panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), healOrgID)
		require.NoError(t, err)
		require.Empty(t, uids)
	})

	t.Run("reports folders once the heal has completed a pass", func(t *testing.T) {
		c, store, heal := consumerSetup(t)
		healInsert(t, store, "panel", 2, "f2")
		markHealComplete(t, heal)

		uids, err := c.FoldersInUse(context.Background(), healOrgID)
		require.NoError(t, err)
		require.Equal(t, []string{"f2"}, uids)
	})

	// An org created after the pass runs on code that keeps folder_uid in sync, so it has no
	// drift to repair and must not stay gated waiting for a per-org marker it will never get.
	t.Run("reports folders for an org created after the heal pass", func(t *testing.T) {
		c, store, heal := consumerSetup(t)
		markHealComplete(t, heal)

		const newOrgID = int64(42)
		healInsertOrg(t, store, newOrgID, "new-org-panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), newOrgID)
		require.NoError(t, err)
		require.Equal(t, []string{"f2"}, uids)
	})

	// Completion gates cleanup, not the toggle: enabling the heal is not the same as it
	// having finished.
	t.Run("stays gated when the heal is enabled but has not run", func(t *testing.T) {
		enableHealFlag(t)
		c, store, _ := consumerSetup(t)
		healInsert(t, store, "panel", 2, "f2")

		uids, err := c.FoldersInUse(context.Background(), healOrgID)
		require.NoError(t, err)
		require.Empty(t, uids)
	})
}
