package folderimpl

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type mockFolderSearcher struct {
	search func(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

func (m *mockFolderSearcher) Search(ctx context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return m.search(ctx, orgID, in)
}

func TestListDirectChildFolders_search(t *testing.T) {
	var gotOrgID int64
	var gotParent string
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, orgID int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotOrgID = orgID
			require.Len(t, in.Options.Fields, 1)
			gotParent = in.Options.Fields[0].Values[0]
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "folder2", Resource: "folder"}, Cells: [][]byte{[]byte("folder1")}},
						{Key: &resourcepb.ResourceKey{Name: "folder3", Resource: "folder"}, Cells: [][]byte{[]byte("folder1")}},
					},
				},
			}, nil
		},
	}

	children, err := listDirectChildFolders(context.Background(), searcher, 12, "folder1")
	require.NoError(t, err)
	require.Equal(t, []childFolder{{name: "folder2"}, {name: "folder3"}}, children)
	require.Equal(t, int64(12), gotOrgID)
	require.Equal(t, "folder1", gotParent)
}

func TestListDirectChildFolders_marksTerminatingFromLabel(t *testing.T) {
	var gotReturnFields []string
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotReturnFields = in.Fields
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "live", Resource: "folder"}, Cells: [][]byte{nil}},
						{Key: &resourcepb.ResourceKey{Name: "terminating", Resource: "folder"}, Cells: [][]byte{[]byte(folders.TerminatingLabelValue)}},
					},
				},
			}, nil
		},
	}

	children, err := listDirectChildFolders(context.Background(), searcher, 12, "parent")
	require.NoError(t, err)

	// The terminating label must be requested as a return field; the dedup depends on the search
	// backend echoing it back per hit.
	require.Contains(t, gotReturnFields, terminatingLabelField)
	require.Equal(t, []childFolder{
		{name: "live", terminating: false},
		{name: "terminating", terminating: true},
	}, children)
}

func TestCascadePoller_Run_disabledByFeatureFlag(t *testing.T) {
	w := ProvideCascadePoller(setting.NewCfg(), apiserver.WithoutRestConfig, nil, nil, nil, nil, nil)
	w.flagEnabled = func(context.Context) bool { return false }
	err := w.Run(context.Background())
	require.NoError(t, err)
}

func TestCascadePoller_Run_enabledFlagWithoutRestConfig(t *testing.T) {
	w := ProvideCascadePoller(setting.NewCfg(), apiserver.WithoutRestConfig, nil, nil, nil, nil, nil)
	w.flagEnabled = func(context.Context) bool { return true }
	err := w.Run(context.Background())
	require.NoError(t, err)
}

type deletedFolder struct {
	name        string
	gracePeriod *int64
}

type recordingFolderMutator struct {
	mu              sync.Mutex
	deleted         []deletedFolder
	finalizerRemove []string
	stripped        []string
	deleteErr       error
	removeErr       error
	stripErr        error
	// notTerminating makes RemoveCascadeFinalizer report the folder as not terminating (no deletion
	// timestamp), simulating a delete interrupted before the timestamp was set.
	notTerminating bool
}

func (m *recordingFolderMutator) Delete(_ context.Context, _ string, name string, gracePeriodSeconds *int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, deletedFolder{name: name, gracePeriod: gracePeriodSeconds})
	return m.deleteErr
}

func (m *recordingFolderMutator) RemoveCascadeFinalizer(_ context.Context, _ string, name string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.notTerminating {
		return false, m.removeErr
	}
	m.finalizerRemove = append(m.finalizerRemove, name)
	return true, m.removeErr
}

func (m *recordingFolderMutator) StripCascadeMetadata(_ context.Context, _ string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stripped = append(m.stripped, name)
	return m.stripErr
}

func (m *recordingFolderMutator) deletedNames() []string {
	out := make([]string, 0, len(m.deleted))
	for _, d := range m.deleted {
		out = append(out, d.name)
	}
	return out
}

