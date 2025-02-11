package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestSearchFallback(t *testing.T) {
	t.Run("should hit legacy search handler on mode 0", func(t *testing.T) {
		mockClient := &MockClient{}
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode0},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
		mockUnifiedCtxclient := func(context.Context) resource.ResourceClient { return mockClient }
		mockLegacyClient := &MockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), cfg, mockLegacyClient)
		searchHandler.client = resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, mockUnifiedCtxclient, mockLegacyClient)

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
	// Create a mock client
	mockClient := &MockClient{}

	// Initialize the search handler with the mock client
	searchHandler := SearchHandler{
		log:    log.New("test", "test"),
		client: func(context.Context) resource.ResourceIndexClient { return mockClient },
		tracer: tracing.NewNoopTracerService(),
	}

	t.Run("Multiple comma separated fields will be appended to default dashboard search fields", func(t *testing.T) {
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

// MockClient implements the ResourceIndexClient interface for testing
type MockClient struct {
	resource.ResourceIndexClient
	resource.ResourceIndex

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resource.ResourceSearchRequest
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

	return &resource.ResourceSearchResponse{
		Results: &resource.ResourceTable{
			Columns: []*resource.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_TITLE},
			},
			Rows: rows,
		},
	}, nil
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
