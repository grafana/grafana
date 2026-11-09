package rulesync

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// memNamespaceStore is a stateful folder store. Folders created by title get the
// deterministic UID, a missing UID reads as folder.ErrAccessDenied, and folders
// can be renamed or deleted.
type memNamespaceStore struct {
	folders map[string]*folder.FolderReference
	// created lists the UIDs of folders created through the store, in order.
	created []string
	// getErr fails every lookup by UID.
	getErr error
}

func newMemNamespaceStore() *memNamespaceStore {
	return &memNamespaceStore{folders: map[string]*folder.FolderReference{}}
}

func (m *memNamespaceStore) add(uid, title, parentUID string) {
	m.folders[uid] = &folder.FolderReference{UID: uid, Title: title, ParentUID: parentUID}
}

func (m *memNamespaceStore) children(uid string) []*folder.FolderReference {
	var out []*folder.FolderReference
	for _, f := range m.folders {
		if f.ParentUID == uid {
			out = append(out, f)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UID < out[j].UID })
	return out
}

func (m *memNamespaceStore) GetNamespaceChildren(_ context.Context, uid string, _ int64, _ identity.Requester) ([]*folder.FolderReference, error) {
	return m.children(uid), nil
}

func (m *memNamespaceStore) GetNamespaceByTitle(_ context.Context, title string, _ int64, _ identity.Requester, parentUID string) (*folder.FolderReference, error) {
	for _, f := range m.children(parentUID) {
		if f.Title == title {
			return f, nil
		}
	}
	return nil, dashboards.ErrFolderNotFound
}

func (m *memNamespaceStore) GetNamespaceByUID(_ context.Context, uid string, _ int64, _ identity.Requester) (*folder.Folder, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	if f, ok := m.folders[uid]; ok {
		return &folder.Folder{UID: f.UID, Title: f.Title, ParentUID: f.ParentUID}, nil
	}
	return nil, folder.ErrAccessDenied
}

func (m *memNamespaceStore) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error) {
	if f, err := m.GetNamespaceByTitle(ctx, title, orgID, user, parentUID); err == nil {
		return f, false, nil
	}
	uid, err := rulestore.AlertingFolderUID(title, parentUID, orgID)
	if err != nil {
		return nil, false, err
	}
	if _, taken := m.folders[uid]; taken {
		return nil, false, fmt.Errorf("folder %q already exists", uid)
	}
	m.add(uid, title, parentUID)
	m.created = append(m.created, uid)
	return m.folders[uid], true, nil
}

func (m *memNamespaceStore) GetOrCreateNamespaceByUID(ctx context.Context, uid, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, bool, error) {
	f, err := m.GetNamespaceByUID(ctx, uid, orgID, user)
	if err == nil {
		return &folder.FolderReference{UID: f.UID, Title: f.Title, ParentUID: f.ParentUID}, false, nil
	}
	if !errors.Is(err, folder.ErrAccessDenied) {
		return nil, false, err
	}
	m.add(uid, title, parentUID)
	m.created = append(m.created, uid)
	return m.folders[uid], true, nil
}

func (m *memNamespaceStore) rootUID(t *testing.T, dsUID string) string {
	t.Helper()
	uid, err := rulestore.AlertingFolderUID(rootFolderTitle(dsUID), "", 1)
	require.NoError(t, err)
	return uid
}

func recordedRootUID(cs *fakeConfigClient) string {
	st := cs.statusFor(1)
	if st == nil || st.ExternalRulerSync == nil || st.ExternalRulerSync.RootFolderUid == nil {
		return ""
	}
	return *st.ExternalRulerSync.RootFolderUid
}

func newRootFolderSyncer(t *testing.T, cs *fakeConfigClient, ns *memNamespaceStore, fetch *fakeFetcher, rs *fakeRuleService) *ExternalRulerSyncer {
	t.Helper()
	s := newTestSyncerWithConfigClient(t, cs, fetch, rs)
	s.namespaceStore = ns
	return s
}

