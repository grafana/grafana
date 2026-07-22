package user

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	legacyuser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
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
		{name: "should hit legacy search handler on mode 3", mode: rest.Mode3, expectUnified: false},
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
			dual := dualwrite.ProvideServiceForTests(cfg)

			searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0.UserResourceInfo.GroupResource(), mockClient, mockLegacyClient)
			searchHandler := NewSearchHandler(tracing.NewNoopTracerService(), searchClient, cfg, nil)

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
func (m *MockClient) RecordEvent(ctx context.Context, in *resourcepb.RecordEventRequest, opts ...grpc.CallOption) (*resourcepb.RecordEventResponse, error) {
	return nil, nil
}
func (m *MockClient) GetResourceDailyStats(ctx context.Context, in *resourcepb.GetResourceDailyStatsRequest, opts ...grpc.CallOption) (resourcepb.ResourceStats_GetResourceDailyStatsClient, error) {
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

func (m *MockClient) ListStoredResources(ctx context.Context, in *resourcepb.ListStoredResourcesRequest, opts ...grpc.CallOption) (*resourcepb.ListStoredResourcesResponse, error) {
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

func TestSearchSort(t *testing.T) {
	loginField := resource.SEARCH_FIELD_PREFIX + builders.USER_LOGIN
	emailField := resource.SEARCH_FIELD_PREFIX + builders.USER_EMAIL

	tests := []struct {
		name     string
		url      string
		expected []*resourcepb.ResourceSearchRequest_Sort
	}{
		{
			name:     "no sort param defaults to login ascending",
			url:      "/searchUsers",
			expected: []*resourcepb.ResourceSearchRequest_Sort{{Field: loginField, Desc: false}},
		},
		{
			name:     "explicit ascending sort is respected",
			url:      "/searchUsers?sort=email",
			expected: []*resourcepb.ResourceSearchRequest_Sort{{Field: emailField, Desc: false}},
		},
		{
			name:     "explicit descending sort is respected",
			url:      "/searchUsers?sort=-login",
			expected: []*resourcepb.ResourceSearchRequest_Sort{{Field: loginField, Desc: true}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockClient := mockClientWithHits()
			searchHandler := NewSearchHandler(
				tracing.NewNoopTracerService(),
				mockClient,
				&setting.Cfg{},
				authlib.FixedAccessClient(true),
			)

			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", tc.url, nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &legacyuser.SignedInUser{Namespace: "default"}))

			searchHandler.DoSearch(rr, req)

			require.Equal(t, 200, rr.Code)
			require.NotNil(t, mockClient.LastSearchRequest)
			require.Equal(t, tc.expected, mockClient.LastSearchRequest.SortBy)
		})
	}
}

// The authz model's "user" type defines only get/update/delete relations
// (schema_core.fga). A check whose verb maps to any other relation fails the
// whole batch check at the authz server, blanking out all metadata, so guard
// against re-adding one for the "users" resource.
func TestUserAccessControlChecksUseSupportedVerbs(t *testing.T) {
	supportedUserVerbs := map[string]bool{
		utils.VerbGet:    true,
		utils.VerbList:   true,
		utils.VerbWatch:  true,
		utils.VerbUpdate: true,
		utils.VerbPatch:  true,
		utils.VerbDelete: true,
	}
	for _, c := range userAccessControlChecks {
		if c.resource != "users" {
			continue
		}
		assert.True(t, supportedUserVerbs[c.verb],
			"check %q uses verb %q whose relation is not defined on the authz \"user\" type", c.action, c.verb)
	}
}

func TestAccessControl(t *testing.T) {
	partialClient := &mockAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			allowed := map[string]bool{
				"org.users:read":   true,
				"users.roles:read": true,
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
					assert.True(t, hit.AccessControl["users.roles:read"])
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

func TestParseResults(t *testing.T) {
	i64 := func(v int64) []byte {
		b := make([]byte, 8)
		binary.BigEndian.PutUint64(b, uint64(v))
		return b
	}

	// Columns in the order the search handler requests them.
	allColumns := []*resourcepb.ResourceTableColumnDefinition{
		{Name: resource.SEARCH_FIELD_TITLE},
		{Name: builders.USER_EMAIL},
		{Name: builders.USER_LOGIN},
		{Name: builders.USER_LAST_SEEN_AT},
		{Name: builders.USER_ROLE},
		{Name: builders.USER_DISABLED},
		{Name: resource.SEARCH_FIELD_CREATED},
		{Name: legacyIDField},
	}
	created := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC).UnixMilli()
	lastSeen := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC).Unix()

	t.Run("nil response returns empty result", func(t *testing.T) {
		sr, err := ParseResults(nil)
		require.NoError(t, err)
		assert.Empty(t, sr.Hits)
		assert.Zero(t, sr.TotalHits)
	})

	t.Run("error in response is propagated", func(t *testing.T) {
		_, err := ParseResults(&resourcepb.ResourceSearchResponse{
			Error: &resourcepb.ErrorResult{Code: 500, Message: "boom"},
		})
		require.Error(t, err)
	})

	t.Run("nil results returns empty", func(t *testing.T) {
		sr, err := ParseResults(&resourcepb.ResourceSearchResponse{TotalHits: 5})
		require.NoError(t, err)
		assert.Empty(t, sr.Hits)
	})

	t.Run("column/cell count mismatch errors", func(t *testing.T) {
		_, err := ParseResults(&resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: allColumns,
				Rows: []*resourcepb.ResourceTableRow{
					{Key: &resourcepb.ResourceKey{Name: "uid-1"}, Cells: [][]byte{[]byte("only one cell")}},
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("maps all columns and carries totals/score", func(t *testing.T) {
		resp := &resourcepb.ResourceSearchResponse{
			TotalHits: 2,
			QueryCost: 1.5,
			MaxScore:  2.5,
			Results: &resourcepb.ResourceTable{
				Columns: allColumns,
				Rows: []*resourcepb.ResourceTableRow{
					{
						Key: &resourcepb.ResourceKey{Name: "uid-1"},
						Cells: [][]byte{
							[]byte("John Doe"),
							[]byte("jdoe@example.com"),
							[]byte("jdoe"),
							i64(lastSeen),
							[]byte("Admin"),
							{1},
							i64(created),
							[]byte("42"),
						},
					},
					// Second row exercises zero/empty cells -> fields keep zero values.
					{
						Key:   &resourcepb.ResourceKey{Name: "uid-2"},
						Cells: [][]byte{[]byte("Jane"), nil, []byte("jane"), nil, []byte("Viewer"), {0}, nil, nil},
					},
				},
			},
		}

		sr, err := ParseResults(resp)
		require.NoError(t, err)
		require.Len(t, sr.Hits, 2)
		assert.Equal(t, int64(2), sr.TotalHits)
		assert.Equal(t, 1.5, sr.QueryCost)
		assert.Equal(t, 2.5, sr.MaxScore)

		full := sr.Hits[0]
		assert.Equal(t, "uid-1", full.Name)
		assert.Equal(t, "John Doe", full.Title)
		assert.Equal(t, "jdoe@example.com", full.Email)
		assert.Equal(t, "jdoe", full.Login)
		assert.Equal(t, "Admin", full.Role)
		assert.Equal(t, lastSeen, full.LastSeenAt)
		assert.NotEmpty(t, full.LastSeenAtAge)
		assert.True(t, full.Disabled)
		assert.Equal(t, created, full.Created)
		assert.Equal(t, int64(42), full.InternalId)

		sparse := sr.Hits[1]
		assert.Equal(t, "uid-2", sparse.Name)
		assert.Equal(t, "Jane", sparse.Title)
		assert.Equal(t, "jane", sparse.Login)
		assert.Equal(t, "Viewer", sparse.Role)
		assert.Empty(t, sparse.Email)
		assert.Zero(t, sparse.LastSeenAt)
		assert.Empty(t, sparse.LastSeenAtAge)
		assert.False(t, sparse.Disabled)
		assert.Zero(t, sparse.Created)
		assert.Zero(t, sparse.InternalId)
	})

	t.Run("only requested columns are populated", func(t *testing.T) {
		sr, err := ParseResults(&resourcepb.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{{Name: builders.USER_LOGIN}},
				Rows: []*resourcepb.ResourceTableRow{
					{Key: &resourcepb.ResourceKey{Name: "uid-3"}, Cells: [][]byte{[]byte("viewer")}},
				},
			},
		})
		require.NoError(t, err)
		require.Len(t, sr.Hits, 1)
		assert.Equal(t, "uid-3", sr.Hits[0].Name)
		assert.Equal(t, "viewer", sr.Hits[0].Login)
		assert.Empty(t, sr.Hits[0].Role)
		assert.Zero(t, sr.Hits[0].InternalId)
	})

	t.Run("ignores lastSeenAt cell with unexpected length", func(t *testing.T) {
		sr, err := ParseResults(&resourcepb.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{{Name: builders.USER_LAST_SEEN_AT}},
				Rows: []*resourcepb.ResourceTableRow{
					{Key: &resourcepb.ResourceKey{Name: "uid-4"}, Cells: [][]byte{[]byte("not-8-bytes")}},
				},
			},
		})
		require.NoError(t, err)
		require.Len(t, sr.Hits, 1)
		assert.Zero(t, sr.Hits[0].LastSeenAt)
		assert.Empty(t, sr.Hits[0].LastSeenAtAge)
	})
}
