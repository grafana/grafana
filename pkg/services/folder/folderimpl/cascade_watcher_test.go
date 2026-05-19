package folderimpl

import (
	"context"
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

func TestCountDirectChildFolders_search(t *testing.T) {
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

	count, err := countDirectChildFolders(context.Background(), searcher, 12, "folder1")
	require.NoError(t, err)
	require.Equal(t, 2, count)
	require.Equal(t, int64(12), gotOrgID)
	require.Equal(t, "folder1", gotParent)
}

func TestCascadeWatcher_Run_withoutRestConfig(t *testing.T) {
	w := ProvideCascadeWatcher(nil, apiserver.WithoutRestConfig, nil, nil)
	err := w.Run(context.Background())
	require.NoError(t, err)
}