// childSearch returns a mock searcher whose child search (listDirectChildFolders) reports the
// given children with their terminating state.
func childSearch(children map[string]bool) *mockFolderSearcher {
	return &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			rows := make([]*resourcepb.ResourceTableRow, 0, len(children))
			for name, terminating := range children {
				var cell []byte
				if terminating {
					cell = []byte(folders.TerminatingLabelValue)
				}
				rows = append(rows, &resourcepb.ResourceTableRow{
					Key:   &resourcepb.ResourceKey{Name: name, Resource: "folder"},
					Cells: [][]byte{cell},
				})
			}
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: rows,
			}}, nil
		},
	}
}

func TestCascadePoller_finalizeTerminatingFolder_removesFinalizerWhenNoChildren(t *testing.T) {
	// A leaf (no children) gets its finalizer removed so it can be garbage-collected.
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "leaf")

	require.Empty(t, mut.deletedNames())
	require.Equal(t, []string{"leaf"}, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_marksUnmarkedChildThenFinalizes(t *testing.T) {
	// The not-yet-terminating child is marked (the already-terminating one is skipped). Because the
	// mark succeeds, the child is terminating synchronously, so the folder is finalized this tick.
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{"unmarked": false, "marked": true}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "parent")

	// Only the not-yet-terminating child is marked, with a force (grace 0) delete.
	require.Equal(t, []string{"unmarked"}, mut.deletedNames())
	require.NotNil(t, mut.deleted[0].gracePeriod)
	require.Equal(t, int64(0), *mut.deleted[0].gracePeriod)
	// All marks succeeded, so the folder is finalized in the same tick.
	require.Equal(t, []string{"parent"}, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_keepsFinalizerWhenChildMarkFails(t *testing.T) {
	// If marking a child fails, the child is not guaranteed terminating, so the folder keeps its
	// finalizer and retries next tick.
	mut := &recordingFolderMutator{deleteErr: errors.New("boom")}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{"unmarked": false}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "parent")

	require.Empty(t, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_removesFinalizerWhenAllChildrenTerminating(t *testing.T) {
	// Children are present but all already marked terminating: the folder is finalized this tick
	// (it does not wait for the children to be physically removed), and no new marks are issued.
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{"a": true, "b": true}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "parent")

	require.Empty(t, mut.deletedNames(), "already-terminating children should not be re-marked")
	require.Equal(t, []string{"parent"}, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_resumesInterruptedDelete(t *testing.T) {
	// The folder carries the terminating label but has no deletion timestamp (delete interrupted
	// before the timestamp was set). The poller must not strand it: it resumes with a force delete
	// rather than removing the finalizer.
	mut := &recordingFolderMutator{notTerminating: true}
	w := &CascadePoller{
		folderSearch:  childSearch(map[string]bool{}),
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.finalizeTerminatingFolder(context.Background(), 12, "org-12", "leaf")

	require.Empty(t, mut.finalizerRemove, "finalizer must not be removed from a folder with no deletion timestamp")
	require.Equal(t, []string{"leaf"}, mut.deletedNames(), "the interrupted delete should be resumed")
	require.NotNil(t, mut.deleted[0].gracePeriod)
	require.Equal(t, int64(0), *mut.deleted[0].gracePeriod)
}

type fakeContentsDeleter struct {
	deletedFolders []string
	err            error
}

func (f *fakeContentsDeleter) deleteChildrenInFolder(_ context.Context, _ int64, folderUIDs []string, _ identity.Requester) error {
	f.deletedFolders = append(f.deletedFolders, folderUIDs...)
	return f.err
}

func TestCascadePoller_finalizeTerminatingFolder_deletesContentsThenRemovesFinalizer(t *testing.T) {
	// A leaf: its contained resources (dashboards, library elements, alert rules) are deleted, then
	// the finalizer is removed.
	deleter := &fakeContentsDeleter{}
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:    childSearch(map[string]bool{}),
		folderMutator:   mut,
		contentsDeleter: deleter,
		log:             slog.Default(),
	}
	ctx := identity.WithServiceIdentityContext(context.Background(), 12)

	w.finalizeTerminatingFolder(ctx, 12, "org-12", "leaf")

	require.Equal(t, []string{"leaf"}, deleter.deletedFolders)
	require.Equal(t, []string{"leaf"}, mut.finalizerRemove)
}

func TestCascadePoller_finalizeTerminatingFolder_keepsFinalizerWhenContentsDeleteFails(t *testing.T) {
	// If deleting the contained resources fails, the finalizer is left in place to retry next tick.
	deleter := &fakeContentsDeleter{err: errors.New("boom")}
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		folderSearch:    childSearch(map[string]bool{}),
		folderMutator:   mut,
		contentsDeleter: deleter,
		log:             slog.Default(),
	}
	ctx := identity.WithServiceIdentityContext(context.Background(), 12)

	w.finalizeTerminatingFolder(ctx, 12, "org-12", "leaf")

	require.Empty(t, mut.finalizerRemove)
}

func TestSearchTerminatingFolders(t *testing.T) {
	var gotLabels []*resourcepb.Requirement
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			gotLabels = in.Options.Labels
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "term-a", Resource: "folder"}, Cells: [][]byte{nil}},
						{Key: &resourcepb.ResourceKey{Name: "term-b", Resource: "folder"}, Cells: [][]byte{nil}},
					},
				},
			}, nil
		},
	}

	names, err := searchTerminatingFolders(context.Background(), searcher, 12)
	require.NoError(t, err)
	require.Equal(t, []string{"term-a", "term-b"}, names)

	// Discovery must filter server-side on the terminating label.
	require.Len(t, gotLabels, 1)
	require.Equal(t, folders.TerminatingLabel, gotLabels[0].Key)
	require.Equal(t, []string{folders.TerminatingLabelValue}, gotLabels[0].Values)
}

