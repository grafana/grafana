package folderreconcile

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// fakeLock either runs fn (as if the lock were acquired) or skips it (as if another replica holds it).
type fakeLock struct {
	acquired    bool
	calls       int
	maxInterval time.Duration
}

func (f *fakeLock) LockAndExecute(ctx context.Context, _ string, maxInterval time.Duration, fn func(context.Context)) error {
	f.calls++
	f.maxInterval = maxInterval
	if f.acquired {
		fn(ctx)
	}
	return nil
}

type fakeConsumer struct {
	name    string
	inUse   map[int64][]string
	deleted []string
}

func (c *fakeConsumer) Name() string { return c.name }

func (c *fakeConsumer) FoldersInUse(_ context.Context, orgID int64) ([]string, error) {
	return c.inUse[orgID], nil
}

func (c *fakeConsumer) DeleteInFolder(_ context.Context, _ int64, folderUID string) error {
	c.deleted = append(c.deleted, folderUID)
	return nil
}

type fakeOrgs struct {
	ids      []int64
	deadline time.Time
	hasDL    bool
}

func (o *fakeOrgs) Search(ctx context.Context, _ *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	o.deadline, o.hasDL = ctx.Deadline()
	dtos := make([]*org.OrgDTO, 0, len(o.ids))
	for _, id := range o.ids {
		dtos = append(dtos, &org.OrgDTO{ID: id})
	}
	return dtos, nil
}

// fakeFolders lets the search result and the double-check Get diverge per UID.
type fakeFolders struct {
	*foldertest.FakeService
	inSearch map[string]bool
	inGet    map[string]bool
}

func (f *fakeFolders) SearchFolders(_ context.Context, q folder.SearchFoldersQuery) (model.HitList, error) {
	var hits model.HitList
	for _, uid := range q.UIDs {
		if f.inSearch[uid] {
			hits = append(hits, &model.Hit{UID: uid})
		}
	}
	return hits, nil
}

func (f *fakeFolders) Get(_ context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	if q.UID != nil && f.inGet[*q.UID] {
		return &folder.Folder{UID: *q.UID}, nil
	}
	return nil, dashboards.ErrFolderNotFound
}

func TestReconcile(t *testing.T) {
	// Folders referenced across two consumers: "exists" is live, "gone" is truly deleted,
	// "racy" is missing from search but the double-check Get still finds it, and "general" is skipped.
	alerts := &fakeConsumer{name: "alerts", inUse: map[int64][]string{1: {"exists", "gone", folder.GeneralFolderUID}}}
	panels := &fakeConsumer{name: "panels", inUse: map[int64][]string{1: {"gone", "racy", ""}}}
	folders := &fakeFolders{
		FakeService: foldertest.NewFakeService(),
		inSearch:    map[string]bool{"exists": true},
		inGet:       map[string]bool{"exists": true, "racy": true},
	}

	r := newReconciler(folders, &fakeOrgs{ids: []int64{1}}, nil, 0, alerts, panels)
	require.NoError(t, r.reconcile(context.Background()))

	// Only the truly missing "gone" folder is cleaned up, for every consumer that referenced it.
	require.Equal(t, []string{"gone"}, alerts.deleted)
	require.Equal(t, []string{"gone"}, panels.deleted)
}

func TestNewReconciler_IntervalFloor(t *testing.T) {
	r := newReconciler(&fakeFolders{FakeService: foldertest.NewFakeService()}, &fakeOrgs{}, nil, time.Minute, nil)
	require.Equal(t, minInterval, r.interval)

	r = newReconciler(&fakeFolders{FakeService: foldertest.NewFakeService()}, &fakeOrgs{}, nil, 15*time.Minute, nil)
	require.Equal(t, 15*time.Minute, r.interval)
}

func TestTick_OnlyReconcilesWhenLockAcquired(t *testing.T) {
	alerts := &fakeConsumer{name: "alerts", inUse: map[int64][]string{1: {"gone"}}}
	folders := &fakeFolders{FakeService: foldertest.NewFakeService(), inSearch: map[string]bool{}}

	lock := &fakeLock{acquired: false}
	r := newReconciler(folders, &fakeOrgs{ids: []int64{1}}, lock, minInterval, alerts)
	r.tick(context.Background())
	require.Equal(t, 1, lock.calls)
	require.Empty(t, alerts.deleted)

	lock.acquired = true
	r.tick(context.Background())
	require.Equal(t, []string{"gone"}, alerts.deleted)
}

func TestTick_LockMaxIntervalMatchesTickInterval(t *testing.T) {
	lock := &fakeLock{acquired: true}
	r := newReconciler(&fakeFolders{FakeService: foldertest.NewFakeService()}, &fakeOrgs{}, lock, 15*time.Minute, nil)

	r.tick(context.Background())

	// maxInterval must equal the tick interval, so LockAndExecute is what caps actual run
	// frequency to once per interval regardless of how many replicas tick.
	require.Equal(t, r.interval, lock.maxInterval)
}

func TestTick_BoundsPassToLockInterval(t *testing.T) {
	orgs := &fakeOrgs{}
	lock := &fakeLock{acquired: true}
	r := newReconciler(&fakeFolders{FakeService: foldertest.NewFakeService()}, orgs, lock, minInterval, nil)

	before := time.Now()
	r.tick(context.Background())

	require.True(t, orgs.hasDL, "reconcile pass must run under a deadline so it can't outlive the lock")
	require.WithinDuration(t, before.Add(minInterval-passTimeoutMargin), orgs.deadline, time.Second)
}

func TestReconcile_StopsEarlyWhenContextExpires(t *testing.T) {
	alerts := &fakeConsumer{name: "alerts", inUse: map[int64][]string{1: {"gone"}, 2: {"gone"}}}
	folders := &fakeFolders{FakeService: foldertest.NewFakeService()}
	r := newReconciler(folders, &fakeOrgs{ids: []int64{1, 2}}, nil, minInterval, alerts)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.NoError(t, r.reconcile(ctx))

	// The org loop bails at its first boundary check, so no consumer work happens.
	require.Empty(t, alerts.deleted)
}
