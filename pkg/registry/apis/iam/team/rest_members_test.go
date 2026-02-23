package team

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestTeamMembersREST_Connect(t *testing.T) {
	t.Run("should create handler with default pagination", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, httpHandler)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.NotNil(t, mockClient.LastSearchRequest)
		require.Equal(t, int64(50), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(0), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(1), mockClient.LastSearchRequest.Page)
		require.False(t, mockClient.LastSearchRequest.Explain)
		require.Equal(t, "testteam", mockClient.LastSearchRequest.Options.Fields[0].Values[0])
	})

	t.Run("should parse limit query parameter", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members?limit=20", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(20), mockClient.LastSearchRequest.Limit)
	})

	t.Run("should parse offset query parameter and calculate page", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members?limit=10&offset=20", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(10), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(20), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(3), mockClient.LastSearchRequest.Page)
	})

	t.Run("should parse page query parameter and calculate offset", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members?limit=10&page=2", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(10), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(10), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(2), mockClient.LastSearchRequest.Page)
	})

	t.Run("should parse explain query parameter", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members?explain=true", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should not enable explain when explain=false", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members?explain=false", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.False(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should return error when identity is missing", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := context.Background()
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Contains(t, responder.err.Error(), "no identity found")
	})

	t.Run("should return error when search fails", func(t *testing.T) {
		mockClient := &MockClient{
			MockError: errors.New("search failed"),
		}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Equal(t, "search failed", responder.err.Error())
	})

	t.Run("should return JSON response with members", func(t *testing.T) {
		mockClient := &MockClient{
			MockResponses: []*resourcepb.ResourceSearchResponse{
				{
					Results: &resourcepb.ResourceTable{
						Columns: []*resourcepb.ResourceTableColumnDefinition{
							{Name: builders.TEAM_BINDING_SUBJECT},
							{Name: builders.TEAM_BINDING_TEAM},
							{Name: builders.TEAM_BINDING_PERMISSION},
							{Name: builders.TEAM_BINDING_EXTERNAL},
						},
						Rows: []*resourcepb.ResourceTableRow{
							{
								Cells: [][]byte{
									[]byte("user1"),
									[]byte("testteam"),
									[]byte("admin"),
									[]byte("true"),
								},
							},
							{
								Cells: [][]byte{
									[]byte("user2"),
									[]byte("testteam"),
									[]byte("member"),
									[]byte("false"),
								},
							},
						},
					},
				},
			},
		}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.Equal(t, http.StatusOK, responder.code)

		result, ok := responder.obj.(*iamv0alpha1.GetMembersResponse)
		require.True(t, ok)
		require.Len(t, result.Items, 2)
		require.Equal(t, "user1", result.Items[0].User)
		require.Equal(t, "testteam", result.Items[0].Team)
		require.Equal(t, "admin", result.Items[0].Permission)
		require.True(t, result.Items[0].External)
		require.Equal(t, "user2", result.Items[1].User)
		require.Equal(t, "testteam", result.Items[1].Team)
		require.Equal(t, "member", result.Items[1].Permission)
		require.False(t, result.Items[1].External)
	})

	t.Run("should include correct fields in search request", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		expectedFields := []string{
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_PERMISSION,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_EXTERNAL,
		}
		require.Equal(t, expectedFields, mockClient.LastSearchRequest.Fields)
		require.Equal(t, iamv0alpha1.TeamBindingResourceInfo.GroupResource().Group, mockClient.LastSearchRequest.Options.Key.Group)
		require.Equal(t, iamv0alpha1.TeamBindingResourceInfo.GroupResource().Resource, mockClient.LastSearchRequest.Options.Key.Resource)
		require.Equal(t, "test-namespace", mockClient.LastSearchRequest.Options.Key.Namespace)
		require.Equal(t, resource.SEARCH_FIELD_PREFIX+builders.TEAM_BINDING_TEAM, mockClient.LastSearchRequest.Options.Fields[0].Key)
		require.Equal(t, "testteam", mockClient.LastSearchRequest.Options.Fields[0].Values[0])
	})

	t.Run("should return 403 when feature flag is disabled", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), types.FixedAccessClient(true))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Contains(t, responder.err.Error(), "functionality not available")
	})

	t.Run("should return 403 when user doesn't have the required action on team", func(t *testing.T) {
		mockClient := &MockClient{}
		accessClient := &fakeAccessClient{
			checkFunc: func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error) {
				// First call is for team access check
				require.Equal(t, "test-namespace", req.Namespace)
				require.Equal(t, iamv0alpha1.TeamResourceInfo.GroupResource().Group, req.Group)
				require.Equal(t, iamv0alpha1.TeamResourceInfo.GroupResource().Resource, req.Resource)
				require.Equal(t, "get_permissions", req.Verb)
				require.Equal(t, "testteam", req.Name)
				return types.CheckResponse{Allowed: false}, nil
			},
		}
		handler := NewTeamMembersREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings), accessClient)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testteam", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/members", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Contains(t, responder.err.Error(), "forbidden")
		require.True(t, accessClient.checkCalled)
		require.Equal(t, 1, accessClient.checkCallCount)
	})
}

