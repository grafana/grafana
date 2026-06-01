package folderimpl

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	"k8s.io/client-go/util/workqueue"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestIsTerminatingForCascade(t *testing.T) {
	now := metav1.NewTime(time.Now())

	require.False(t, isTerminatingForCascade(&foldersv1.Folder{}))
	require.False(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{DeletionTimestamp: &now},
	}))
	require.False(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{Finalizers: []string{folders.CascadeDeleteFinalizer}},
	}))
	require.True(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			DeletionTimestamp: &now,
			Finalizers:        []string{folders.CascadeDeleteFinalizer},
		},
	}))
}

func TestTerminatingFolderSelector(t *testing.T) {
	require.Equal(t, "folder.grafana.app/terminating=true", terminatingFolderSelector)
}

func TestOrgIDFromNamespace(t *testing.T) {
	orgID, err := orgIDFromNamespace("org-12")
	require.NoError(t, err)
	require.Equal(t, int64(12), orgID)

	_, err = orgIDFromNamespace("invalid")
	require.Error(t, err)
}

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

func TestCascadeWatcher_Run_disabledByFeatureFlag(t *testing.T) {
	w := ProvideCascadeWatcher(nil, apiserver.WithoutRestConfig, nil, nil)
	w.flagEnabled = func(context.Context) bool { return false }
	err := w.Run(context.Background())
	require.NoError(t, err)
}

func TestCascadeWatcher_Run_enabledFlagWithoutRestConfig(t *testing.T) {
	w := ProvideCascadeWatcher(nil, apiserver.WithoutRestConfig, nil, nil)
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
	deleteErr       error
	removeErr       error
}

func (m *recordingFolderMutator) Delete(_ context.Context, _ string, name string, gracePeriodSeconds *int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, deletedFolder{name: name, gracePeriod: gracePeriodSeconds})
	return m.deleteErr
}

func (m *recordingFolderMutator) RemoveCascadeFinalizer(_ context.Context, _ string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.finalizerRemove = append(m.finalizerRemove, name)
	return m.removeErr
}

func (m *recordingFolderMutator) deletedNames() []string {
	out := make([]string, 0, len(m.deleted))
	for _, d := range m.deleted {
		out = append(out, d.name)
	}
	return out
}

func newTerminatingFolder(name string) *foldersv1.Folder {
	now := metav1.NewTime(time.Now())
	return &foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         "org-12",
			DeletionTimestamp: &now,
			Finalizers:        []string{folders.CascadeDeleteFinalizer},
		},
	}
}

func TestCascadeWatcher_onFolder_deletesChildren(t *testing.T) {
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "child-a", Resource: "folder"}, Cells: [][]byte{[]byte("parent")}},
						{Key: &resourcepb.ResourceKey{Name: "child-b", Resource: "folder"}, Cells: [][]byte{[]byte("parent")}},
					},
				},
			}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch:  searcher,
		folderMutator: mut,
		log:           slog.Default(),
	}

	require.NoError(t, w.reconcileFolder(context.Background(), newTerminatingFolder("parent")))

	require.Equal(t, []string{"child-a", "child-b"}, mut.deletedNames())
	require.Nil(t, mut.deleted[0].gracePeriod)
	require.Empty(t, mut.finalizerRemove)
}

func TestCascadeWatcher_onFolder_propagatesGracePeriodToChildren(t *testing.T) {
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "child-a", Resource: "folder"}, Cells: [][]byte{[]byte("parent")}},
					},
				},
			}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch:  searcher,
		folderMutator: mut,
		log:           slog.Default(),
	}

	parent := newTerminatingFolder("parent")
	zero := int64(0)
	parent.DeletionGracePeriodSeconds = &zero

	require.NoError(t, w.reconcileFolder(context.Background(), parent))

	require.Len(t, mut.deleted, 1)
	require.NotNil(t, mut.deleted[0].gracePeriod)
	require.Equal(t, int64(0), *mut.deleted[0].gracePeriod)
}

func TestCascadeWatcher_onFolder_removesFinalizerWhenEmpty(t *testing.T) {
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
				},
			}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch:  searcher,
		folderMutator: mut,
		log:           slog.Default(),
	}

	require.NoError(t, w.reconcileFolder(context.Background(), newTerminatingFolder("leaf")))

	require.Empty(t, mut.deleted)
	require.Equal(t, []string{"leaf"}, mut.finalizerRemove)
}

