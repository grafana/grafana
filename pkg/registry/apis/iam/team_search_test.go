package iam

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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
		{name: "mode 3", mode: rest.Mode3, expectedLegacyCalled: true, expectedUnifiedCalled: false},
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
			dual := dualwrite.ProvideServiceForTests(cfg)
			searchHandler := NewTeamSearchHandler(tracing.NewNoopTracerService(), dual, mockLegacyClient, mockClient, nil, nil)

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
		expectedFields := []string{"title", "fields.email", "fields.provisioned", "fields.externalUID"}
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
			dual := dualwrite.ProvideServiceForTests(cfg)
			searchHandler := NewTeamSearchHandler(tracing.NewNoopTracerService(), dual, mockClient, mockClient, nil, nil)

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

	t.Run("returns 400 for invalid sort field", func(t *testing.T) {
		mockClient := &MockClient{}

		searchHandler := &TeamSearchHandler{
			log:      log.New("grafana-apiserver.teams.search"),
			client:   mockClient,
			tracer:   tracing.NewNoopTracerService(),
			features: featuremgmt.WithFeatures(),
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search?sort=invalid", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

		searchHandler.DoTeamSearch(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Nil(t, mockClient.LastSearchRequest, "Search should not be called for invalid sort field")
	})

	t.Run("accepts valid sort fields", func(t *testing.T) {
		for _, sortParam := range []string{"title", "-title", "email", "-email"} {
			t.Run(sortParam, func(t *testing.T) {
				mockClient := &MockClient{}

				searchHandler := &TeamSearchHandler{
					log:      log.New("grafana-apiserver.teams.search"),
					client:   mockClient,
					tracer:   tracing.NewNoopTracerService(),
					features: featuremgmt.WithFeatures(),
				}

				rr := httptest.NewRecorder()
				req := httptest.NewRequest("GET", "/teams/search?sort="+sortParam, nil)
				req.Header.Add("content-type", "application/json")
				req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test"}))

				searchHandler.DoTeamSearch(rr, req)

				assert.NotEqual(t, http.StatusBadRequest, rr.Code)
				require.NotNil(t, mockClient.LastSearchRequest)
				require.Len(t, mockClient.LastSearchRequest.SortBy, 1)
			})
		}
	})
}

func TestTeamAccessControl(t *testing.T) {
	partialClient := &mockTeamAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			allowed := map[string]bool{
				"teams:read":             true,
				"teams.permissions:read": true,
				"teams.roles:read":       true,
			}
			results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
			for _, check := range req.Checks {
				for _, c := range teamAccessControlChecks {
					if c.group == check.Group && c.resource == check.Resource && c.verb == check.Verb {
						results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed[c.action]}
						break
					}
				}
			}
			return authlib.BatchCheckResponse{Results: results}, nil
		},
	}

	perTeamClient := &mockTeamAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
			for _, check := range req.Checks {
				allowed := false
				for _, c := range teamAccessControlChecks {
					if c.group == check.Group && c.resource == check.Resource && c.verb == check.Verb {
						if check.Name == "team-1" {
							allowed = c.action == "teams:read" || c.action == "teams:write"
						}
						break
					}
				}
				results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: allowed}
			}
			return authlib.BatchCheckResponse{Results: results}, nil
		},
	}

	errorClient := &mockTeamAccessClient{
		batchCheckFunc: func(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			return authlib.BatchCheckResponse{}, fmt.Errorf("access service unavailable")
		},
	}

	tests := []struct {
		name      string
		url       string
		client    authlib.AccessClient
		checkHits func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit)
	}{
		{
			name:   "param absent - no access control on hits",
			url:    "/teams/search",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Nil(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "param false - no access control on hits",
			url:    "/teams/search?accesscontrol=false",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Nil(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "all allowed",
			url:    "/teams/search?accesscontrol=true",
			client: authlib.FixedAccessClient(true),
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					require.NotNil(t, hit.AccessControl)
					for _, c := range teamAccessControlChecks {
						assert.True(t, hit.AccessControl[c.action], "expected %s to be allowed", c.action)
					}
				}
			},
		},
		{
			name:   "all denied - empty map on hits",
			url:    "/teams/search?accesscontrol=true",
			client: authlib.FixedAccessClient(false),
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Empty(t, hit.AccessControl)
				}
			},
		},
		{
			name:   "partial permissions",
			url:    "/teams/search?accesscontrol=true",
			client: partialClient,
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					require.NotNil(t, hit.AccessControl)
					assert.True(t, hit.AccessControl["teams:read"])
					assert.True(t, hit.AccessControl["teams.permissions:read"])
					assert.True(t, hit.AccessControl["teams.roles:read"])
					assert.False(t, hit.AccessControl["teams:write"])
					assert.False(t, hit.AccessControl["teams:delete"])
					assert.False(t, hit.AccessControl["teams.permissions:write"])
				}
			},
		},
		{
			name:   "per-team scoped permissions",
			url:    "/teams/search?accesscontrol=true",
			client: perTeamClient,
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					if hit.Name == "team-1" {
						require.NotNil(t, hit.AccessControl)
						assert.True(t, hit.AccessControl["teams:read"])
						assert.True(t, hit.AccessControl["teams:write"])
						assert.False(t, hit.AccessControl["teams:delete"])
						assert.False(t, hit.AccessControl["teams.permissions:write"])
					} else {
						assert.Empty(t, hit.AccessControl, "team-2 should have no permissions")
					}
				}
			},
		},
		{
			name:   "access service error - graceful degradation, empty map on hits",
			url:    "/teams/search?accesscontrol=true",
			client: errorClient,
			checkHits: func(t *testing.T, hits []iamv0alpha1.GetSearchTeamsTeamHit) {
				t.Helper()
				for _, hit := range hits {
					assert.Empty(t, hit.AccessControl)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			searchHandler := &TeamSearchHandler{
				log:          log.New("grafana-apiserver.teams.search"),
				client:       mockTeamClientWithHits(),
				tracer:       tracing.NewNoopTracerService(),
				features:     featuremgmt.WithFeatures(),
				accessClient: tc.client,
			}

			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", tc.url, nil)
			req.Header.Add("content-type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "default"}))

			searchHandler.DoTeamSearch(rr, req)

			require.Equal(t, 200, rr.Code)

			var resp iamv0alpha1.GetSearchTeamsResponse
			require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
			require.Len(t, resp.Hits, 2)
			tc.checkHits(t, resp.Hits)
		})
	}
}