func TestTeamMembersREST_parseResults(t *testing.T) {
	t.Run("should return empty body when result is nil", func(t *testing.T) {
		result, err := parseResults(nil)
		require.NoError(t, err)
		require.Empty(t, result.Items)
	})

	t.Run("should return error when result has error", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Error: &resourcepb.ErrorResult{
				Code:    500,
				Message: "internal error",
				Details: &resourcepb.ErrorDetails{
					Name: "test-resource",
				},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Empty(t, result.Items)
		require.Contains(t, err.Error(), "500 error searching")
		require.Contains(t, err.Error(), "internal error")
	})

	t.Run("should return empty body when results is nil", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: nil,
		}
		result, err := parseResults(searchResult)
		require.NoError(t, err)
		require.Empty(t, result.Items)
	})

	t.Run("should return error when subject column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_PERMISSION},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'subject' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should return error when team column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_PERMISSION},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'team' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should return error when permission column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'permission' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should return error when external column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_PERMISSION},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'external' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should parse valid results correctly", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_PERMISSION},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte("user1"),
							[]byte("team1"),
							[]byte("admin"),
							[]byte("true"),
						},
					},
					{
						Cells: [][]byte{
							[]byte("user2"),
							[]byte("team1"),
							[]byte("member"),
							[]byte("false"),
						},
					},
				},
			},
		}
		result, err := parseResults(searchResult)
		require.NoError(t, err)
		require.Len(t, result.Items, 2)

		require.Equal(t, "user1", result.Items[0].User)
		require.Equal(t, "team1", result.Items[0].Team)
		require.Equal(t, "admin", result.Items[0].Permission)
		require.True(t, result.Items[0].External)

		require.Equal(t, "user2", result.Items[1].User)
		require.Equal(t, "team1", result.Items[1].Team)
		require.Equal(t, "member", result.Items[1].Permission)
		require.False(t, result.Items[1].External)
	})

	t.Run("should return error when cell count mismatch", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_PERMISSION},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte("user1"),
							[]byte("team1"),
							[]byte("admin"),
							// Missing external cell
						},
					},
				},
			},
		}
		result, err := parseResults(searchResult)
		require.Error(t, err)
		require.Contains(t, err.Error(), "mismatch number of columns and cells")
		require.Empty(t, result.Items)
	})

	t.Run("should handle nil columns gracefully", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					nil,
					{Name: builders.TEAM_BINDING_SUBJECT},
					{Name: builders.TEAM_BINDING_TEAM},
					{Name: builders.TEAM_BINDING_PERMISSION},
					{Name: builders.TEAM_BINDING_EXTERNAL},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte(""),
							[]byte("user1"),
							[]byte("team1"),
							[]byte("admin"),
							[]byte("true"),
						},
					},
				},
			},
		}
		result, err := parseResults(searchResult)
		require.NoError(t, err)
		require.Len(t, result.Items, 1)
		require.Equal(t, "user1", result.Items[0].User)
		require.Equal(t, "team1", result.Items[0].Team)
	})
}

type mockResponder struct {
	called bool
	err    error
	obj    interface{}
	code   int
}

func (m *mockResponder) Object(statusCode int, obj runtime.Object) {
	m.called = true
	m.code = statusCode
	m.obj = obj
}

func (m *mockResponder) Error(err error) {
	m.called = true
	m.err = err
}

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

func (m *MockClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, nil
}

var _ types.AccessClient = (*fakeAccessClient)(nil)

// fakeAccessClient is a mock implementation of types.AccessClient for testing access control
type fakeAccessClient struct {
	checkCalled    bool
	checkCallCount int
	checkFunc      func(id types.AuthInfo, req *types.CheckRequest, folder string) (types.CheckResponse, error)
}

func (m *fakeAccessClient) Check(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	m.checkCalled = true
	m.checkCallCount++
	return m.checkFunc(id, &req, folder)
}

func (m *fakeAccessClient) Compile(ctx context.Context, id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	return nil, types.NoopZookie{}, nil
}

func (m *fakeAccessClient) BatchCheck(ctx context.Context, id types.AuthInfo, req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
	return types.BatchCheckResponse{}, nil
}