type fakeOrgLister struct {
	orgs []*org.OrgDTO
	err  error
}

func (f *fakeOrgLister) Search(context.Context, *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return f.orgs, f.err
}

func TestCascadePoller_pollOnce(t *testing.T) {
	// Discovery returns two terminating folders: "parent" (whose only child is already terminating)
	// and "child" (a leaf). Both are finalized this tick: the parent does not wait for the child to
	// be physically removed, only for it to be marked terminating.
	term := []byte(folders.TerminatingLabelValue)
	cols := []*resourcepb.ResourceTableColumnDefinition{
		{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
	}
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			if len(in.Options.Labels) > 0 {
				return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
					Columns: cols,
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "parent", Resource: "folder"}, Cells: [][]byte{term}},
						{Key: &resourcepb.ResourceKey{Name: "child", Resource: "folder"}, Cells: [][]byte{term}},
					},
				}}, nil
			}
			// Child search: "parent" still has the (terminating) child; "child" is a leaf.
			if in.Options.Fields[0].Values[0] == "parent" {
				return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
					Columns: cols,
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "child", Resource: "folder"}, Cells: [][]byte{term}},
					},
				}}, nil
			}
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{Columns: cols}}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		orgs:            &fakeOrgLister{orgs: []*org.OrgDTO{{ID: 12}}},
		namespaceMapper: func(int64) string { return "org-12" },
		folderSearch:    searcher,
		folderMutator:   mut,
		log:             slog.Default(),
	}

	w.pollOnce(context.Background())

	require.ElementsMatch(t, []string{"parent", "child"}, mut.finalizerRemove)
	require.Empty(t, mut.deletedNames())
}

func TestCascadePoller_drainTerminatingFolders(t *testing.T) {
	// With the feature disabled, the drain strips finalizers from folders left terminating so they
	// complete deletion; it must not cascade or issue any deletes.
	term := []byte(folders.TerminatingLabelValue)
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{Key: &resourcepb.ResourceKey{Name: "stuck-a", Resource: "folder"}, Cells: [][]byte{term}},
					{Key: &resourcepb.ResourceKey{Name: "stuck-b", Resource: "folder"}, Cells: [][]byte{term}},
				},
			}}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadePoller{
		orgs:            &fakeOrgLister{orgs: []*org.OrgDTO{{ID: 12}}},
		namespaceMapper: func(int64) string { return "org-12" },
		folderSearch:    searcher,
		folderMutator:   mut,
		log:             slog.Default(),
	}

	w.drainTerminatingFolders(context.Background())

	require.ElementsMatch(t, []string{"stuck-a", "stuck-b"}, mut.stripped)
	require.Empty(t, mut.finalizerRemove, "drain strips metadata unconditionally; it must not use the gated finalizer removal")
	require.Empty(t, mut.deletedNames(), "drain only strips metadata; it must not issue deletes or cascade")
}

