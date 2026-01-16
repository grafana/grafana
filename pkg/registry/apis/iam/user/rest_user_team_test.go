package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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

func TestUserTeamREST_Connect(t *testing.T) {
	t.Run("should create handler with default pagination", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, httpHandler)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.NotNil(t, mockClient.LastSearchRequest)
		require.Equal(t, int64(50), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(0), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(1), mockClient.LastSearchRequest.Page)
		require.False(t, mockClient.LastSearchRequest.Explain)
		require.Equal(t, "testuser", mockClient.LastSearchRequest.Options.Fields[0].Values[0])
	})

	t.Run("should parse limit query parameter", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=20", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(20), mockClient.LastSearchRequest.Limit)
	})

	t.Run("should parse offset query parameter and calculate page", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=10&offset=20", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(10), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(20), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(3), mockClient.LastSearchRequest.Page)
	})

	t.Run("should parse page query parameter and calculate offset", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=10&page=2", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(10), mockClient.LastSearchRequest.Limit)
		require.Equal(t, int64(10), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(2), mockClient.LastSearchRequest.Page)
	})

	t.Run("should parse explain query parameter", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?explain=true", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should not enable explain when explain=false", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?explain=false", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.False(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should return error when identity is missing", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := context.Background()
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
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
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Equal(t, "search failed", responder.err.Error())
	})

	t.Run("should return JSON response with teams", func(t *testing.T) {
		mockClient := &MockClient{
			MockResponses: []*resourcepb.ResourceSearchResponse{
				{
					Results: &resourcepb.ResourceTable{
						Columns: []*resourcepb.ResourceTableColumnDefinition{
							{Name: "teamRef.name"},
							{Name: "permission"},
							{Name: "external"},
						},
						Rows: []*resourcepb.ResourceTableRow{
							{
								Cells: [][]byte{
									[]byte("team1"),
									[]byte("admin"),
									[]byte("true"),
								},
							},
							{
								Cells: [][]byte{
									[]byte("team2"),
									[]byte("member"),
									[]byte("false"),
								},
							},
						},
					},
				},
			},
		}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.False(t, responder.called)
		require.Equal(t, http.StatusOK, w.Code)

		var result iamv0alpha1.GetTeamsBody
		err = json.Unmarshal(w.Body.Bytes(), &result)
		require.NoError(t, err)
		require.Len(t, result.Items, 2)
		require.Equal(t, "team1", result.Items[0].TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamPermissionAdmin, result.Items[0].Permission)
		require.True(t, result.Items[0].External)
		require.Equal(t, "team2", result.Items[1].TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamPermissionMember, result.Items[1].Permission)
		require.False(t, result.Items[1].External)
	})

	t.Run("should include correct fields in search request", func(t *testing.T) {
		mockClient := &MockClient{}
		handler := NewTeamMemberREST(mockClient, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "testuser", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		expectedFields := []string{
			resource.SEARCH_FIELD_PREFIX + "teamRef.name",
			resource.SEARCH_FIELD_PREFIX + "permission",
			resource.SEARCH_FIELD_PREFIX + "external",
		}
		require.Equal(t, expectedFields, mockClient.LastSearchRequest.Fields)
		require.Equal(t, iamv0alpha1.TeamBindingResourceInfo.GroupResource().Group, mockClient.LastSearchRequest.Options.Key.Group)
		require.Equal(t, iamv0alpha1.TeamBindingResourceInfo.GroupResource().Resource, mockClient.LastSearchRequest.Options.Key.Resource)
		require.Equal(t, "test-namespace", mockClient.LastSearchRequest.Options.Key.Namespace)
	})
}

func TestUserTeamREST_parseResults(t *testing.T) {
	handler := NewTeamMemberREST(nil, trace.NewNoopTracerProvider().Tracer("test"), featuremgmt.WithFeatures())

	t.Run("should return empty body when result is nil", func(t *testing.T) {
		result, err := handler.parseResults(nil, 0)
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
		result, err := handler.parseResults(searchResult, 0)
		require.Error(t, err)
		require.Empty(t, result.Items)
		require.Contains(t, err.Error(), "500 error searching")
		require.Contains(t, err.Error(), "internal error")
	})

	t.Run("should return empty body when results is nil", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: nil,
		}
		result, err := handler.parseResults(searchResult, 0)
		require.NoError(t, err)
		require.Empty(t, result.Items)
	})

	t.Run("should return error when teamRef.name column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "permission"},
					{Name: "external"},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'teamRef.name' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should return error when permission column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "teamRef.name"},
					{Name: "external"},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'permission' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should return error when external column is missing", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "teamRef.name"},
					{Name: "permission"},
				},
				Rows: []*resourcepb.ResourceTableRow{},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "required column 'external' not found")
		require.Empty(t, result.Items)
	})

	t.Run("should parse valid results correctly", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "teamRef.name"},
					{Name: "permission"},
					{Name: "external"},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte("team1"),
							[]byte("admin"),
							[]byte("true"),
						},
					},
					{
						Cells: [][]byte{
							[]byte("team2"),
							[]byte("member"),
							[]byte("false"),
						},
					},
				},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.NoError(t, err)
		require.Len(t, result.Items, 2)

		require.Equal(t, "team1", result.Items[0].TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamPermissionAdmin, result.Items[0].Permission)
		require.True(t, result.Items[0].External)

		require.Equal(t, "team2", result.Items[1].TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamPermissionMember, result.Items[1].Permission)
		require.False(t, result.Items[1].External)
	})

	t.Run("should return error when cell count mismatch", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					{Name: "teamRef.name"},
					{Name: "permission"},
					{Name: "external"},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte("team1"),
							[]byte("admin"),
							// Missing external cell
						},
					},
				},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.Error(t, err)
		require.Contains(t, err.Error(), "mismatch number of columns and cells")
		require.Empty(t, result.Items)
	})

	t.Run("should handle nil columns gracefully", func(t *testing.T) {
		searchResult := &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{
				Columns: []*resourcepb.ResourceTableColumnDefinition{
					nil,
					{Name: "teamRef.name"},
					{Name: "permission"},
					{Name: "external"},
				},
				Rows: []*resourcepb.ResourceTableRow{
					{
						Cells: [][]byte{
							[]byte(""),
							[]byte("team1"),
							[]byte("admin"),
							[]byte("true"),
						},
					},
				},
			},
		}
		result, err := handler.parseResults(searchResult, 0)
		require.NoError(t, err)
		require.Len(t, result.Items, 1)
		require.Equal(t, "team1", result.Items[0].TeamRef.Name)
	})
}
