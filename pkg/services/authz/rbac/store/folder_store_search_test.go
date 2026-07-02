package store

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type fakeSearcher struct {
	resp  *resourcepb.ResourceSearchResponse
	err   error
	calls int
}

func (f *fakeSearcher) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	f.calls++
	return f.resp, f.err
}

func TestAPIFolderStore_ListFoldersViaSearch(t *testing.T) {
	searcher := &fakeSearcher{resp: &resourcepb.ResourceSearchResponse{
		TotalHits: 3,
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: "title", Type: resourcepb.ResourceTableColumnDefinition_STRING},
				{Name: "folder", Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: []*resourcepb.ResourceTableRow{
				// root folder: no parent
				{Key: &resourcepb.ResourceKey{Name: "root-1", Resource: "folders"}, Cells: [][]byte{[]byte("Root 1"), []byte("")}},
				// nested folder: parent root-1
				{Key: &resourcepb.ResourceKey{Name: "child-1", Resource: "folders"}, Cells: [][]byte{[]byte("Child 1"), []byte("root-1")}},
				// parent reported as the general folder: treated as no parent
				{Key: &resourcepb.ResourceKey{Name: "top-2", Resource: "folders"}, Cells: [][]byte{[]byte("Top 2"), []byte("general")}},
			},
		},
	}}

	s := NewAPIFolderStore(tracing.InitializeTracerForTest(), prometheus.NewRegistry(), nil).WithSearcher(searcher)

	folders, err := s.ListFolders(context.Background(), types.NamespaceInfo{Value: "default", OrgID: 1})
	require.NoError(t, err)
	require.Len(t, folders, 3)
	assert.Equal(t, 1, searcher.calls, "all folders fetched in a single search call")

	parents := make(map[string]*string, len(folders))
	for _, f := range folders {
		parents[f.UID] = f.ParentUID
	}

	assert.Nil(t, parents["root-1"], "root folder has no parent")
	if assert.NotNil(t, parents["child-1"]) {
		assert.Equal(t, "root-1", *parents["child-1"], "nested folder keeps its parent")
	}
	assert.Nil(t, parents["top-2"], "general/root parent is treated as no parent")
}
