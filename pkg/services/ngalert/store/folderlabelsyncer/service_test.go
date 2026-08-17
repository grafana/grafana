package folderlabelsyncer

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type fakeSyncerStore struct {
	// counts is consulted per folder UID; missing means zero.
	counts map[string]int64
	err    error
	calls  int

	// folderUIDs is what GetAllFoldersWithRules returns, i.e. the folders holding rules.
	folderUIDs    map[string]struct{}
	folderUIDsErr error

	orgs    []int64
	orgsErr error
}

func (f *fakeSyncerStore) CountInFolders(_ context.Context, _ int64, folderUIDs []string, _ identity.Requester) (int64, error) {
	f.calls++
	if f.err != nil {
		return 0, f.err
	}
	var total int64
	for _, uid := range folderUIDs {
		total += f.counts[uid]
	}
	return total, nil
}

func (f *fakeSyncerStore) GetAllFoldersWithRules(_ context.Context, _ int64) (map[string]struct{}, error) {
	if f.folderUIDsErr != nil {
		return nil, f.folderUIDsErr
	}
	return f.folderUIDs, nil
}

func (f *fakeSyncerStore) FetchOrgIds(_ context.Context) ([]int64, error) {
	if f.orgsErr != nil {
		return nil, f.orgsErr
	}
	return f.orgs, nil
}

type fakeFolderClient struct {
	folders map[string]*folderv1.Folder
	getErr  error

	failNamespaces map[string]struct{}

	patchErr error
	patches  []resource.PatchRequest

	list       []*folderv1.Folder
	listErr    error
	listCalls  int
	lastFilter []string
}

func (f *fakeFolderClient) Get(_ context.Context, id resource.Identifier) (*folderv1.Folder, error) {
	if _, ok := f.failNamespaces[id.Namespace]; ok {
		return nil, errors.New("failure")
	}
	if f.getErr != nil {
		return nil, f.getErr
	}
	folder, ok := f.folders[id.Name]
	if !ok {
		return nil, apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, id.Name)
	}
	return folder, nil
}

func (f *fakeFolderClient) Patch(_ context.Context, id resource.Identifier, req resource.PatchRequest, _ resource.PatchOptions) (*folderv1.Folder, error) {
	if _, ok := f.failNamespaces[id.Namespace]; ok {
		return nil, errors.New("failure")
	}
	if f.patchErr != nil {
		return nil, f.patchErr
	}
	f.patches = append(f.patches, req)
	return nil, nil
}

func (f *fakeFolderClient) ListAll(_ context.Context, ns string, opts resource.ListOptions) (*folderv1.FolderList, error) {
	f.listCalls++
	f.lastFilter = opts.LabelFilters

	if _, ok := f.failNamespaces[ns]; ok {
		return nil, errors.New("failure")
	}

	if f.listErr != nil {
		return nil, f.listErr
	}
	list := &folderv1.FolderList{}
	for _, folder := range f.list {
		list.Items = append(list.Items, *folder)
	}
	return list, nil
}

// newTestService builds a Service with the folder client already injected, bypassing the lazy
// generator that needs a live apiserver.
func newTestService(store syncerStore, folders folderPatcher) *Service {
	return &Service{
		store: store,
		// One namespace per org, so tests can target a single org's folder calls (see
		// fakeFolderClient.failNamespaces).
		namespacer: func(orgID int64) string { return fmt.Sprintf("org-%d", orgID) },
		log:        log.NewNopLogger(),
		// Long enough that no test triggers a tick; Run is only exercised for its startup sync and
		// context-cancellation behavior.
		fullSyncInterval: time.Hour,
		dirty:            make(map[models.FolderKey]struct{}),
		wake:             make(chan struct{}, 1),
		folders:          folders,
	}
}

func folderWithLabels(name string, labels map[string]string) *folderv1.Folder {
	return &folderv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: name, Labels: labels}}
}