func rootFolderRecordedAndReused(t *testing.T) (*fakeConfigClient, *memNamespaceStore, *fakeFetcher, *fakeRuleService, *ExternalRulerSyncer) {
	t.Helper()
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1")
	ns := newMemNamespaceStore()
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newRootFolderSyncer(t, cs, ns, fetch, rs)
	s.SyncOrg(context.Background(), 1)
	require.Equal(t, ns.rootUID(t, "ds1"), recordedRootUID(cs), "first sync records the root folder it created")
	return cs, ns, fetch, rs, s
}

func TestSyncOrg_RecordsRootFolderUID(t *testing.T) {
	cs, ns, _, rs, _ := rootFolderRecordedAndReused(t)

	require.Len(t, rs.replaced, 1)
	assert.Equal(t, ns.rootUID(t, "ds1"), ns.folders[rs.replaced[0].FolderUID].ParentUID, "the synced namespace lives under the recorded root")
	assert.Len(t, ns.created, 2, "root and namespace folder")
	assert.NotEmpty(t, recordedRootUID(cs))
}

func TestSyncOrg_RenamedRootKeepsSyncingInTheSameFolder(t *testing.T) {
	cs, ns, fetch, rs, s := rootFolderRecordedAndReused(t)
	root := ns.rootUID(t, "ds1")
	ns.folders[root].Title = "Renamed by a user"
	createdBefore := len(ns.created)

	fetch.hash = 2
	fetch.cfg = upstreamGroup("g2", "B")
	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1, "the changed upstream is applied")
	assert.Equal(t, root, ns.folders[rs.replaced[0].FolderUID].ParentUID, "still under the renamed root")
	assert.Len(t, ns.created, createdBefore, "no folder is created for a renamed root")
	assert.Equal(t, root, recordedRootUID(cs))
	st := cs.statusFor(1)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, st.Conditions[0].Status)
}

func TestSyncOrg_RenamedRootWithUnchangedUpstreamIsLeftAlone(t *testing.T) {
	_, ns, _, rs, s := rootFolderRecordedAndReused(t)
	ns.folders[ns.rootUID(t, "ds1")].Title = "Renamed by a user"
	createdBefore := len(ns.created)

	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)

	assert.Nil(t, rs.replaced, "unchanged upstream and an existing root: nothing to apply")
	assert.Len(t, ns.created, createdBefore)
}

func TestSyncOrg_DeletedRootIsRecreatedWithTheSameUID(t *testing.T) {
	cs, ns, _, rs, s := rootFolderRecordedAndReused(t)
	root := ns.rootUID(t, "ds1")
	perms := &recordingFolderPermissions{}
	s.folderPermissions = perms
	for uid := range ns.folders { // the rules go with their folder
		delete(ns.folders, uid)
	}
	ns.created = nil

	rs.replaced = nil
	s.SyncOrg(context.Background(), 1) // upstream hash unchanged

	require.Len(t, rs.replaced, 1, "an unchanged upstream is re-applied once the root folder is gone")
	require.NotEmpty(t, ns.created)
	assert.Equal(t, root, ns.created[0], "recreated under the recorded UID")
	assert.Equal(t, "["+"Alerting Admin] External Ruler Sync (ds1)", ns.folders[root].Title)
	assert.Equal(t, root, recordedRootUID(cs))
	assert.Contains(t, perms.got, root, "the recreated root is restricted to admins again")
}

func TestSyncOrg_RenamedAndThenDeletedRootIsRecreatedWithTheCanonicalTitle(t *testing.T) {
	_, ns, _, rs, s := rootFolderRecordedAndReused(t)
	root := ns.rootUID(t, "ds1")
	ns.folders[root].Title = "Renamed by a user"
	delete(ns.folders, root)
	ns.created = nil

	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	assert.Equal(t, rootFolderTitle("ds1"), ns.folders[root].Title)
}

