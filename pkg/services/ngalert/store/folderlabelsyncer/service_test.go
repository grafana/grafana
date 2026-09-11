package folderlabelsyncer

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"

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

	updateErr error
	// updateErrQueue is consumed one entry per Update call, before updateErr applies, so a fake can
	// fail a set number of times and then succeed.
	updateErrQueue         []error
	updateCalls            int
	updated                []map[string]string
	updateResourceVersions []string

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
	// A copy, with the namespace set as a real Get would: partialSync mutates the object it reads, so
	// handing out the stored pointer would let one attempt's mutation leak into the next.
	out := folder.DeepCopy()
	out.Namespace = id.Namespace
	return out, nil
}

func (f *fakeFolderClient) Update(_ context.Context, obj *folderv1.Folder, opts resource.UpdateOptions) (*folderv1.Folder, error) {
	f.updateCalls++
	f.updateResourceVersions = append(f.updateResourceVersions, opts.ResourceVersion)
	if _, ok := f.failNamespaces[obj.Namespace]; ok {
		return nil, errors.New("failure")
	}
	if len(f.updateErrQueue) > 0 {
		err := f.updateErrQueue[0]
		f.updateErrQueue = f.updateErrQueue[1:]
		if err != nil {
			return nil, err
		}
	}
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	// Copied, since the caller mutates the object it read.
	labels := make(map[string]string, len(obj.Labels))
	for k, v := range obj.Labels {
		labels[k] = v
	}
	f.updated = append(f.updated, labels)
	return obj, nil
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
		// Same attempt count as production, without the delays.
		retryBackoff: wait.Backoff{Steps: retry.DefaultBackoff.Steps},
		dirty:        make(map[models.FolderKey]struct{}),
		wake:         make(chan struct{}, 1),
		folders:      folders,
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

	t.Run("skips disabled orgs", func(t *testing.T) {
		// Rule writes are not rejected for a disabled org, so a rule change there reaches the listener.
		// Filtering here is what keeps label maintenance off orgs alerting is meant to ignore.
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})
		s.disabledOrgs = map[int64]struct{}{2: {}}

		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "a"}, {OrgID: 2, UID: "b"}})

		require.Equal(t, []models.FolderKey{{OrgID: 1, UID: "a"}}, s.take())
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

	t.Run("ignores a rule change in a disabled org", func(t *testing.T) {
		s := newTestService(&fakeSyncerStore{}, &fakeFolderClient{})
		s.disabledOrgs = map[int64]struct{}{1: {}}

		require.NoError(t, s.handleRuleChange(context.Background(), &store.RuleChangeEvent{
			FolderKeys: []models.FolderKey{{OrgID: 1, UID: "a"}},
		}))
		require.Empty(t, s.take())
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

		require.Equal(t, []map[string]string{{
			HasRulesLabel: "true",
			"unrelated":   "keep",
		}}, folders.updated, "other labels must survive")
	})

	t.Run("writes conditionally on the version it read", func(t *testing.T) {
		folder := folderWithLabels("folder-1", map[string]string{"unrelated": "keep"})
		folder.ResourceVersion = "5"
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{"folder-1": folder}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Equal(t, []string{"5"}, folders.updateResourceVersions,
			"the update must carry the version the folder was read at")
	})

	t.Run("creates the labels map when the folder has none", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
			"folder-1": folderWithLabels("folder-1", nil),
		}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 2}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Equal(t, []map[string]string{{HasRulesLabel: "true"}}, folders.updated)
	})

	t.Run("removes the label when the last rule goes", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{
			"folder-1": folderWithLabels("folder-1", map[string]string{
				HasRulesLabel: "true",
				"unrelated":   "keep",
			}),
		}}
		s := newTestService(&fakeSyncerStore{}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))

		require.Equal(t, []map[string]string{{"unrelated": "keep"}}, folders.updated,
			"only the has-rules label may be removed")
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
				require.Empty(t, folders.updated, "expected no write when state already matches")
			})
		}
	})

	t.Run("is a no-op when the folder is already deleted", func(t *testing.T) {
		folders := &fakeFolderClient{folders: map[string]*folderv1.Folder{}}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)

		require.NoError(t, s.partialSync(context.Background(), key))
		require.Empty(t, folders.updated)
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

		t.Run("updating the folder", func(t *testing.T) {
			folders := &fakeFolderClient{
				folders:   map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
				updateErr: errors.New("boom"),
			}
			s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
			require.ErrorContains(t, s.partialSync(context.Background(), key), "update folder label")
		})
	})
}

