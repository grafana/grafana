package folderreconcile

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

// fakeCascadeFolders is an in-memory folder tree: children maps a folder to its child folders.
type fakeCascadeFolders struct {
	terminating map[int64][]string
	children    map[string][]ChildFolder
	deleted     []string
	finalized   []string
	failed      map[string]string
}

func (f *fakeCascadeFolders) Terminating(_ context.Context, orgID int64) ([]string, error) {
	return f.terminating[orgID], nil
}

func (f *fakeCascadeFolders) Children(_ context.Context, _ int64, folderUID string) ([]ChildFolder, error) {
	return f.children[folderUID], nil
}

func (f *fakeCascadeFolders) Delete(_ context.Context, _ int64, folderUID string) error {
	f.deleted = append(f.deleted, folderUID)
	return nil
}

func (f *fakeCascadeFolders) RemoveFinalizer(_ context.Context, _ int64, folderUID string) error {
	f.finalized = append(f.finalized, folderUID)
	return nil
}

func (f *fakeCascadeFolders) MarkFailed(_ context.Context, _ int64, folderUID, reason string) error {
	if f.failed == nil {
		f.failed = map[string]string{}
	}
	f.failed[folderUID] = reason
	return nil
}

func TestAsyncReconcile_CascadesToChildren(t *testing.T) {
	// "root" has one live child and one already-terminating child; only the live one is deleted, and
	// root is not treated as a leaf, so its finalizer stays.
	folders := &fakeCascadeFolders{
		terminating: map[int64][]string{1: {"root"}},
		children: map[string][]ChildFolder{
			"root": {{UID: "child-live"}, {UID: "child-terminating", Terminating: true}},
		},
	}
	r := newAsyncReconciler(folders, &fakeOrgs{ids: []int64{1}}, 0)
	require.NoError(t, r.reconcile(context.Background()))

	require.Equal(t, []string{"child-live"}, folders.deleted)
	require.Empty(t, folders.finalized)
}

func TestAsyncReconcile_LeafDeletesContentsThenFinalizer(t *testing.T) {
	folders := &fakeCascadeFolders{terminating: map[int64][]string{1: {"leaf"}}}
	panels := &fakeConsumer{name: "panels"}
	alerts := &fakeConsumer{name: "alerts"}

	r := newAsyncReconciler(folders, &fakeOrgs{ids: []int64{1}}, 0, panels, alerts)
	require.NoError(t, r.reconcile(context.Background()))

	require.Equal(t, []string{"leaf"}, panels.deleted)
	require.Equal(t, []string{"leaf"}, alerts.deleted)
	require.Equal(t, []string{"leaf"}, folders.finalized)
}

func TestAsyncReconcile_MarksFailedAndKeepsFinalizer(t *testing.T) {
	folders := &fakeCascadeFolders{terminating: map[int64][]string{1: {"leaf"}}}
	panels := &fakeConsumer{name: "panels"}
	alerts := &failingConsumer{name: "alerts"}

	r := newAsyncReconciler(folders, &fakeOrgs{ids: []int64{1}}, 0, panels, alerts)
	require.NoError(t, r.reconcile(context.Background()))

	require.Contains(t, folders.failed["leaf"], "alerts")
	require.Empty(t, folders.finalized)
}

func TestAsyncReconcile_MinimalDeleterRuns(t *testing.T) {
	// A ContentDeleter without FoldersInUse (like the dashboards consumer) drains a leaf.
	folders := &fakeCascadeFolders{terminating: map[int64][]string{1: {"leaf"}}}
	dashboards := &minimalDeleter{name: "dashboards"}

	r := newAsyncReconciler(folders, &fakeOrgs{ids: []int64{1}}, 0, dashboards)
	require.NoError(t, r.reconcile(context.Background()))

	require.Equal(t, []string{"leaf"}, dashboards.deleted)
	require.Equal(t, []string{"leaf"}, folders.finalized)
}

// minimalDeleter implements only ContentDeleter (no FoldersInUse).
type minimalDeleter struct {
	name    string
	deleted []string
}

func (d *minimalDeleter) Name() string { return d.name }
func (d *minimalDeleter) DeleteInFolder(_ context.Context, _ int64, folderUID string) error {
	d.deleted = append(d.deleted, folderUID)
	return nil
}

type failingConsumer struct{ name string }

func (c *failingConsumer) Name() string                                          { return c.name }
func (c *failingConsumer) FoldersInUse(context.Context, int64) ([]string, error) { return nil, nil }
func (c *failingConsumer) DeleteInFolder(context.Context, int64, string) error {
	return errors.New("boom")
}