func TestCascadeWatcher_onFolder_skipsAlreadyTerminatingChildren(t *testing.T) {
	searcher := &mockFolderSearcher{
		search: func(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "live-child", Resource: "folder"}, Cells: [][]byte{nil}},
						{Key: &resourcepb.ResourceKey{Name: "terminating-child", Resource: "folder"}, Cells: [][]byte{[]byte(folders.TerminatingLabelValue)}},
					},
				},
			}, nil
		},
	}
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch:  searcher,
		folderMutator: mut,
		log:           slog.Default(),
	}

	require.NoError(t, w.reconcileFolder(context.Background(), newTerminatingFolder("parent")))

	// Only the non-terminating child is (re-)deleted; the terminating one is already draining.
	require.Equal(t, []string{"live-child"}, mut.deletedNames())
	// Both children still exist, so the parent keeps its finalizer.
	require.Empty(t, mut.finalizerRemove)
}

func TestCascadeWatcher_onFolder_skipsWhenNotTerminating(t *testing.T) {
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch: &mockFolderSearcher{search: func(context.Context, int64, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
			return nil, nil
		}},
		folderMutator: mut,
		log:           slog.Default(),
	}

	require.NoError(t, w.reconcileFolder(context.Background(), &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "alive", Namespace: "org-12"}}))

	require.Empty(t, mut.deletedNames())
	require.Empty(t, mut.finalizerRemove)
}

func TestCascadeWatcher_enqueueParent(t *testing.T) {
	w := &CascadeWatcher{
		queue: workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]()),
		log:   slog.Default(),
	}
	t.Cleanup(w.queue.ShutDown)

	child := &foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "child",
			Namespace:   "org-12",
			Annotations: map[string]string{utils.AnnoKeyFolder: "parent"},
		},
	}
	w.enqueueParent(child)

	require.Equal(t, 1, w.queue.Len())
	key, _ := w.queue.Get()
	require.Equal(t, "org-12/parent", key)
}

func TestCascadeWatcher_enqueueParent_skipsRootFolder(t *testing.T) {
	w := &CascadeWatcher{
		queue: workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]()),
		log:   slog.Default(),
	}
	t.Cleanup(w.queue.ShutDown)

	root := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "root", Namespace: "org-12"}}
	w.enqueueParent(root)

	require.Equal(t, 0, w.queue.Len())
}

func TestCascadeWatcher_enqueueParent_dedupesSiblings(t *testing.T) {
	w := &CascadeWatcher{
		queue: workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]()),
		log:   slog.Default(),
	}
	t.Cleanup(w.queue.ShutDown)

	newChild := func(name string) *foldersv1.Folder {
		return &foldersv1.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name:        name,
				Namespace:   "org-12",
				Annotations: map[string]string{utils.AnnoKeyFolder: "parent"},
			},
		}
	}

	// Several children of the same parent draining together collapse into one queued parent key.
	w.enqueueParent(newChild("child-a"))
	w.enqueueParent(newChild("child-b"))
	w.enqueueParent(newChild("child-c"))

	require.Equal(t, 1, w.queue.Len())
}

// fakeFolderTree is an in-memory model of a folder subtree that implements both folderSearcher
// and folderMutator, so the cascade recursion can be exercised end to end without an apiserver.
// It mirrors the real lifecycle: deleting a folder that has the cascade finalizer marks it
// terminating (sets a deletion timestamp) rather than removing it; removing the finalizer is what
// actually garbage-collects it, which in turn re-enqueues its parent (as the informer DeleteFunc
// would).
type fakeFolderTree struct {
	folders     map[string]*fakeFolder // name -> folder; absent means garbage-collected
	enqueue     func(name string)      // mirrors the workqueue: schedules a reconcile
	deleteOrder []string               // folders garbage-collected, in order
	violations  []string               // folders whose finalizer was removed while children remained
}

type fakeFolder struct {
	parent      string
	terminating bool
	finalizer   bool
}