func TestSyncOrg_RootLookupErrorFailsTheTickWithoutCreating(t *testing.T) {
	boom := errors.New("folder service unavailable")

	t.Run("unchanged upstream", func(t *testing.T) {
		cs, ns, _, rs, s := rootFolderRecordedAndReused(t)
		ns.created = nil
		ns.getErr = boom

		rs.replaced = nil
		s.SyncOrg(context.Background(), 1)

		assert.Nil(t, rs.replaced)
		assert.Empty(t, ns.created, "a lookup error must not look like a deleted folder")
		st := cs.statusFor(1)
		assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, st.Conditions[0].Status)
		assert.Equal(t, ns.rootUID(t, "ds1"), recordedRootUID(cs), "the recorded UID survives the failed tick")
	})

	t.Run("changed upstream", func(t *testing.T) {
		cs, ns, fetch, rs, s := rootFolderRecordedAndReused(t)
		ns.created = nil
		ns.getErr = boom
		fetch.hash = 2

		rs.replaced = nil
		s.SyncOrg(context.Background(), 1)

		assert.Nil(t, rs.replaced)
		assert.Empty(t, ns.created)
		assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, cs.statusFor(1).Conditions[0].Status)
	})
}

func legacyInstance(t *testing.T, withPersistedHash bool) (*fakeConfigClient, *memNamespaceStore, *fakeRuleService, *ExternalRulerSyncer, string) {
	t.Helper()
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1")
	ns := newMemNamespaceStore()
	legacyUID, err := rulestore.AlertingFolderUID(legacyRootFolderTitle("ds1"), "", 1)
	require.NoError(t, err)
	ns.add(legacyUID, legacyRootFolderTitle("ds1"), "")
	ns.add("legacy-ns", "ns1", legacyUID)
	if withPersistedHash {
		cs.setStatus(1, "ds1", "1")
	}
	rs := &fakeRuleService{}
	s := newRootFolderSyncer(t, cs, ns, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
	return cs, ns, rs, s, legacyUID
}

func TestSyncOrg_AdoptsTheLegacyTitledFolderOnce(t *testing.T) {
	cs, ns, rs, s, legacyUID := legacyInstance(t, false)
	perms := &recordingFolderPermissions{}
	s.folderPermissions = perms

	s.SyncOrg(context.Background(), 1)

	assert.Empty(t, ns.created[:min(1, len(ns.created))], "no new root folder")
	assert.Equal(t, legacyUID, recordedRootUID(cs))
	require.Len(t, rs.replaced, 1)
	assert.Equal(t, "legacy-ns", rs.replaced[0].FolderUID, "rules are updated in the existing namespace folder, not copied to a new one")
	assert.Empty(t, perms.got, "an adopted folder keeps its permissions")
	for _, f := range ns.children("") {
		assert.Equal(t, legacyUID, f.UID, "no second root folder exists")
	}
}

func TestSyncOrg_AdoptionRunsEvenWhenTheUpstreamHashIsUnchanged(t *testing.T) {
	cs, ns, rs, s, legacyUID := legacyInstance(t, true)

	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1, "no recorded UID yet: the tick adopts instead of skipping")
	assert.Equal(t, legacyUID, recordedRootUID(cs))
	assert.Len(t, ns.children(""), 1)

	rs.replaced = nil
	s.SyncOrg(context.Background(), 1)
	assert.Nil(t, rs.replaced, "adoption happens once; afterwards the unchanged upstream is skipped")
}

func TestSyncOrg_WipedStatusReadoptsARenamedFolder(t *testing.T) {
	_, ns, fetch, rs, _ := rootFolderRecordedAndReused(t)
	root := ns.rootUID(t, "ds1")
	ns.folders[root].Title = "Renamed by a user"
	createdBefore := len(ns.created)

	cs2 := newFakeConfigClient() // status wiped, spec re-applied
	cs2.setSpec(1, "ds1")
	s2 := newRootFolderSyncer(t, cs2, ns, fetch, rs)
	s2.SyncOrg(context.Background(), 1)

	assert.Len(t, ns.created, createdBefore, "the renamed folder is found by its deterministic UID, so no second folder is created")
	assert.Equal(t, root, recordedRootUID(cs2))
}

func TestSyncOrg_AdoptedFolderWithAnUnrelatedUIDStaysTheRootAfterARename(t *testing.T) {
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1")
	ns := newMemNamespaceStore()
	ns.add("hand-made-uid", rootFolderTitle("ds1"), "")
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newRootFolderSyncer(t, cs, ns, fetch, rs)

	s.SyncOrg(context.Background(), 1)
	require.Equal(t, "hand-made-uid", recordedRootUID(cs))

	ns.folders["hand-made-uid"].Title = "Renamed by a user"
	fetch.hash = 2
	ns.created = nil
	s.SyncOrg(context.Background(), 1)

	assert.Empty(t, ns.created, "only the recorded UID can find this folder after the rename; nothing may be created")
	assert.Equal(t, "hand-made-uid", recordedRootUID(cs))
}

