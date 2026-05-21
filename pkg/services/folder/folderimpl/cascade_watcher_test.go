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

func TestListDirectChildFolderNames_search(t *testing.T) {
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

	names, err := listDirectChildFolderNames(context.Background(), searcher, 12, "folder1")
	require.NoError(t, err)
	require.Equal(t, []string{"folder2", "folder3"}, names)
	require.Equal(t, int64(12), gotOrgID)
	require.Equal(t, "folder1", gotParent)
}

func TestCascadeWatcher_Run_withoutRestConfig(t *testing.T) {
	w := ProvideCascadeWatcher(nil, apiserver.WithoutRestConfig, nil, nil)
	err := w.Run(context.Background())
	require.NoError(t, err)
}

type recordingFolderMutator struct {
	mu              sync.Mutex
	deleted         []string
	finalizerRemove []string
	deleteErr       error
	removeErr       error
}

func (m *recordingFolderMutator) Delete(_ context.Context, _ string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, name)
	return m.deleteErr
}

func (m *recordingFolderMutator) RemoveCascadeFinalizer(_ context.Context, _ string, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.finalizerRemove = append(m.finalizerRemove, name)
	return m.removeErr
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

	require.Equal(t, []string{"child-a", "child-b"}, mut.deleted)
	require.Empty(t, mut.finalizerRemove)
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

func TestCascadeWatcher_onFolder_skipsWhenNotTerminating(t *testing.T) {
	mut := &recordingFolderMutator{}
	w := &CascadeWatcher{
		folderSearch:  &mockFolderSearcher{search: func(context.Context, int64, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) { return nil, nil }},
		folderMutator: mut,
		log:           slog.Default(),
	}

	w.onFolder(&foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "alive", Namespace: "org-12"}})

	require.Empty(t, mut.deleted)
	require.Empty(t, mut.finalizerRemove)
}
