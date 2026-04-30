package user

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestUserTeamREST_Connect(t *testing.T) {
	t.Run("should create handler with default pagination and stable sort", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, httpHandler)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.NotNil(t, mockClient.LastSearchRequest)
		require.Equal(t, int64(common.DefaultListLimit), mockClient.LastSearchRequest.Limit)
		// Keyset pagination: offset/page are no longer used.
		require.Equal(t, int64(0), mockClient.LastSearchRequest.Offset)
		require.Equal(t, int64(0), mockClient.LastSearchRequest.Page)
		require.Empty(t, mockClient.LastSearchRequest.SearchAfter)
		require.False(t, mockClient.LastSearchRequest.Explain)
		require.Equal(t, "alice", mockClient.LastSearchRequest.Options.Fields[0].Values[0])
		// Stable sort by name is required for keyset pagination correctness.
		require.Len(t, mockClient.LastSearchRequest.SortBy, 1)
		require.Equal(t, resource.SEARCH_FIELD_NAME, mockClient.LastSearchRequest.SortBy[0].Field)
		require.False(t, mockClient.LastSearchRequest.SortBy[0].Desc)
	})

	t.Run("should parse limit query parameter", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=20", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, int64(20), mockClient.LastSearchRequest.Limit)
	})

	t.Run("should pass continue token through as SearchAfter", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		token, err := resource.NewSearchContinueToken([]string{"team-foo"}, 0)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?continue="+url.QueryEscape(token), nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, []string{"team-foo"}, mockClient.LastSearchRequest.SearchAfter)
	})

	t.Run("should reject malformed continue token", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?continue=not-base64!", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Nil(t, mockClient.LastSearchRequest, "search should not run on bad token")
	})

	t.Run("should emit continue token when page is full", func(t *testing.T) {
		mockClient := &mockSearchClient{
			Response: &resourcepb.ResourceSearchResponse{
				ResourceVersion: 42,
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: "permission"},
						{Name: "external"},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "team-a"}, Cells: [][]byte{[]byte("admin"), []byte("false")}, SortFields: []string{"team-a"}},
						{Key: &resourcepb.ResourceKey{Name: "team-b"}, Cells: [][]byte{[]byte("member"), []byte("false")}, SortFields: []string{"team-b"}},
					},
				},
			},
		}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=2", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		result, ok := responder.obj.(*iamv0alpha1.GetUserTeamsResponse)
		require.True(t, ok)
		require.NotEmpty(t, result.ListMeta.Continue, "continue token should be set when page is full")

		decoded, err := resource.GetContinueToken(result.ListMeta.Continue)
		require.NoError(t, err)
		require.Equal(t, []string{"team-b"}, decoded.SearchAfter)
	})

	t.Run("should not emit continue token when page is partial", func(t *testing.T) {
		mockClient := &mockSearchClient{
			Response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: "permission"},
						{Name: "external"},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "team-a"}, Cells: [][]byte{[]byte("admin"), []byte("false")}, SortFields: []string{"team-a"}},
					},
				},
			},
		}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?limit=10", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		result, ok := responder.obj.(*iamv0alpha1.GetUserTeamsResponse)
		require.True(t, ok)
		require.Empty(t, result.ListMeta.Continue, "continue token should be empty when page is not full")
	})

	t.Run("should parse explain query parameter", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?explain=true", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should not enable explain when explain=false", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams?explain=false", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.False(t, mockClient.LastSearchRequest.Explain)
	})

	t.Run("should return error when identity is missing", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := context.Background()
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
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
		mockClient := &mockSearchClient{Err: errors.New("search failed")}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Contains(t, responder.err.Error(), "search failed")
	})

	t.Run("should return JSON response with teams (unified path)", func(t *testing.T) {
		mockClient := &mockSearchClient{
			Response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "team-a"}},
						{Key: &resourcepb.ResourceKey{Name: "team-b"}},
					},
				},
			},
		}
		getter := &mockGetter{teams: map[string]*iamv0alpha1.Team{
			"team-a": team("team-a", member("alice", "admin", false), member("bob", "member", false)),
			"team-b": team("team-b", member("alice", "member", true)),
		}}
		handler := NewUserTeamREST(mockClient, getter, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.Equal(t, http.StatusOK, responder.code)

		result, ok := responder.obj.(*iamv0alpha1.GetUserTeamsResponse)
		require.True(t, ok)
		require.Len(t, result.Items, 2)

		require.Equal(t, "alice", result.Items[0].User)
		require.Equal(t, "team-a", result.Items[0].Team)
		require.Equal(t, "admin", result.Items[0].Permission)
		require.False(t, result.Items[0].External)

		require.Equal(t, "team-b", result.Items[1].Team)
		require.Equal(t, "member", result.Items[1].Permission)
		require.True(t, result.Items[1].External)
	})

	t.Run("should build items from inline cells (legacy adapter path)", func(t *testing.T) {
		mockClient := &mockSearchClient{
			Response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Columns: []*resourcepb.ResourceTableColumnDefinition{
						{Name: "permission"},
						{Name: "external"},
					},
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key:   &resourcepb.ResourceKey{Name: "team-a"},
							Cells: [][]byte{[]byte("admin"), []byte("false")},
						},
						{
							Key:   &resourcepb.ResourceKey{Name: "team-b"},
							Cells: [][]byte{[]byte("member"), []byte("true")},
						},
					},
				},
			},
		}
		// Failing getter ensures the inline-cells path doesn't call it.
		getter := &mockGetter{err: errors.New("getter must not be called")}
		handler := NewUserTeamREST(mockClient, getter, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.Equal(t, http.StatusOK, responder.code)

		result, ok := responder.obj.(*iamv0alpha1.GetUserTeamsResponse)
		require.True(t, ok)
		require.Len(t, result.Items, 2)
		require.Equal(t, "team-a", result.Items[0].Team)
		require.Equal(t, "admin", result.Items[0].Permission)
		require.False(t, result.Items[0].External)
		require.Equal(t, "team-b", result.Items[1].Team)
		require.Equal(t, "member", result.Items[1].Permission)
		require.True(t, result.Items[1].External)
	})

	t.Run("should skip hits whose getter returns NotFound", func(t *testing.T) {
		mockClient := &mockSearchClient{
			Response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{Key: &resourcepb.ResourceKey{Name: "team-a"}},
						{Key: &resourcepb.ResourceKey{Name: "team-missing"}},
					},
				},
			},
		}
		getter := &mockGetter{teams: map[string]*iamv0alpha1.Team{
			"team-a": team("team-a", member("alice", "admin", false)),
		}}
		handler := NewUserTeamREST(mockClient, getter, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		result, ok := responder.obj.(*iamv0alpha1.GetUserTeamsResponse)
		require.True(t, ok)
		require.Len(t, result.Items, 1)
		require.Equal(t, "team-a", result.Items[0].Team)
	})

	t.Run("should include correct fields in search request", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(featuremgmt.FlagKubernetesTeamBindings))

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.NotNil(t, mockClient.LastSearchRequest)
		require.Equal(t, iamv0alpha1.TeamResourceInfo.GroupResource().Group, mockClient.LastSearchRequest.Options.Key.Group)
		require.Equal(t, iamv0alpha1.TeamResourceInfo.GroupResource().Resource, mockClient.LastSearchRequest.Options.Key.Resource)
		require.Equal(t, "test-namespace", mockClient.LastSearchRequest.Options.Key.Namespace)
		require.Len(t, mockClient.LastSearchRequest.Options.Fields, 1)
		require.Equal(t, resource.SEARCH_FIELD_PREFIX+builders.TEAM_SEARCH_MEMBERS, mockClient.LastSearchRequest.Options.Fields[0].Key)
		require.Equal(t, []string{"alice"}, mockClient.LastSearchRequest.Options.Fields[0].Values)
	})

	t.Run("should return 403 when feature flag is disabled", func(t *testing.T) {
		mockClient := &mockSearchClient{}
		handler := NewUserTeamREST(mockClient, &mockGetter{}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
		})
		responder := &mockResponder{}

		httpHandler, err := handler.Connect(ctx, "alice", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/teams", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		httpHandler.ServeHTTP(w, req)

		require.True(t, responder.called)
		require.NotNil(t, responder.err)
		require.Contains(t, responder.err.Error(), "functionality not available")
	})
}