func (ft *fakeFolderTree) Search(_ context.Context, _ int64, in *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	parent := in.Options.Fields[0].Values[0]
	rows := make([]*resourcepb.ResourceTableRow, 0)
	for name, f := range ft.folders {
		if f.parent != parent {
			continue
		}
		var cell []byte
		if f.terminating {
			cell = []byte(folders.TerminatingLabelValue)
		}
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key:   &resourcepb.ResourceKey{Name: name, Resource: "folder"},
			Cells: [][]byte{cell},
		})
	}
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: terminatingLabelField, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: rows,
		},
	}, nil
}

func (ft *fakeFolderTree) Delete(_ context.Context, _, name string, _ *int64) error {
	f, ok := ft.folders[name]
	if !ok {
		return nil
	}
	if !f.terminating {
		// Folder carries the cascade finalizer, so delete only starts termination.
		f.terminating = true
		ft.enqueue(name)
	}
	return nil
}

func (ft *fakeFolderTree) RemoveCascadeFinalizer(_ context.Context, _, name string) error {
	f, ok := ft.folders[name]
	if !ok {
		return nil
	}
	if ft.childrenOf(name) > 0 {
		ft.violations = append(ft.violations, name)
	}
	delete(ft.folders, name)
	ft.deleteOrder = append(ft.deleteOrder, name)
	if f.parent != "" {
		ft.enqueue(f.parent) // mirrors the informer DeleteFunc -> enqueueParent
	}
	return nil
}

func (ft *fakeFolderTree) childrenOf(name string) int {
	n := 0
	for _, f := range ft.folders {
		if f.parent == name {
			n++
		}
	}
	return n
}

func (ft *fakeFolderTree) folderCR(name string) *foldersv1.Folder {
	f := ft.folders[name]
	obj := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "org-12"}}
	if f.finalizer {
		obj.Finalizers = []string{folders.CascadeDeleteFinalizer}
	}
	if f.terminating {
		now := metav1.NewTime(time.Now())
		obj.DeletionTimestamp = &now
	}
	return obj
}

func TestCascadeWatcher_reconcileFolder_cascadesWholeSubtree(t *testing.T) {
	// root
	// |- a
	// |  |- a1
	// |  |- a2
	// |     |- a2x
	// |- b
	//    |- b1
	parents := map[string]string{
		"root": "",
		"a":    "root",
		"b":    "root",
		"a1":   "a",
		"a2":   "a",
		"a2x":  "a2",
		"b1":   "b",
	}
	ft := &fakeFolderTree{folders: map[string]*fakeFolder{}}
	for name, parent := range parents {
		// Every folder was created with the flag on, so it already carries the finalizer.
		ft.folders[name] = &fakeFolder{parent: parent, finalizer: true}
	}

	var queue []string
	ft.enqueue = func(name string) { queue = append(queue, name) }

	w := &CascadeWatcher{
		folderSearch:  ft,
		folderMutator: ft,
		log:           slog.Default(),
	}

	// User force-deletes the root: it starts terminating and is scheduled for reconcile.
	ft.folders["root"].terminating = true
	ft.enqueue("root")

	for i := 0; len(queue) > 0; i++ {
		require.Less(t, i, 1000, "cascade did not converge")
		name := queue[0]
		queue = queue[1:]
		if _, ok := ft.folders[name]; !ok {
			continue // already garbage-collected
		}
		require.NoError(t, w.reconcileFolder(context.Background(), ft.folderCR(name)))
	}

	require.Empty(t, ft.folders, "entire subtree should be garbage-collected")
	require.Empty(t, ft.violations, "a folder's finalizer must only be removed once it has no children")
	require.ElementsMatch(t, []string{"root", "a", "b", "a1", "a2", "a2x", "b1"}, ft.deleteOrder)
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

func TestDynamicFolderMutator_RemoveCascadeFinalizer(t *testing.T) {
	t.Run("removes only the cascade finalizer", func(t *testing.T) {
		client := newFakeFolderClient(t, folderUnstructured("f", folders.CascadeDeleteFinalizer, "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f"))

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
	})

	t.Run("leaves other finalizers untouched when the cascade finalizer is absent", func(t *testing.T) {
		client := newFakeFolderClient(t, folderUnstructured("f", "other.io/keep"))
		mut := &dynamicFolderMutator{client: client}

		require.NoError(t, mut.RemoveCascadeFinalizer(context.Background(), "org-12", "f"))

		got, err := client.Namespace("org-12").Get(context.Background(), "f", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"other.io/keep"}, got.GetFinalizers())
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