func TestSyncOrg_BothTitledFoldersExistAdoptsTheOneWithMoreNamespaces(t *testing.T) {
	cs, ns, _, s, legacyUID := legacyInstance(t, false)
	newUID := ns.rootUID(t, "ds1")
	ns.add(newUID, rootFolderTitle("ds1"), "")
	ns.add("new-ns-a", "a", newUID)
	ns.add("new-ns-b", "b", newUID)

	s.SyncOrg(context.Background(), 1)

	assert.Equal(t, newUID, recordedRootUID(cs), "two namespace folders beat one")
	assert.Contains(t, ns.folders, legacyUID, "the other folder is left untouched")
}

func TestSyncOrg_BothTitledFoldersTieAdoptsTheLowestUID(t *testing.T) {
	cs, ns, _, s, legacyUID := legacyInstance(t, false)
	newUID := ns.rootUID(t, "ds1")
	ns.add(newUID, rootFolderTitle("ds1"), "")
	ns.add("new-ns", "a", newUID)

	s.SyncOrg(context.Background(), 1)

	want := min(legacyUID, newUID)
	assert.Equal(t, want, recordedRootUID(cs))
}

func TestSyncOrg_AdoptionLookupErrorFailsWithoutCreating(t *testing.T) {
	cs := newFakeConfigClient()
	cs.setSpec(1, "ds1")
	ns := newMemNamespaceStore()
	ns.getErr = errors.New("folder service unavailable")
	rs := &fakeRuleService{}
	s := newRootFolderSyncer(t, cs, ns, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)

	s.SyncOrg(context.Background(), 1)

	assert.Empty(t, ns.created)
	assert.Nil(t, rs.replaced)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, cs.statusFor(1).Conditions[0].Status)
}

func TestSyncOrg_IniPathKeepsTheRootFolderUIDInMemory(t *testing.T) {
	ns := newMemNamespaceStore()
	fetch := &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}
	rs := &fakeRuleService{}
	s := newRootFolderSyncer(t, newFakeConfigClient(), ns, fetch, rs)
	s.settings.ExternalRulerUID = "ds1"

	s.SyncOrg(context.Background(), 1)
	root := ns.rootUID(t, "ds1")
	require.Equal(t, root, s.state[1].rootFolderUID)

	ns.folders[root].Title = "Renamed by a user"
	fetch.hash = 2
	rs.replaced = nil
	createdBefore := len(ns.created)
	s.SyncOrg(context.Background(), 1)

	require.Len(t, rs.replaced, 1)
	assert.Len(t, ns.created, createdBefore, "renamed root keeps syncing on the ini path too")
}

func TestBuildSyncStatus_RootFolderUIDCarriesForwardOnlyForTheSameDatasource(t *testing.T) {
	prev := &alertingrulesv0alpha1.ConfigStatus{}
	*prev = computeSyncStatus(nil, "ds1", originAPI, nil, time.Now(), "h", "root-1")
	require.Equal(t, "root-1", *prev.ExternalRulerSync.RootFolderUid)

	t.Run("a failure keeps it", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, errors.New("boom"), time.Now(), "", "")
		require.NotNil(t, got.ExternalRulerSync.RootFolderUid)
		assert.Equal(t, "root-1", *got.ExternalRulerSync.RootFolderUid)
	})
	t.Run("a success without one keeps it", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, nil, time.Now(), "h2", "")
		assert.Equal(t, "root-1", *got.ExternalRulerSync.RootFolderUid)
	})
	t.Run("a new datasource does not inherit it", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds2", originAPI, errors.New("boom"), time.Now(), "", "")
		assert.Nil(t, got.ExternalRulerSync.RootFolderUid)
	})
	t.Run("a success records the new one", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, nil, time.Now(), "h2", "root-2")
		assert.Equal(t, "root-2", *got.ExternalRulerSync.RootFolderUid)
	})
}