func team(uid string, members ...iamv0alpha1.TeamTeamMember) *iamv0alpha1.Team {
	return &iamv0alpha1.Team{
		ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: "default"},
		Spec:       iamv0alpha1.TeamSpec{Title: uid, Members: members},
	}
}

func member(name, permission string, external bool) iamv0alpha1.TeamTeamMember {
	return iamv0alpha1.TeamTeamMember{
		Kind:       "User",
		Name:       name,
		Permission: iamv0alpha1.TeamTeamPermission(permission),
		External:   external,
	}
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

type mockSearchClient struct {
	resourcepb.ResourceIndexClient
	resource.ResourceIndex

	LastSearchRequest *resourcepb.ResourceSearchRequest
	Response          *resourcepb.ResourceSearchResponse
	Err               error
}

func (m *mockSearchClient) Search(_ context.Context, in *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	m.LastSearchRequest = in
	if m.Err != nil {
		return nil, m.Err
	}
	if m.Response != nil {
		return m.Response, nil
	}
	return &resourcepb.ResourceSearchResponse{}, nil
}

type mockGetter struct {
	teams map[string]*iamv0alpha1.Team
	err   error
}

func (m *mockGetter) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if m.err != nil {
		return nil, m.err
	}
	t, ok := m.teams[name]
	if !ok {
		return nil, apierrors.NewNotFound(iamv0alpha1.TeamResourceInfo.GroupResource(), name)
	}
	return t, nil
}