func TestMarkDirty(t *testing.T) {
	t.Run("deduplicates keys and skips invalid ones", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})

		s.markDirty([]models.FolderKey{
			{OrgID: 1, UID: "a"},
			{OrgID: 1, UID: "a"}, // duplicate
			{OrgID: 1, UID: ""},  // no UID
			{OrgID: 0, UID: "b"}, // no org
			{OrgID: 2, UID: "a"}, // same UID, different org: distinct key
		})

		require.ElementsMatch(t, []models.FolderKey{
			{OrgID: 1, UID: "a"},
			{OrgID: 2, UID: "a"},
		}, s.take())
	})

	t.Run("does not block when no worker is draining", func(t *testing.T) {
		// The wake channel holds one token and signal() is a non-blocking send. markDirty runs on the
		// goroutine that wrote the rules, so a blocking send here would stall rule writes.
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})

		done := make(chan struct{})
		go func() {
			for i := 0; i < 100; i++ {
				s.markDirty([]models.FolderKey{{OrgID: 1, UID: "a"}})
			}
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatal("markDirty blocked once the wake channel was full")
		}
	})

	t.Run("take empties the set", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "a"}})

		require.Len(t, s.take(), 1)
		require.Empty(t, s.take())
	})
}

func TestHandleRuleChange(t *testing.T) {
	t.Run("ignores events with no folder keys", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})

		require.NoError(t, s.handleRuleChange(context.Background(), &store.RuleChangeEvent{
			RuleKeys: []models.AlertRuleKey{{OrgID: 1, UID: "rule"}},
		}))
		require.Empty(t, s.take())
	})

	t.Run("queues the event's folder keys", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})

		require.NoError(t, s.handleRuleChange(context.Background(), &store.RuleChangeEvent{
			FolderKeys: []models.FolderKey{{OrgID: 1, UID: "a"}, {OrgID: 1, UID: "b"}},
		}))
		require.Len(t, s.take(), 2)
	})
}

func TestPartialSync(t *testing.T) {
	key := models.FolderKey{OrgID: 1, UID: "folder-1"}

	t.Run("adds the label when a folder gains rules", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
			"folder-1": folderWithLabels("folder-1", map[string]string{"unrelated": "keep"}),
		}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Len(t, folders.patches, 1)
		require.Equal(t, []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      hasRulesLabelPath,
			Value:     "true",
		}}, folders.patches[0].Operations)
	})

	t.Run("seeds the whole labels map when the folder has none", func(t *testing.T) {
		// "add" on a sub-path of a missing object fails, so the map has to be created wholesale.
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
			"folder-1": folderWithLabels("folder-1", nil),
		}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 2}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Len(t, folders.patches, 1)
		require.Equal(t, []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/labels",
			Value:     map[string]string{HasRulesLabel: "true"},
		}}, folders.patches[0].Operations)
	})

	t.Run("removes the label when the last rule goes", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
			"folder-1": folderWithLabels("folder-1", map[string]string{HasRulesLabel: "true"}),
		}}
		s := newTestService(&fakeSyncerStore{}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Len(t, folders.patches, 1)
		require.Equal(t, []resource.PatchOperation{{
			Operation: resource.PatchOpRemove,
			Path:      hasRulesLabelPath,
		}}, folders.patches[0].Operations)
	})

	t.Run("does nothing when the label already matches", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			labels map[string]string
			count  int64
		}{
			{"labelled and has rules", map[string]string{HasRulesLabel: "true"}, 3},
			{"unlabelled and has no rules", map[string]string{"unrelated": "x"}, 0},
			{"no labels at all and no rules", nil, 0},
		} {
			t.Run(tc.name, func(t *testing.T) {
				folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
					"folder-1": folderWithLabels("folder-1", tc.labels),
				}}
				s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": tc.count}}, folders)

				require.NoError(t, s.partialSync(context.Background(), key))
				require.Empty(t, folders.patches, "expected no patch when state already matches")
			})
		}
	})

	t.Run("is a no-op when the folder is already deleted", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))
		require.Empty(t, folders.patches)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("counting rules", func(t *testing.T) {
			s := newTestService(&fakeSyncerStore{err: errors.New("boom")}, &fakeFolderClient{})
			require.ErrorContains(t, s.partialSync(context.Background(), key), "count rules in folder")
		})

		t.Run("getting the folder", func(t *testing.T) {
			folders := &fakeFolderClient{getErr: errors.New("boom")}
			s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
			require.ErrorContains(t, s.partialSync(context.Background(), key), "get folder")
		})

		t.Run("patching the folder", func(t *testing.T) {
			folders := &fakeFolderClient{
				folders:  map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
				patchErr: errors.New("boom"),
			}
			s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
			require.ErrorContains(t, s.partialSync(context.Background(), key), "patch folder label")
		})
	})
}

