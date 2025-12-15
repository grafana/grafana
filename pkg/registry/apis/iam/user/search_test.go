package user

import (
	"context"
	"net/http/httptest"
	"testing"

	"google.golang.org/grpc"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSearchFallback(t *testing.T) {
	tests := []struct {
		name          string
		mode          rest.DualWriterMode
		expectUnified bool
	}{
		{name: "should hit legacy search handler on mode 0", mode: rest.Mode0, expectUnified: false},
		{name: "should hit legacy search handler on mode 1", mode: rest.Mode1, expectUnified: false},
		{name: "should hit legacy search handler on mode 2", mode: rest.Mode2, expectUnified: false},
		{name: "should hit unified storage search handler on mode 3", mode: rest.Mode3, expectUnified: true},
		{name: "should hit unified storage search handler on mode 4", mode: rest.Mode4, expectUnified: true},
		{name: "should hit unified storage search handler on mode 5", mode: rest.Mode5, expectUnified: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &MockClient{}
			mockLegacyClient := &MockClient{}

			cfg := &setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {DualWriterMode: tt.mode},
				},
			}
			dual := dualwrite.ProvideStaticServiceForTests(cfg)

			searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0.UserResourceInfo.GroupResource(), mockClient, mockLegacyClient, featuremgmt.WithFeatures())
			searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), searchClient, featuremgmt.WithFeatures(), cfg)

			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", "/searchUsers", nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "test"}))

			searchHandler.DoSearch(rr, req)

			if tt.expectUnified {
				if mockClient.LastSearchRequest == nil {
					t.Fatalf("expected Unified Search to be called, but it was not")
				}
			} else {
				if mockLegacyClient.LastSearchRequest == nil {
					t.Fatalf("expected Legacy Search to be called, but it was not")
				}
			}
		})
	}
}

// MockClient implements the ResourceIndexClient interface for testing
type MockClient struct {
	resourcepb.ResourceIndexClient
	resource.ResourceIndex

	LastSearchRequest *resourcepb.ResourceSearchRequest

	MockResponses []*resourcepb.ResourceSearchResponse
	MockCalls     []*resourcepb.ResourceSearchRequest
	CallCount     int
}

func (m *MockClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	m.LastSearchRequest = in
	m.MockCalls = append(m.MockCalls, in)

	var response *resourcepb.ResourceSearchResponse
	if m.CallCount < len(m.MockResponses) {
		response = m.MockResponses[m.CallCount]
	}

	m.CallCount = m.CallCount + 1

	if response == nil {
		response = &resourcepb.ResourceSearchResponse{}
	}

	return response, nil
}
func (m *MockClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (m *MockClient) CountManagedObjects(ctx context.Context, in *resourcepb.CountManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) Watch(ctx context.Context, in *resourcepb.WatchRequest, opts ...grpc.CallOption) (resourcepb.ResourceStore_WatchClient, error) {
	return nil, nil
}
func (m *MockClient) Delete(ctx context.Context, in *resourcepb.DeleteRequest, opts ...grpc.CallOption) (*resourcepb.DeleteResponse, error) {
	return nil, nil
}
func (m *MockClient) Create(ctx context.Context, in *resourcepb.CreateRequest, opts ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	return nil, nil
}
func (m *MockClient) Update(ctx context.Context, in *resourcepb.UpdateRequest, opts ...grpc.CallOption) (*resourcepb.UpdateResponse, error) {
	return nil, nil
}
func (m *MockClient) Read(ctx context.Context, in *resourcepb.ReadRequest, opts ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	return nil, nil
}
func (m *MockClient) GetBlob(ctx context.Context, in *resourcepb.GetBlobRequest, opts ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) PutBlob(ctx context.Context, in *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	return nil, nil
}
func (m *MockClient) List(ctx context.Context, in *resourcepb.ListRequest, opts ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	return nil, nil
}
func (m *MockClient) ListManagedObjects(ctx context.Context, in *resourcepb.ListManagedObjectsRequest, opts ...grpc.CallOption) (*resourcepb.ListManagedObjectsResponse, error) {
	return nil, nil
}
func (m *MockClient) IsHealthy(ctx context.Context, in *resourcepb.HealthCheckRequest, opts ...grpc.CallOption) (*resourcepb.HealthCheckResponse, error) {
	return nil, nil
}
func (m *MockClient) BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error) {
	return nil, nil
}
func (m *MockClient) UpdateIndex(ctx context.Context, reason string) error {
	return nil
}

func (m *MockClient) GetQuotaUsage(ctx context.Context, req *resourcepb.QuotaUsageRequest, opts ...grpc.CallOption) (*resourcepb.QuotaUsageResponse, error) {
	return nil, nil
}

func TestEscapeBleveQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{input: "normal", expected: "normal"},
		{input: "*", expected: "\\*"},
		{input: "?", expected: "\\?"},
		{input: "\\", expected: "\\\\"},
		{input: "\\*", expected: "\\\\\\*"},
		{input: "*\\?", expected: "\\*\\\\\\?"},
		{input: "foo*bar", expected: "foo\\*bar"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := escapeBleveQuery(tt.input)
			if got != tt.expected {
				t.Errorf("escapeBleveQuery(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
