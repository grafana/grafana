package dashboard

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"google.golang.org/grpc"
)

func TestSearchHandlerFields(t *testing.T) {
	// Create a mock client
	mockClient := &MockClient{}

	// Initialize the search handler with the mock client
	searchHandler := SearchHandler{
		log:    log.New("test", "test"),
		client: mockClient,
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

func (m *MockClient) History(ctx context.Context, in *resource.HistoryRequest, opts ...grpc.CallOption) (*resource.HistoryResponse, error) {
	return nil, nil
}
