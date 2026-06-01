package folderimpl

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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

	w.onFolder(newTerminatingFolder("parent"))

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

	w.onFolder(parent)

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

	w.onFolder(newTerminatingFolder("leaf"))

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

	w.onFolder(newTerminatingFolder("parent"))

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

	w.onFolder(&foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "alive", Namespace: "org-12"}})

	require.Empty(t, mut.deletedNames())
	require.Empty(t, mut.finalizerRemove)
}
