package folderlabelsyncer

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func set(uids ...string) map[string]struct{} {
	s := make(map[string]struct{}, len(uids))
	for _, uid := range uids {
		s[uid] = struct{}{}
	}
	return s
}

func TestDiffFolderKeys(t *testing.T) {
	tests := []struct {
		name      string
		withRules map[string]struct{}
		labeled   map[string]struct{}
		expected  []models.FolderKey
	}{
		{
			name:      "holds rules but unlabelled: needs the label added",
			withRules: set("a"),
			labeled:   set(),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}},
		},
		{
			name:      "labelled but holds no rules: needs the label removed",
			withRules: set(),
			labeled:   set("a"),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}},
		},
		{
			name:      "already agrees: left alone",
			withRules: set("a", "b"),
			labeled:   set("a", "b"),
			expected:  nil,
		},
		{
			name:      "both directions at once, with an agreeing folder excluded",
			withRules: set("a", "b"),
			labeled:   set("b", "c"),
			expected:  []models.FolderKey{{OrgID: 1, UID: "a"}, {OrgID: 1, UID: "c"}},
		},
		{
			name:      "empty org has nothing to do",
			withRules: set(),
			labeled:   set(),
			expected:  nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.ElementsMatch(t, tc.expected, diffFolderKeys(1, tc.withRules, tc.labeled))
		})
	}
}

func TestFullSyncOrg(t *testing.T) {
	t.Run("queues only the folders whose label disagrees", func(t *testing.T) {
		// folder-a holds rules but is unlabelled; folder-c is labelled with none; folder-b agrees.
		store := &fakeSyncerStore{folderUIDs: set("folder-a", "folder-b")}
		folders := &fakeFolderClient{list: []*folderv1.Folder{
			folderWithLabels("folder-b", map[string]string{HasRulesLabel: "true"}),
			folderWithLabels("folder-c", map[string]string{HasRulesLabel: "true"}),
		}}
		s := newTestService(store, folders)

		n, err := s.fullSyncOrg(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, 2, n)
		require.ElementsMatch(t, []models.FolderKey{
			{OrgID: 1, UID: "folder-a"},
			{OrgID: 1, UID: "folder-c"},
		}, s.take())
	})

	t.Run("queues nothing when the org already agrees", func(t *testing.T) {
		store := &fakeSyncerStore{folderUIDs: set("folder-a")}
		folders := &fakeFolderClient{list: []*folderv1.Folder{
			folderWithLabels("folder-a", map[string]string{HasRulesLabel: "true"}),
		}}
		s := newTestService(store, folders)

		n, err := s.fullSyncOrg(context.Background(), 1)
		require.NoError(t, err)
		require.Zero(t, n)
		require.Empty(t, s.take())
	})

	t.Run("selects folders on the has-rules label", func(t *testing.T) {
		folders := &fakeFolderClient{}
		s := newTestService(&fakeSyncerStore{}, folders)

		_, err := s.fullSyncOrg(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, []string{HasRulesLabel + "=true"}, folders.lastFilter)
	})

	t.Run("surfaces errors from either side of the diff", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{folderUIDsErr: errors.New("boom")}, &fakeFolderClient{})
		_, err := s.fullSyncOrg(context.Background(), 1)
		require.ErrorContains(t, err, "list folders with rules")

		s = newTestService(&fakeSyncerStore{}, &fakeFolderClient{listErr: errors.New("boom")})
		_, err = s.fullSyncOrg(context.Background(), 1)
		require.ErrorContains(t, err, "list labeled folders")
	})
}

func TestFullSync(t *testing.T) {
	t.Run("continues past an org that fails", func(t *testing.T) {
		// Every org sees the same rule-holding folder and no labels, so each queues one key. The
		// folder client fails only the first call, so org 1 errors and org 2 must still be processed.
		store := &fakeSyncerStore{orgs: []int64{1, 2}, folderUIDs: set("folder-a")}
		folders := &fakeFolderClient{
			failNamespaces: map[string]struct{}{
				"org-1": {},
			},
		}
		s := newTestService(store, folders)

		require.NoError(t, s.FullSync(context.Background(), map[int64]struct{}{}))
		require.Equal(t, []models.FolderKey{{OrgID: 2, UID: "folder-a"}}, s.take())
	})

	t.Run("surfaces org enumeration failure", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{orgsErr: errors.New("boom")}, &fakeFolderClient{})
		require.ErrorContains(t, s.FullSync(context.Background(), map[int64]struct{}{}), "fetch orgs")
	})

	t.Run("stops when the context is cancelled", func(t *testing.T) {
		store := &fakeSyncerStore{orgs: []int64{1, 2}, folderUIDs: set("folder-a")}
		s := newTestService(store, &fakeFolderClient{})

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		require.ErrorIs(t, s.FullSync(ctx, map[int64]struct{}{}), context.Canceled)
		require.Empty(t, s.take())
	})

	t.Run("skips disabled orgs", func(t *testing.T) {
		store := &fakeSyncerStore{orgs: []int64{1, 2, 3}, folderUIDs: set("folder-a")}
		s := newTestService(store, &fakeFolderClient{})

		require.NoError(t, s.FullSync(context.Background(), map[int64]struct{}{
			3: {},
		}))
		require.ElementsMatch(t, []models.FolderKey{{OrgID: 1, UID: "folder-a"}, {OrgID: 2, UID: "folder-a"}}, s.take())
	})
}