func newFakeFolderClient(t *testing.T, obj *unstructured.Unstructured) dynamic.NamespaceableResourceInterface {
	t.Helper()
	gvr := foldersv1.FolderResourceInfo.GroupVersionResource()
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(),
		map[schema.GroupVersionResource]string{gvr: "FolderList"})
	_, err := client.Resource(gvr).Namespace(obj.GetNamespace()).Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	return client.Resource(gvr)
}

func folderUnstructured(name string, finalizers ...string) *unstructured.Unstructured {
	o := &unstructured.Unstructured{}
	o.SetGroupVersionKind(foldersv1.FolderResourceInfo.GroupVersionKind())
	o.SetNamespace("org-12")
	o.SetName(name)
	if len(finalizers) > 0 {
		o.SetFinalizers(finalizers)
	}
	return o
}

// terminatingFolder is a folderUnstructured with a deletion timestamp set, i.e. actually terminating.
func terminatingFolder(name string, finalizers ...string) *unstructured.Unstructured {
	o := folderUnstructured(name, finalizers...)
	now := metav1.Now()
	o.SetDeletionTimestamp(&now)
	return o
}

func TestDynamicFolderMutator_RemoveCascadeFinalizer(t *testing.T) {
	t.Run("removes only the cascade finalizer", func(t *testing.T) {
		client := newFakeFolderClient(t, terminatingFolder("f", folders.CascadeDeleteFinalizer, "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		terminating, err := mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f")
		require.NoError(t, err)
		require.True(t, terminating)

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
	})

	t.Run("leaves other finalizers untouched when the cascade finalizer is absent", func(t *testing.T) {
		client := newFakeFolderClient(t, terminatingFolder("f", "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		terminating, err := mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f")
		require.NoError(t, err)
		require.True(t, terminating)

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
	})

	t.Run("keeps the cascade finalizer when the folder has no deletion timestamp", func(t *testing.T) {
		// A folder carrying the terminating label but no deletion timestamp is an interrupted delete:
		// removing its finalizer would strand it alive, so the gate must leave it in place.
		client := newFakeFolderClient(t, folderUnstructured("f", folders.CascadeDeleteFinalizer, "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		terminating, err := mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f")
		require.NoError(t, err)
		require.False(t, terminating)

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{folders.CascadeDeleteFinalizer, "other.io/keep"}, got.GetFinalizers())
	})
}

func TestDynamicFolderMutator_StripCascadeMetadata(t *testing.T) {
	t.Run("removes the cascade finalizer and terminating label, keeps the rest", func(t *testing.T) {
		obj := folderUnstructured("f", folders.CascadeDeleteFinalizer, "other.io/keep")
		obj.SetLabels(map[string]string{folders.TerminatingLabel: folders.TerminatingLabelValue, "keep": "yes"})
		client := newFakeFolderClient(t, obj)
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.StripCascadeMetadata(context.Background(), "org-12", "f"))

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
		require.NotContains(t, got.GetLabels(), folders.TerminatingLabel)
		require.Equal(t, "yes", got.GetLabels()["keep"])
	})

	t.Run("cleans a stray-labeled live folder (no deletion timestamp)", func(t *testing.T) {
		obj := folderUnstructured("f", folders.CascadeDeleteFinalizer)
		obj.SetLabels(map[string]string{folders.TerminatingLabel: folders.TerminatingLabelValue})
		client := newFakeFolderClient(t, obj)
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.StripCascadeMetadata(context.Background(), "org-12", "f"))

		// The folder has no deletion timestamp, so it survives -- just cleaned of cascade metadata.
		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Empty(t, got.GetFinalizers())
		require.NotContains(t, got.GetLabels(), folders.TerminatingLabel)
	})
}

func TestDynamicFolderMutator_Delete(t *testing.T) {
	client := newFakeFolderClient(t, folderUnstructured("f", folders.CascadeDeleteFinalizer))
	mut := &dynamicFolderMutator{client: client}

	grace := int64(0)
	require.NoError(t, mut.Delete(context.Background(), "org-12", "f", &grace))

	_, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err))
}