func TestDrain(t *testing.T) {
	t.Run("drops folders that failed after retries are exhausted", func(t *testing.T) {
		// Not re-queued: the periodic full sync is what picks the folder back up, so a persistently
		// failing folder cannot occupy the queue indefinitely.
		folders := &fakeFolderClient{
			folders:   map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
			updateErr: apierrors.NewConflict(schema.GroupResource{Resource: "folders"}, "folder-1", errors.New("boom")),
		}
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.markDirty([]models.FolderKey{{OrgID: 1, UID: "folder-1"}})

		s.drain(context.Background())

		require.Empty(t, s.take())
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

	require.NoError(t, s.Run(ctx))
}

func TestIsRetriable(t *testing.T) {
	gr := schema.GroupResource{Resource: "folders"}

	tests := []struct {
		name string
		err  error
		want bool
	}{
		// Clear on their own, so another attempt has a real chance.
		{"conflict", apierrors.NewConflict(gr, "f", errors.New("boom")), true},
		{"too many requests", apierrors.NewTooManyRequests("slow down", 1), true},
		{"server timeout", apierrors.NewServerTimeout(gr, "patch", 1), true},
		{"timeout", apierrors.NewTimeoutError("timed out", 1), true},
		{"internal error", apierrors.NewInternalError(errors.New("boom")), true},
		{"service unavailable", apierrors.NewServiceUnavailable("unavailable"), true},

		// Never clear, so retrying only multiplies load.
		{"forbidden", apierrors.NewForbidden(gr, "f", errors.New("nope")), false},
		{"invalid", apierrors.NewInvalid(schema.GroupKind{Kind: "Folder"}, "f", nil), false},
		{"not found", apierrors.NewNotFound(gr, "f"), false},
		{"unauthorized", apierrors.NewUnauthorized("nope"), false},

		// Would otherwise sleep out the ladder during shutdown.
		{"context canceled", context.Canceled, false},
		{"context deadline exceeded", context.DeadlineExceeded, false},

		// A plain error carries no reason, so it is not assumed transient.
		{"unclassified", errors.New("boom"), false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, isRetriable(tc.err))

			// partialSync wraps every error it returns, so the predicate has to see through %w.
			require.Equal(t, tc.want, isRetriable(fmt.Errorf("patch folder label: %w", tc.err)),
				"classification must survive wrapping")
		})
	}
}

