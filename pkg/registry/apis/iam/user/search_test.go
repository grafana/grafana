package user

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
			searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), searchClient, featuremgmt.WithFeatures(), cfg, nil)

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
	MockError     error
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

	if m.MockError != nil {
		return nil, m.MockError
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

func mockClientWithHits() *MockClient {
	return &MockClient{
		MockResponses: []*resourcepb.ResourceSearchResponse{
			{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: "title"},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "user-1"}, Cells: [][]byte{[]byte("User One")}},
						{Key: &resourcepb.ResourceKey{Name: "user-2"}, Cells: [][]byte{[]byte("User Two")}},
					},
				},
				TotalHits: 2,
			},
		},
	}
}

func TestAccessControl(t *testing.T) {
	partialClient := &mockAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			allowed := map[string]bool{
				"org.users:read":         true,
				"users.permissions:read": true,
				"users.roles:read":       true,
			}
			results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
			for _, check := range req.Checks {
				for _, c := range userAccessControlChecks {
					if c.group == check.Group && c.resource == check.Resource && c.verb == check.Verb {
						results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed[c.action]}
						break
					}
				}
			}
			return authlib.BatchCheckResponse{Results: results}, nil
		},
	}

	perUserClient := &mockAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
			for _, check := range req.Checks {
				allowed := false
				for _, c := range userAccessControlChecks {
					if c.group == check.Group && c.resource == check.Resource && c.verb == check.Verb {
						if check.Name == "user-1" {
							allowed = c.action == "org.users:read" || c.action == "org.users:write"
						}
						break
					}
				}
				results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed}
			}
			return authlib.BatchCheckResponse{Results: results}, nil
		},
	}

	errorClient := &mockAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			return authlib.BatchCheckResponse{}, fmt.Errorf("access service unavailable")
		},
	}

	tests := []struct {
		name      string
		url       string
		client    authlib.AccessClient
		checkHits func(t *testing.T, hits []iamv0.GetSearchUsersUserHit)
	}{
		{
			name:   "param absent - no access control on hits",
			url:    "/searchUsers",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Nil(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "param false - no access control on hits",
			url:    "/searchUsers?accesscontrol=false",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Nil(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "all allowed",
			url:    "/searchUsers?accesscontrol=true",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					require.NotNil(t, hit.AccessControl)
					for _, c := range userAccessControlChecks {
						assert.True(t, hit.AccessControl[c.action], "expected %s to be allowed", c.action)
					}
				}
			},
		},
		{
			name:   "all denied - empty map on hits",
			url:    "/searchUsers?accesscontrol=true",
			client: authlib.FixedAccessClient(false),
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Empty(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "partial permissions",
			url:    "/searchUsers?accesscontrol=true",
			client: partialClient,
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					require.NotNil(t, hit.AccessControl)
					assert.True(t, hit.AccessControl["org.users:read"])
					assert.True(t, hit.AccessControl["users.permissions:read"])
					assert.True(t, hit.AccessControl["users.roles:read"])
					assert.False(t, hit.AccessControl["org.users:add"])
					assert.False(t, hit.AccessControl["org.users:remove"])
					assert.False(t, hit.AccessControl["org.users:write"])
				}
			},
		},
		{
			name:   "per-user scoped permissions",
			url:    "/searchUsers?accesscontrol=true",
			client: perUserClient,
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					if hit.Name == "user-1" {
						require.NotNil(t, hit.AccessControl)
						assert.True(t, hit.AccessControl["org.users:read"])
						assert.True(t, hit.AccessControl["org.users:write"])
						assert.False(t, hit.AccessControl["org.users:add"])
						assert.False(t, hit.AccessControl["org.users:remove"])
					} else {
						assert.Empty(t, hit.AccessControl, "user-2 should have no permissions")
					}
				}
			},
		},
		{
			name:   "access service error - graceful degradation, empty map on hits",
			url:    "/searchUsers?accesscontrol=true",
			client: errorClient,
			checkHits: func(t *testing.T, hits []iamv0.GetSearchUsersUserHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Empty(t, hit.AccessControl)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			searchHandler := NewSearchHandler(
				tracing.NewNoopTracerService(),
				mockClientWithHits(),
				featuremgmt.WithFeatures(),
				&setting.Cfg{},
				tc.client,
			)

			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", tc.url, nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "default"}))

			searchHandler.DoSearch(rr, req)

			require.Equal(t, 200, rr.Code)

			var resp iamv0.GetSearchUsersResponse
			require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
			require.Len(t, resp.Hits, 2)
			tc.checkHits(t, resp.Hits)
		})
	}
}

type mockAccessClient struct {
	batchCheckFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (m *mockAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (m *mockAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *mockAccessClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, info, req)
	}
	return authlib.BatchCheckResponse{}, nil
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
