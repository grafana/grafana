package iam

import (
	"context"
	"net/http/httptest"
	"testing"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestTeamSearchFallback(t *testing.T) {
	testCases := []struct {
		name                  string
		mode                  rest.DualWriterMode
		expectedLegacyCalled  bool
		expectedUnifiedCalled bool
	}{
		{name: "mode 0", mode: rest.Mode0, expectedLegacyCalled: true, expectedUnifiedCalled: false},
		{name: "mode 1", mode: rest.Mode1, expectedLegacyCalled: true, expectedUnifiedCalled: false},
		{name: "mode 2", mode: rest.Mode2, expectedLegacyCalled: true, expectedUnifiedCalled: false},
		{name: "mode 3", mode: rest.Mode3, expectedLegacyCalled: false, expectedUnifiedCalled: true},
		{name: "mode 4", mode: rest.Mode4, expectedLegacyCalled: false, expectedUnifiedCalled: true},
		{name: "mode 5", mode: rest.Mode5, expectedLegacyCalled: false, expectedUnifiedCalled: true},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			mockClient := &MockClient{}
			mockLegacyClient := &MockClient{}

			cfg := &setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {DualWriterMode: testCase.mode},
				},
			}
			dual := dualwrite.ProvideStaticServiceForTests(cfg)
			searchHandler := NewTeamSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil)

			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", "/teams/search", nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

			searchHandler.DoTeamSearch(rr, req)

			if !testCase.expectedUnifiedCalled && mockClient.LastSearchRequest != nil {
				t.Fatalf("expected Unified Search NOT to be called, but it was")
			}
			if testCase.expectedLegacyCalled && mockLegacyClient.LastSearchRequest == nil {
				t.Fatalf("expected Legacy Search to be called, but it was not")
			}
		})
	}
}

type MockClient struct {
	resourcepb.ResourceIndexClient
	resource.ResourceIndex

	// Capture the last SearchRequest for assertions
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