func TestDrainRetries(t *testing.T) {
	key := models.FolderKey{OrgID: 1, UID: "folder-1"}
	conflict := func() error {
		return apierrors.NewConflict(schema.GroupResource{Resource: "folders"}, "folder-1", errors.New("boom"))
	}
	newFolders := func(errs ...error) *fakeFolderClient {
		return &fakeFolderClient{
			folders:        map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
			updateErrQueue: errs,
		}
	}

	t.Run("retries a transient failure until it succeeds", func(t *testing.T) {
		folders := newFolders(conflict(), conflict())
		reg := prometheus.NewPedanticRegistry()
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.metrics = metrics.NewFolderLabelSyncerMetrics(reg)
		s.markDirty([]models.FolderKey{key})

		s.drain(context.Background())

		require.Equal(t, 3, folders.updateCalls, "should have retried twice before succeeding")
		require.Equal(t, float64(1), counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_total",
			map[string]string{"sync_type": metrics.SyncTypePartial}))
		require.Zero(t, counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_failures_total",
			map[string]string{"sync_type": metrics.SyncTypePartial}))
	})

	t.Run("gives up after the attempt budget and counts one failure", func(t *testing.T) {
		folders := newFolders()
		folders.updateErr = conflict()
		reg := prometheus.NewPedanticRegistry()
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.metrics = metrics.NewFolderLabelSyncerMetrics(reg)
		s.markDirty([]models.FolderKey{key})

		s.drain(context.Background())

		require.Equal(t, retry.DefaultBackoff.Steps, folders.updateCalls,
			"should stop at the configured attempt budget")
		// Once per folder, not once per retry attempt, or the counters stop being comparable.
		require.Equal(t, float64(1), counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_failures_total",
			map[string]string{"sync_type": metrics.SyncTypePartial}))
		// A failed sync is still an attempt, so it counts toward the total and failures stay a subset.
		require.Equal(t, float64(1), counterValue(t, reg,
			"grafana_alerting_folder_label_syncer_total",
			map[string]string{"sync_type": metrics.SyncTypePartial}))
	})

	t.Run("does not retry a failure that cannot clear", func(t *testing.T) {
		folders := newFolders()
		folders.updateErr = apierrors.NewForbidden(schema.GroupResource{Resource: "folders"}, "folder-1", errors.New("nope"))
		s := newTestService(&fakeSyncerStore{counts: map[string]int64{"folder-1": 1}}, folders)
		s.markDirty([]models.FolderKey{key})

		s.drain(context.Background())

		require.Equal(t, 1, folders.updateCalls, "a non-retriable error should fail on the first attempt")
	})
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
				name:  "updating the folder",
				store: &fakeSyncerStore{counts: map[string]int64{"folder-1": 1}},
				folder: &fakeFolderClient{
					folders:   map[string]*folderv1.Folder{"folder-1": folderWithLabels("folder-1", nil)},
					updateErr: errors.New("boom"),
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

			require.Error(t, s.FullSync(context.Background()))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})

		t.Run("listing folders with rules", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1}, folderUIDsErr: errors.New("boom")}
			s, reg := newMetered(store, &fakeFolderClient{})

			// Per-org failures are tolerated, so FullSync itself succeeds.
			require.NoError(t, s.FullSync(context.Background()))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})

		t.Run("listing labeled folders", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1}}
			s, reg := newMetered(store, &fakeFolderClient{listErr: errors.New("boom")})

			require.NoError(t, s.FullSync(context.Background()))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
		})
	})

	t.Run("full sync attempts are counted per org", func(t *testing.T) {
		fullSyncTotal := func(t *testing.T, reg prometheus.Gatherer) float64 {
			t.Helper()
			return counterValue(t, reg,
				"grafana_alerting_folder_label_syncer_total", map[string]string{"sync_type": metrics.SyncTypeFull})
		}
		fullSyncFailures := func(t *testing.T, reg prometheus.Gatherer) float64 {
			t.Helper()
			return counterValue(t, reg,
				"grafana_alerting_folder_label_syncer_failures_total",
				map[string]string{"sync_type": metrics.SyncTypeFull})
		}

		t.Run("including orgs with nothing to do", func(t *testing.T) {
			// Both orgs already agree, so nothing is queued -- but the pass still ran.
			store := &fakeSyncerStore{orgs: []int64{1, 2}}
			s, reg := newMetered(store, &fakeFolderClient{})

			require.NoError(t, s.FullSync(context.Background()))
			require.Equal(t, float64(2), fullSyncTotal(t, reg))
			require.Zero(t, fullSyncFailures(t, reg))
		})

		t.Run("counting failed orgs too, so failures stay a subset of total", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1, 2}, folderUIDs: set("folder-a")}
			// org-1's folder calls fail, so one org fails and one succeeds.
			folders := &fakeFolderClient{failNamespaces: map[string]struct{}{"org-1": {}}}
			s, reg := newMetered(store, folders)

			require.NoError(t, s.FullSync(context.Background()))
			require.Equal(t, float64(2), fullSyncTotal(t, reg), "both orgs were attempted")
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
			require.LessOrEqual(t, fullSyncFailures(t, reg), fullSyncTotal(t, reg))
		})

		t.Run("skipped orgs are counted as neither", func(t *testing.T) {
			store := &fakeSyncerStore{orgs: []int64{1, 2}}
			s, reg := newMetered(store, &fakeFolderClient{})
			s.disabledOrgs = map[int64]struct{}{2: {}}

			require.NoError(t, s.FullSync(context.Background()))
			require.Equal(t, float64(1), fullSyncTotal(t, reg))
		})

		t.Run("counted once for the whole pass when org enumeration fails", func(t *testing.T) {
			// No org was reached, so there is no per-org outcome; the pass itself is the attempt.
			s, reg := newMetered(&fakeSyncerStore{orgsErr: errors.New("boom")}, &fakeFolderClient{})

			require.Error(t, s.FullSync(context.Background()))
			require.Equal(t, float64(1), fullSyncTotal(t, reg))
			require.Equal(t, float64(1), fullSyncFailures(t, reg))
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
