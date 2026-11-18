package libraryelements

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeResourceIndexClient implements only Search; any other method call panics, which is fine since
// SearchConnectedDashboardsFinder only ever calls Search.
type fakeResourceIndexClient struct {
	resourcepb.ResourceIndexClient
	req  *resourcepb.ResourceSearchRequest
	resp *resourcepb.ResourceSearchResponse
	err  error
}

func (f *fakeResourceIndexClient) Search(_ context.Context, in *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	f.req = in
	return f.resp, f.err
}

func TestSearchConnectedDashboardsFinder_GetDashboardsByLibraryPanelUID(t *testing.T) {
	searcher := &fakeResourceIndexClient{
		resp: &resourcepb.ResourceSearchResponse{
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
			Fields: []*resourcepb.ResourceSearchField{
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
				{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceSearchField_INT64},
				{Name: resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceSearchField_STRING},
			},
			Rows: []*resourcepb.ResourceSearchRow{
				{
					Key: &resourcepb.ResourceKey{Name: "dashboard1", Resource: "dashboard"},
					Values: []*resourcepb.ResourceSearchValue{
						{FieldIndex: 0, StringValues: []string{"folder1"}},
						{FieldIndex: 1, Int64Values: []int64{1}},
						{FieldIndex: 2, StringValues: []string{"1"}},
					},
				},
			},
			TotalHits: 1,
		},
	}
	finder := &SearchConnectedDashboardsFinder{Searcher: searcher}
	ctx := apirequest.WithNamespace(context.Background(), "org-5")

	results, err := finder.GetDashboardsByLibraryPanelUID(ctx, "test-library-panel", 5)
	require.NoError(t, err)
	assert.Equal(t, []*dashboards.DashboardRef{
		{UID: "dashboard1", FolderUID: "folder1", ID: 1},
	}, results)

	// The request is scoped to the right namespace and filters on the library panel UID.
	require.NotNil(t, searcher.req)
	assert.Equal(t, "org-5", searcher.req.Options.Key.Namespace)
	require.Len(t, searcher.req.Options.Fields, 1)
	assert.Equal(t, []string{"test-library-panel"}, searcher.req.Options.Fields[0].Values)
}

func TestSearchConnectedDashboardsFinder_GetDashboardsByLibraryPanelUID_Error(t *testing.T) {
	wantErr := assert.AnError
	finder := &SearchConnectedDashboardsFinder{Searcher: &fakeResourceIndexClient{err: wantErr}}
	ctx := apirequest.WithNamespace(context.Background(), "org-5")

	_, err := finder.GetDashboardsByLibraryPanelUID(ctx, "test-library-panel", 5)
	assert.ErrorIs(t, err, wantErr)
}

func TestSearchConnectedDashboardsFinder_GetDashboardsByLibraryPanelUID_MissingNamespace(t *testing.T) {
	finder := &SearchConnectedDashboardsFinder{Searcher: &fakeResourceIndexClient{}}

	_, err := finder.GetDashboardsByLibraryPanelUID(context.Background(), "test-library-panel", 5)
	assert.Error(t, err)
}

func TestSearchConnectedDashboardsFinder_GetDashboardsByLibraryPanelUID_EmptyNamespace(t *testing.T) {
	// NamespaceFrom reports ok=true even for an explicitly-empty namespace; this must still error
	// rather than search unscoped across every tenant.
	searcher := &fakeResourceIndexClient{}
	finder := &SearchConnectedDashboardsFinder{Searcher: searcher}
	ctx := apirequest.WithNamespace(context.Background(), "")

	_, err := finder.GetDashboardsByLibraryPanelUID(ctx, "test-library-panel", 5)
	assert.Error(t, err)
	assert.Nil(t, searcher.req, "must not search before rejecting the empty namespace")
}