func TestIsManagedFolder_FollowsTheRecordedRootFolder(t *testing.T) {
	ctx := context.Background()

	t.Run("a renamed root and its namespaces stay managed", func(t *testing.T) {
		_, ns, _, rs, s := rootFolderRecordedAndReused(t)
		root := ns.rootUID(t, "ds1")
		ns.folders[root].Title = "Renamed by a user"
		ns.add("someone-elses", "Renamed by a user", "")

		managed, err := s.IsManagedFolder(ctx, 1, root)
		require.NoError(t, err)
		assert.True(t, managed, "the root, found by its UID")
		managed, err = s.IsManagedFolder(ctx, 1, rs.replaced[0].FolderUID)
		require.NoError(t, err)
		assert.True(t, managed, "a namespace folder under it")
		managed, err = s.IsManagedFolder(ctx, 1, "someone-elses")
		require.NoError(t, err)
		assert.False(t, managed, "a user folder that now carries the title the root used to have")
	})

	t.Run("only the recorded UID finds an adopted folder with an unrelated UID once it is renamed", func(t *testing.T) {
		cs := newFakeConfigClient()
		cs.setSpec(1, "ds1")
		ns := newMemNamespaceStore()
		ns.add("hand-made-uid", rootFolderTitle("ds1"), "")
		rs := &fakeRuleService{}
		s := newRootFolderSyncer(t, cs, ns, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
		s.SyncOrg(ctx, 1)
		ns.folders["hand-made-uid"].Title = "Renamed by a user"

		managed, err := s.IsManagedFolder(ctx, 1, rs.replaced[0].FolderUID)
		require.NoError(t, err)
		assert.True(t, managed)
	})

	t.Run("a deleted root manages nothing", func(t *testing.T) {
		_, ns, _, _, s := rootFolderRecordedAndReused(t)
		root := ns.rootUID(t, "ds1")
		delete(ns.folders, root)

		managed, err := s.IsManagedFolder(ctx, 1, root)
		require.NoError(t, err)
		assert.False(t, managed)
	})

	t.Run("a lookup error is returned, not read as unmanaged", func(t *testing.T) {
		_, ns, _, _, s := rootFolderRecordedAndReused(t)
		ns.getErr = errors.New("folder service unavailable")

		_, err := s.IsManagedFolder(ctx, 1, ns.rootUID(t, "ds1"))
		require.Error(t, err)
	})

	t.Run("before a UID is recorded the legacy folder is already gated, without creating anything", func(t *testing.T) {
		_, ns, _, s, legacyUID := legacyInstance(t, false)

		managed, err := s.IsManagedFolder(ctx, 1, legacyUID)
		require.NoError(t, err)
		assert.True(t, managed)
		managed, err = s.IsManagedFolder(ctx, 1, "legacy-ns")
		require.NoError(t, err)
		assert.True(t, managed)
		assert.Empty(t, ns.created)
	})

	t.Run("before a UID is recorded and with no folder, nothing is managed", func(t *testing.T) {
		cs := newFakeConfigClient()
		cs.setSpec(1, "ds1")
		s := newRootFolderSyncer(t, cs, newMemNamespaceStore(), &fakeFetcher{}, &fakeRuleService{})

		managed, err := s.IsManagedFolder(ctx, 1, "anything")
		require.NoError(t, err)
		assert.False(t, managed)
	})

	t.Run("the ini path follows the in-memory UID", func(t *testing.T) {
		ns := newMemNamespaceStore()
		rs := &fakeRuleService{}
		s := newRootFolderSyncer(t, newFakeConfigClient(), ns, &fakeFetcher{cfg: upstreamGroup("g1", "A"), hash: 1}, rs)
		s.settings.ExternalRulerUID = "ds1"
		s.SyncOrg(ctx, 1)
		root := ns.rootUID(t, "ds1")
		ns.folders[root].Title = "Renamed by a user"

		managed, err := s.IsManagedFolder(ctx, 1, rs.replaced[0].FolderUID)
		require.NoError(t, err)
		assert.True(t, managed)
	})
}