func TestTeamSearchMemberCount(t *testing.T) {
	mockLister := &mockTeamBindingLister{
		listFunc: func(_ context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
			return &iamv0alpha1.TeamBindingList{Items: make([]iamv0alpha1.TeamBinding, 3)}, nil
		},
	}

	t.Run("membercount absent - no member counts on hits", func(t *testing.T) {
		searchHandler := &TeamSearchHandler{
			log:              log.New("grafana-apiserver.teams.search"),
			client:           mockTeamClientWithHits(),
			tracer:           tracing.NewNoopTracerService(),
			features:         featuremgmt.WithFeatures(),
			teamBindingStore: mockLister,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "default"}))

		searchHandler.DoTeamSearch(rr, req)

		require.Equal(t, 200, rr.Code)

		var resp iamv0alpha1.GetSearchTeamsResponse
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		require.Len(t, resp.Hits, 2)
		for _, hit := range resp.Hits {
			assert.Nil(t, hit.MemberCount, "member count should be nil when membercount param is absent")
		}
	})

	t.Run("membercount=false - no member counts on hits", func(t *testing.T) {
		searchHandler := &TeamSearchHandler{
			log:              log.New("grafana-apiserver.teams.search"),
			client:           mockTeamClientWithHits(),
			tracer:           tracing.NewNoopTracerService(),
			features:         featuremgmt.WithFeatures(),
			teamBindingStore: mockLister,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search?membercount=false", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "default"}))

		searchHandler.DoTeamSearch(rr, req)

		require.Equal(t, 200, rr.Code)

		var resp iamv0alpha1.GetSearchTeamsResponse
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		require.Len(t, resp.Hits, 2)
		for _, hit := range resp.Hits {
			assert.Nil(t, hit.MemberCount, "member count should be nil when membercount=false")
		}
	})

	t.Run("membercount=true - member counts populated", func(t *testing.T) {
		searchHandler := &TeamSearchHandler{
			log:              log.New("grafana-apiserver.teams.search"),
			client:           mockTeamClientWithHits(),
			tracer:           tracing.NewNoopTracerService(),
			features:         featuremgmt.WithFeatures(),
			teamBindingStore: mockLister,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search?membercount=true", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "default"}))

		searchHandler.DoTeamSearch(rr, req)

		require.Equal(t, 200, rr.Code)

		var resp iamv0alpha1.GetSearchTeamsResponse
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		require.Len(t, resp.Hits, 2)
		for _, hit := range resp.Hits {
			require.NotNil(t, hit.MemberCount, "member count should be populated when membercount=true")
			assert.Equal(t, int64(3), *hit.MemberCount, "member count should be populated when membercount=true")
		}
	})

	t.Run("membercount=true - lister error returns 500", func(t *testing.T) {
		errorLister := &mockTeamBindingLister{
			listFunc: func(_ context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
				return nil, fmt.Errorf("store unavailable")
			},
		}

		searchHandler := &TeamSearchHandler{
			log:              log.New("grafana-apiserver.teams.search"),
			client:           mockTeamClientWithHits(),
			tracer:           tracing.NewNoopTracerService(),
			features:         featuremgmt.WithFeatures(),
			teamBindingStore: errorLister,
		}

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/teams/search?membercount=true", nil)
		req.Header.Add("content-type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "default"}))

		searchHandler.DoTeamSearch(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestEnrichWithMemberCounts(t *testing.T) {
	t.Run("all succeed - sets correct member counts", func(t *testing.T) {
		mockLister := &mockTeamBindingLister{
			listFunc: func(_ context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
				teamName, _ := options.FieldSelector.RequiresExactMatch("spec.teamRef.name")
				switch teamName {
				case "team-1":
					return &iamv0alpha1.TeamBindingList{Items: make([]iamv0alpha1.TeamBinding, 3)}, nil
				case "team-2":
					return &iamv0alpha1.TeamBindingList{Items: make([]iamv0alpha1.TeamBinding, 0)}, nil
				default:
					return &iamv0alpha1.TeamBindingList{}, nil
				}
			},
		}

		handler := &TeamSearchHandler{
			log:              log.New("test"),
			tracer:           tracing.NewNoopTracerService(),
			teamBindingStore: mockLister,
		}

		hits := []iamv0alpha1.GetSearchTeamsTeamHit{
			{Name: "team-1"},
			{Name: "team-2"},
		}

		err := handler.enrichWithMemberCounts(context.Background(), "default", hits)
		require.NoError(t, err)
		require.NotNil(t, hits[0].MemberCount)
		assert.Equal(t, int64(3), *hits[0].MemberCount)
		require.NotNil(t, hits[1].MemberCount)
		assert.Equal(t, int64(0), *hits[1].MemberCount)
	})

	t.Run("one fails - returns error", func(t *testing.T) {
		mockLister := &mockTeamBindingLister{
			listFunc: func(_ context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
				teamName, _ := options.FieldSelector.RequiresExactMatch("spec.teamRef.name")
				if teamName == "team-bad" {
					return nil, fmt.Errorf("teambinding list failed for team-bad")
				}
				return &iamv0alpha1.TeamBindingList{Items: make([]iamv0alpha1.TeamBinding, 2)}, nil
			},
		}

		handler := &TeamSearchHandler{
			log:              log.New("test"),
			tracer:           tracing.NewNoopTracerService(),
			teamBindingStore: mockLister,
		}

		hits := []iamv0alpha1.GetSearchTeamsTeamHit{
			{Name: "team-ok-1"},
			{Name: "team-bad"},
			{Name: "team-ok-2"},
		}

		err := handler.enrichWithMemberCounts(context.Background(), "default", hits)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "team-bad")
	})

	t.Run("unexpected type - returns error", func(t *testing.T) {
		mockLister := &mockTeamBindingLister{
			listFunc: func(_ context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
				return &iamv0alpha1.TeamList{}, nil
			},
		}

		handler := &TeamSearchHandler{
			log:              log.New("test"),
			tracer:           tracing.NewNoopTracerService(),
			teamBindingStore: mockLister,
		}

		hits := []iamv0alpha1.GetSearchTeamsTeamHit{
			{Name: "team-1"},
		}

		err := handler.enrichWithMemberCounts(context.Background(), "default", hits)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected type")
	})
}

type mockTeamBindingLister struct {
	listFunc func(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

func (m *mockTeamBindingLister) NewList() runtime.Object {
	return &iamv0alpha1.TeamBindingList{}
}

func (m *mockTeamBindingLister) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return m.listFunc(ctx, options)
}

func (m *mockTeamBindingLister) ConvertToTable(_ context.Context, _ runtime.Object, _ runtime.Object) (*metav1.Table, error) {
	return nil, nil
}

type mockTeamAccessClient struct {
	batchCheckFunc func(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (m *mockTeamAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (m *mockTeamAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func (m *mockTeamAccessClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if m.batchCheckFunc != nil {
		return m.batchCheckFunc(ctx, info, req)
	}
	return authlib.BatchCheckResponse{}, nil
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

func mockTeamClientWithHits() *MockClient {
	return &MockClient{
		MockResponses: []*resourcepb.ResourceSearchResponse{
			{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: "title"},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "team-1"}, Cells: [][]byte{[]byte("Team One")}},
						{Key: &resourcepb.ResourceKey{Name: "team-2"}, Cells: [][]byte{[]byte("Team Two")}},
					},
				},
				TotalHits: 2,
			},
		},
	}
}
