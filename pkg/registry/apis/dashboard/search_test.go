package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestSearchFallback(t *testing.T) {
	t.Run("should hit legacy search handler on mode 0", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode0},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit legacy search handler on mode 1", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit legacy search handler on mode 2", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
		if mockLegacyClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
	})

	t.Run("should hit unified storage search handler on mode 3", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})

	t.Run("should hit unified storage search handler on mode 4", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})

	t.Run("should hit unified storage search handler on mode 5", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient, mockClient, nil)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockClient, mockLegacyClient)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		if mockLegacyClient.LastSearchRequest != nil {
			t.Fatalf("expected Search NOT to be called, but it was")
		}
	})
}

func TestSearchHandler(t *testing.T) {
	t.Run("Multiple comma separated fields will be appended to default dashboard search fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?field=field1&field=field2&field=field3", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"title", "folder", "tags", "field1", "field2", "field3"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("Single field will be appended to default dashboard search fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?field=field1", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"title", "folder", "tags", "field1"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("Passing no fields will search using default dashboard fields", func(t *testing.T) {
		// Create a mock client
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"title", "folder", "tags"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("Sort - default sort by resource then title", func(t *testing.T) {
		rows := make([]*resource.ResourceTableRow, len(mockResults))
		for i, r := range mockResults {
			rows[i] = &resource.ResourceTableRow{
				Key: &resource.ResourceKey{
					Name:     r.Name,
					Resource: r.Resource,
				},
				Cells: [][]byte{
					[]byte(r.Value),
				},
			}
		}

		mockResponse := &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{Name: resource.SEARCH_FIELD_TITLE},
				},
				Rows: rows,
			},
		}
		// Create a mock client
		mockClient := &MockClient{
			MockResponses: []*resource.ResourceSearchResponse{mockResponse},
		}

		features := featuremgmt.WithFeatures()
		// Initialize the search handler with the mock client
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}

		resp := rr.Result()
		defer func() {
			if err := resp.Body.Close(); err != nil {
				t.Fatal(err)
			}
		}()

		p := &v0alpha1.SearchResults{}
		err := json.NewDecoder(resp.Body).Decode(p)
		require.NoError(t, err)
		assert.Equal(t, len(mockResults), len(p.Hits))
		assert.Equal(t, mockResults[3].Value, p.Hits[0].Title)
		assert.Equal(t, mockResults[1].Value, p.Hits[3].Title)
	})
}

func TestSearchHandlerSharedDashboards(t *testing.T) {
	t.Run("should bail out if FlagUnifiedStorageSearchPermissionFiltering is not enabled globally", func(t *testing.T) {
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?folder=sharedwithme", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 1)
	})

	t.Run("should return the dashboards shared with the user", func(t *testing.T) {
		// dashboardSearchRequest
		mockResponse1 := &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "dashboardinroot",
							Resource: "dashboard",
						},
						Cells: [][]byte{[]byte("")}, // root folder doesn't have uid
					},
					{
						Key: &resource.ResourceKey{
							Name:     "dashboardinprivatefolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("privatefolder"), // folder uid
						},
					},
					{
						Key: &resource.ResourceKey{
							Name:     "dashboardinpublicfolder",
							Resource: "dashboard",
						},
						Cells: [][]byte{
							[]byte("publicfolder"), // folder uid
						},
					},
				},
			},
		}

		// folderSearchRequest
		mockResponse2 := &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					{
						Name: "folder",
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "publicfolder",
							Resource: "folder",
						},
						Cells: [][]byte{
							[]byte(""), // root folder uid
						},
					},
				},
			},
		}

		mockClient := &MockClient{
			MockResponses: []*resource.ResourceSearchResponse{mockResponse1, mockResponse2},
		}

		features := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering)
		searchHandler := SearchHandler{
			log:      log.New("test", "test"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/search?folder=sharedwithme", nil)
		req.Header.Add("content-type", "application/json")
		allPermissions := make(map[int64]map[string][]string)
		permissions := make(map[string][]string)
		permissions[dashboards.ActionDashboardsRead] = []string{"dashboards:uid:dashboardinroot", "dashboards:uid:dashboardinprivatefolder", "dashboards:uid:dashboardinpublicfolder"}
		allPermissions[1] = permissions
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1, Permissions: allPermissions}))

		searchHandler.DoSearch(rr, req)

		assert.Equal(t, mockClient.CallCount, 3)

		// first call gets all dashboards user has permission for
		firstCall := mockClient.MockCalls[0]
		assert.Equal(t, firstCall.Options.Fields[0].Values, []string{"dashboardinroot", "dashboardinprivatefolder", "dashboardinpublicfolder"})
		// second call gets folders associated with the previous dashboards
		secondCall := mockClient.MockCalls[1]
		assert.Equal(t, secondCall.Options.Fields[0].Values, []string{"privatefolder", "publicfolder"})
		// lastly, search ONLY for dashboards user has permission to read that are within folders the user does NOT have
		// permission to read
		thirdCall := mockClient.MockCalls[2]
		assert.Equal(t, thirdCall.Options.Fields[0].Values, []string{"dashboardinprivatefolder"})
	})
}

