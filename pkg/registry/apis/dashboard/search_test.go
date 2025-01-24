package dashboard

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"google.golang.org/grpc"
)

func TestSearchFallback(t *testing.T) {
	t.Run("should hit legacy search handler on mode 0", func(t *testing.T) {
		mockClient := &MockClient{}
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode0},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode1},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode2},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode3},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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
		mockLegacyClient := &LegacyMockClient{}

		cfg := &setting.Cfg{
			UnifiedStorage: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {DualWriterMode: rest.Mode5},
			},
		}
		searchHandler := NewSearchHandler(mockClient, tracing.NewNoopTracerService(), cfg, mockLegacyClient)

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

func TestSearchHandlerFields(t *testing.T) {
	// Create a mock client
	mockClient := &MockClient{}

	// Initialize the search handler with the mock client
	searchHandler := SearchHandler{
		log:    log.New("test", "test"),
		client: mockClient,
		tracer: tracing.NewNoopTracerService(),
		cfg:    setting.UnifiedStorageConfig{DualWriterMode: rest.Mode5},
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
}

// MockClient implements the ResourceIndexClient interface for testing
type MockClient struct {
	resource.ResourceIndexClient

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resource.ResourceSearchRequest
}

func (m *MockClient) Search(ctx context.Context, in *resource.ResourceSearchRequest, opts ...grpc.CallOption) (*resource.ResourceSearchResponse, error) {
	m.LastSearchRequest = in

	return &resource.ResourceSearchResponse{}, nil
}

func (m *MockClient) GetStats(ctx context.Context, in *resource.ResourceStatsRequest, opts ...grpc.CallOption) (*resource.ResourceStatsResponse, error) {
	return nil, nil
}

// LegacyMockClient implements the ResourceIndexClient interface for testing
type LegacyMockClient struct {
	resource.ResourceIndexClient

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resource.ResourceSearchRequest
}

func (m *LegacyMockClient) Search(ctx context.Context, in *resource.ResourceSearchRequest) (*resource.ResourceSearchResponse, error) {
	m.LastSearchRequest = in

	return &resource.ResourceSearchResponse{}, nil
}

func (m *LegacyMockClient) GetStats(ctx context.Context, in *resource.ResourceStatsRequest) (*resource.ResourceStatsResponse, error) {
	return nil, nil
}

func (m *LegacyMockClient) DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboard.Dashboard, bool, error) {
	return nil, false, nil
}

func (m *LegacyMockClient) GetDashboard(ctx context.Context, orgId int64, uid string, version int64) (*dashboard.Dashboard, int64, error) {
	return nil, 0, nil
}

func (m *LegacyMockClient) SaveDashboard(ctx context.Context, orgId int64, dash *dashboard.Dashboard) (*dashboard.Dashboard, bool, error) {
	return nil, false, nil
}

func (m *LegacyMockClient) GetLibraryPanels(ctx context.Context, query legacy.LibraryPanelQuery) (*dashboard.LibraryPanelList, error) {
	return nil, nil
}

func (m *LegacyMockClient) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	return 0, nil
}

func (m *LegacyMockClient) ReadResource(context.Context, *resource.ReadRequest) *resource.BackendReadResponse {
	return nil
}

func (m *LegacyMockClient) ListIterator(context.Context, *resource.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *LegacyMockClient) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	return nil, nil
}

func (m *LegacyMockClient) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	return nil, nil
}