// The label key contains a slash, which RFC6901 requires be escaped as "~1". The app-sdk passes
// /metadata/... paths through verbatim, so getting this wrong sends the apiserver a nested path.
func TestHasRulesLabelPathIsEscaped(t *testing.T) {
	require.Equal(t, "/metadata/labels/alerting.grafana.app~1has-rules", hasRulesLabelPath)
	require.Contains(t, hasRulesLabelPath, "~1")
	require.NotContains(t, strings.TrimPrefix(hasRulesLabelPath, "/metadata/labels/"), "/")
}

func TestDrain(t *testing.T) {
	t.Run("requeues folders that failed to sync", func(t *testing.T) {
		folders := &fakeFolderClient{
			folders:  map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
			patchErr: errors.New("boom"),
		}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		s.drain(context.Background())

		require.Equal(t, []models.FolderKey{{OrgID: 1, UID: "folder-1"}}, s.take(),
			"a failed folder should stay queued for the next wake-up")
	})

	t.Run("clears folders that synced", func(t *testing.T) {
		folders := &fakeFolderClient{
			folders: map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
		}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		s.drain(context.Background())

		require.Empty(t, s.take())
	})

	t.Run("stops early when the context is cancelled", func(t *testing.T) {
		folders := &fakeFolderClient{
			folders: map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
		}
		rules := &fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}
		s := newTestService(rules, folders)
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		s.drain(ctx)

		require.Zero(t, rules.calls, "should not have started syncing")
	})
}

func TestRunStopsOnContextCancellation(t *testing.T) {
	s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	require.NoError(t, s.Run(ctx, nil))
}

