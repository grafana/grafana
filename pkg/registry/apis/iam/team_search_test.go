package iam

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

func TestTeamSearchHandler(t *testing.T) {
	t.Run("search using default team search fields", func(t *testing.T) {
		mockClient := &MockClient{}

		features := featuremgmt.WithFeatures()
		searchHandler := TeamSearchHandler{
			log:      log.New("grafana-apiserver.teams.search"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoTeamSearch(rr, req)

		if mockClient.LastSearchRequest == nil {
			t.Fatalf("expected Search to be called, but it was not")
		}
		expectedFields := []string{"email", "provisioned", "externalUID"}
		if fmt.Sprintf("%v", mockClient.LastSearchRequest.Fields) != fmt.Sprintf("%v", expectedFields) {
			t.Errorf("expected fields %v, got %v", expectedFields, mockClient.LastSearchRequest.Fields)
		}
	})

	t.Run("returns error if search fails", func(t *testing.T) {
		mockClient := &MockClient{
			MockError: errors.New("search failed"),
		}

		features := featuremgmt.WithFeatures()
		searchHandler := TeamSearchHandler{
			log:      log.New("grafana-apiserver.teams.search"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: features,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search?query=test", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoTeamSearch(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Fatalf("expected StatusInternalServerError, got %d", rr.Code)
		}
	})

	t.Run("should calculate offset and page parameters", func(t *testing.T) {
		limit := 50
		for i, tt := range []struct {
			offset         int
			page           int
			expectedOffset int
			expectedPage   int
		}{
			{
				offset:         0,
				page:           0,
				expectedOffset: 0,
				expectedPage:   1,
			},
			{
				offset:         0,
				page:           1,
				expectedOffset: 0,
				expectedPage:   1,
			},
			{
				offset:         0,
				page:           2,
				expectedOffset: 50,
				expectedPage:   2,
			},
			{
				offset:         0,
				page:           3,
				expectedOffset: 100,
				expectedPage:   3,
			},
			{
				offset:         50,
				page:           0,
				expectedOffset: 50,
				expectedPage:   2,
			},
			{
				offset:         100,
				page:           0,
				expectedOffset: 100,
				expectedPage:   3,
			},
			{
				offset:         149,
				page:           0,
				expectedOffset: 149,
				expectedPage:   3,
			},
			{
				offset:         150,
				page:           0,
				expectedOffset: 150,
				expectedPage:   4,
			},
		} {
			mockClient := &MockClient{}

			cfg := &setting.Cfg{
				UnifiedStorage: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {DualWriterMode: rest.Mode0},
				},
			}
			dual := dualwrite.ProvideStaticServiceForTests(cfg)
			searchHandler := NewTeamSearchHandler(tracing.NewNoopTracerService(), dual, mockClient, mockClient, nil)

			rr := httptest.NewRecorder()
			endpoint := fmt.Sprintf("/teams/search?limit=%d", limit)
			if tt.offset > 0 {
				endpoint = fmt.Sprintf("%s&offset=%d", endpoint, tt.offset)
			}
			if tt.page > 0 {
				endpoint = fmt.Sprintf("%s&page=%d", endpoint, tt.page)
			}

			req := httptest.NewRequest("GET", endpoint, nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

			searchHandler.DoTeamSearch(rr, req)

			if mockClient.LastSearchRequest == nil {
				t.Fatalf("expected Team Search to be called, but it was not")
			}

			require.Equal(t, tt.expectedOffset, int(mockClient.LastSearchRequest.Offset), fmt.Sprintf("mismatch offset in test %d", i))
			require.Equal(t, tt.expectedPage, int(mockClient.LastSearchRequest.Page), fmt.Sprintf("mismatch page in test %d", i))
		}
	})
}

type MockClient struct {
	resourcepb.ResourceIndexClient
	resource.ResourceIndex

	// Capture the last SearchRequest for assertions
	LastSearchRequest *resourcepb.ResourceSearchRequest

	MockResponses []*resourcepb.ResourceSearchResponse
	MockError     error
	MockCalls     []*resourcepb.ResourceSearchRequest
	CallCount     int
}

func (m *MockClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	if m.MockError != nil {
		return nil, m.MockError
	}

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
func (m *MockClient) GetQuotaUsage(ctx context.Context, in *resourcepb.QuotaUsageRequest, opts ...grpc.CallOption) (*resourcepb.QuotaUsageResponse, error) {
	return nil, nil
}