// MockClient implements the ResourceIndexClient interface for testing
type MockClient struct {
	resource.ResourceIndexClient
	resource.ResourceIndex

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resource.ResourceSearchRequest

	MockResponses []*resource.ResourceSearchResponse
	MockCalls     []*resource.ResourceSearchRequest
	CallCount     int
}

type MockResult struct {
	Name     string
	Resource string
	Value    string
}

var mockResults = []MockResult{
	{
		Name:     "d1",
		Resource: "dashboard",
		Value:    "Dashboard 1",
	},
	{
		Name:     "d2",
		Resource: "dashboard",
		Value:    "Dashboard 2",
	},
	{
		Name:     "f2",
		Resource: "folder",
		Value:    "Folder 2",
	},
	{
		Name:     "f1",
		Resource: "folder",
		Value:    "Folder 1",
	},
}

func (m *MockClient) Search(ctx context.Context, in *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	m.LastSearchRequest = in
	m.MockCalls = append(m.MockCalls, in)

	var response *resource.ResourceSearchResponse
	if m.CallCount < len(m.MockResponses) {
		response = m.MockResponses[m.CallCount]
	}

	m.CallCount = m.CallCount + 1

	return response, nil
}
func (m *MockClient) GetStats(ctx context.Context, in *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	return nil, nil
}
func (m *MockClient) CountRepositoryObjects(ctx context.Context, in *resource.CountRepositoryObjectsRequest, opts ...grpc.CallOption) (*resource.CountRepositoryObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) Watch(ctx context.Context, in *resource.WatchRequest, opts ...grpc.CallOption) (resource.ResourceStore_WatchClient, error) {
	return nil, nil
}
func (m *MockClient) Delete(ctx context.Context, in *resource.DeleteRequest, opts ...grpc.CallOption) (*resource.DeleteResponse, error) {
	return nil, nil
}
func (m *MockClient) Create(ctx context.Context, in *resource.CreateRequest, opts ...grpc.CallOption) (*resource.CreateResponse, error) {
	return nil, nil
}
func (m *MockClient) Update(ctx context.Context, in *resource.UpdateRequest, opts ...grpc.CallOption) (*resource.UpdateResponse, error) {
	return nil, nil
}
func (m *MockClient) Read(ctx context.Context, in *resource.ReadRequest, opts ...grpc.CallOption) (*resource.ReadResponse, error) {
	return nil, nil
}
func (m *MockClient) Restore(ctx context.Context, in *resource.RestoreRequest, opts ...grpc.CallOption) (*resource.RestoreResponse, error) {
	return nil, nil
}
func (m *MockClient) GetBlob(ctx context.Context, in *resource.GetBlobRequest, opts ...grpc.CallOption) (*resource.GetBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) PutBlob(ctx context.Context, in *resource.PutBlobRequest, opts ...grpc.CallOption) (*resource.PutBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) List(ctx context.Context, in *resource.ListRequest, opts ...grpc.CallOption) (*resource.ListResponse, error) {
	return nil, nil
}
func (m *MockClient) ListRepositoryObjects(ctx context.Context, in *resource.ListRepositoryObjectsRequest, opts ...grpc.CallOption) (*resource.ListRepositoryObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) IsHealthy(ctx context.Context, in *resource.HealthCheckRequest, opts ...grpc.CallOption) (*resource.HealthCheckResponse, error) {
	return nil, nil
}
func (m *MockClient) BatchProcess(ctx context.Context, opts ...grpc.CallOption) (resource.BatchStore_BatchProcessClient, error) {
	return nil, nil
}