func TestFailureMetrics(t *testing.T) {
	// A real registry, so the assertions cover the metric names and labels actually exported.
	newMetered := func(store syncerStore, folders folderPatcher) (*Service, prometheus.Gatherer) {
		reg := prometheus.NewPedanticRegistry()
		s := newTestService(store, folders)
		s.metrics = metrics.NewFolderLabelSyncerMetrics(reg)
		return s, reg
	}

	t.Run("partial sync failures are counted", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			store  syncerStore
			folder folderPatcher
		}{
			{
				name:   "counting rules",
				store:  &fakeSyncerStore{err: errors.New("boom")},
				folder: &fakeFolderClient{},
			},
			{
				name:   "getting the folder",
				store:  &fakeSyncerStore{counts: map[string]int64{"folder-1": 1}},
				folder: &fakeFolderClient{getErr: errors.New("boom")},
			},
			{
				name:  "patching the folder",
				store: &fakeSyncerStore{counts: map[string]int64{"folder-1": 1}},
				folder: &fakeFolderClient{
					folders:  map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
					patchErr: errors.New("boom"),
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				s, reg := newMetered(tc.store, tc.folder)
				s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

				s.drain(context.Background())

				require.Equal(t, float64(1), counterValue(t, reg,
					"grafana_alerting_folder_label_syncer_failures_total",
					map[string]string{"sync_type": metrics.SyncTypePartial}))
			})
		}
	})

	t.Run("a deleted folder is not counted as a failure", func(t *testing.T) {
		// Get returns NotFound for unknown folders, which partialSync treats as a no-op -- drain sees
		// no error and counts it as a success below, not a failure.
		s, reg := newMetered(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, &fakeFolderClient{})
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		s.drain(context.Background())

		require.Zero(t, counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_failures_total",
			map[string]string{"sync_type": metrics.SyncTypePartial}))
	})

	t.Run("partial sync successes are counted per folder", func(t *testing.T) {
		folders := &fakeFolderClient{
			folders: map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
		}
		s, reg := newMetered(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		s.drain(context.Background())

		require.Equal(t, float64(1), counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_total", map[string]string{"sync_type": metrics.SyncTypePartial}))
	})

	t.Run("full sync failures are counted", func(t *testing.T) {
		fullSyncFailures := func(t *testing.T, reg prometheus.Gatherer) float64 {
			t.Helper()
			return counterValue(t, reg,
				"grafana_alerting_folder_label_syncer_failures_total", map[string]string{"sync_type": metrics.SyncTypeFull})
		}

		t.Run("fetching orgs", func(t *testing.T) {
			s, reg := newMetered(&fakeSyncerStore{orgsErr: errors.New("boom")}, &fakeFolderClient{})

			require.Error(t, s.FullSync(context.Background(), nil))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})

		t.Run("listing folders with rules", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1}, folderUIDsErr: errors.New("boom")}
			s, reg := newMetered(store, &fakeFolderClient{})

			// Per-org failures are tolerated, so FullSync itself succeeds.
			require.NoError(t, s.FullSync(context.Background(), nil))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})

		t.Run("listing labeled folders", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1}}
			s, reg := newMetered(store, &fakeFolderClient{listErr: errors.New("boom")})

			require.NoError(t, s.FullSync(context.Background(), nil))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})
	})

	t.Run("full sync successes are counted per org", func(t *testing.T) {
		fullSyncTotal := func(t *testing.T, reg prometheus.Gatherer) float64 {
			t.Helper()
			return counterValue(t, reg,
				"grafana_alerting_folder_label_syncer_total", map[string]string{"sync_type": metrics.SyncTypeFull})
		}

		t.Run("including orgs with nothing to do", func(t *testing.T) {
			// Both orgs already agree, so nothing is queued -- but the pass still ran.
			store := &fakeSyncerStore{orgs: []int64{1, 2}}
			s, reg := newMetered(store, &fakeFolderClient{})

			require.NoError(t, s.FullSync(context.Background(), nil))
			require.Equal(t, float64(2), fullSyncTotal(t, reg))
		})

		t.Run("counting only the orgs that did not fail", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1, 2}, folderUIDs: set("folder-a")}
			// org-1's folder calls fail, so only org 2 succeeds.
			folders := &fakeFolderClient{failNamespaces: map[string]struct{}{"org-1": {}}}
			s, reg := newMetered(store, folders)

			require.NoError(t, s.FullSync(context.Background(), nil))
			require.Equal(t, float64(1), fullSyncTotal(t, reg))
			require.Equal(t, float64(1), counterValue(t, reg,
				"grafana_alerting_folder_label_syncer_failures_total",
				map[string]string{"sync_type": metrics.SyncTypeFull}))
		})

		t.Run("skipped orgs are counted as neither", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1, 2}}
			s, reg := newMetered(store, &fakeFolderClient{})

			require.NoError(t, s.FullSync(context.Background(), map[int64]struct{}{2: {}}))
			require.Equal(t, float64(1), fullSyncTotal(t, reg))
		})

		t.Run("not counted when org enumeration fails", func(t *testing.T) {
			s, reg := newMetered(&fakeSyncerStore{orgsErr: errors.New("boom")}, &fakeFolderClient{})

			require.Error(t, s.FullSync(context.Background(), nil))
			require.Zero(t, fullSyncTotal(t, reg))
		})
	})

	t.Run("nil metrics do not panic", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{err: errors.New("boom")}, &fakeFolderClient{})
		require.Nil(t, s.metrics)

		require.Error(t, s.partialSync(context.Background(), models.FolderKey{OrgID: 1, UID: "folder-1"}))
	})
}

// counterValue returns the value of the named counter whose labels match all of want, or 0 if absent.
func counterValue(t *testing.T, g prometheus.Gatherer, name string, want map[string]string) float64 {
	t.Helper()
	families, err := g.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() != name {
			continue
		}
		for _, m := range f.GetMetric() {
			got := make(map[string]string, len(m.GetLabel()))
			for _, l := range m.GetLabel() {
				got[l.GetName()] = l.GetValue()
			}
			matches := true
			for k, v := range want {
				if got[k] != v {
					matches = false
					break
				}
			}
			if matches {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}
