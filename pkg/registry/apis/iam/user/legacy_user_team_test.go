package user

import (
	"context"
	"errors"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

func TestLegacyUserTeamSearchClient_Search(t *testing.T) {
	t.Run("should return error when request is nil", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		resp, err := client.Search(ctx, nil)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "missing search request key")
	})

	t.Run("should return error when request options is nil", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{}
		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "missing search request key")
	})

	t.Run("should return error when request key is nil", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{},
		}
		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "missing search request key")
	})

	t.Run("should return error when identity is missing", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := context.Background()
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
	})

	t.Run("should return error when subject UID is missing", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Page: 1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{},
			},
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "missing required field filter")
	})

	t.Run("should return error when page is invalid", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Page: math.MaxInt32 + 1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "invalid page number")
	})

	t.Run("should return error when page is less than 1", func(t *testing.T) {
		mockStore := &mockLegacyStore{}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Page: 0,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "invalid page number")
	})

	t.Run("should cap limit at 100", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, int64(100), query.Pagination.Limit)
				return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 150,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("should default limit to 50 when limit is 0", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, int64(50), query.Pagination.Limit)
				return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 0,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("should default limit to 50 when limit is negative", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, int64(50), query.Pagination.Limit)
				return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: -10,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("should use default fields when fields are empty", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				return &legacy.ListUserTeamsResult{
					Items: []legacy.UserTeam{
						{UID: "team1", Permission: team.PermissionTypeAdmin},
					},
					Continue: 0,
				}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit:  10,
			Page:   1,
			Fields: []string{},
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results.Columns, 3)
		require.Len(t, resp.Results.Rows, 1)
	})

	t.Run("should return teams successfully", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, "user1", query.UserUID)
				require.Equal(t, "test-namespace", ns.Value)
				require.Equal(t, int64(1), ns.OrgID)
				return &legacy.ListUserTeamsResult{
					Items: []legacy.UserTeam{
						{UID: "team1", Permission: team.PermissionTypeAdmin},
						{UID: "team2", Permission: team.PermissionTypeMember},
					},
					Continue: 0,
				}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Fields: []string{
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM_REF,
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_PERMISSION,
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_EXTERNAL,
			},
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(2), resp.TotalHits)
		require.Len(t, resp.Results.Rows, 2)

		require.Equal(t, "team1", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "test-namespace", resp.Results.Rows[0].Key.Namespace)
		require.Equal(t, "iam.grafana.app", resp.Results.Rows[0].Key.Group)
		require.Equal(t, "teambindings", resp.Results.Rows[0].Key.Resource)
		require.Len(t, resp.Results.Rows[0].Cells, 3)
		require.Equal(t, "team1", string(resp.Results.Rows[0].Cells[0]))
		require.Equal(t, string(common.MapTeamPermission(team.PermissionTypeAdmin)), string(resp.Results.Rows[0].Cells[1]))
		require.Equal(t, "false", string(resp.Results.Rows[0].Cells[2]))

		require.Equal(t, "team2", resp.Results.Rows[1].Key.Name)
		require.Equal(t, "test-namespace", resp.Results.Rows[1].Key.Namespace)
		require.Equal(t, "iam.grafana.app", resp.Results.Rows[1].Key.Group)
		require.Equal(t, "teambindings", resp.Results.Rows[1].Key.Resource)
		require.Len(t, resp.Results.Rows[1].Cells, 3)
		require.Equal(t, "team2", string(resp.Results.Rows[1].Cells[0]))
		require.Equal(t, string(common.MapTeamPermission(team.PermissionTypeMember)), string(resp.Results.Rows[1].Cells[1]))
		require.Equal(t, "false", string(resp.Results.Rows[1].Cells[2]))
	})

	t.Run("should handle pagination correctly", func(t *testing.T) {
		callCount := 0
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				callCount++
				if callCount == 1 {
					return &legacy.ListUserTeamsResult{
						Items:    []legacy.UserTeam{{UID: "team1"}},
						Continue: 100,
					}, nil
				}
				return &legacy.ListUserTeamsResult{
					Items:    []legacy.UserTeam{{UID: "team2"}},
					Continue: 0,
				}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  2,
			Fields: []string{
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM_REF,
			},
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, 2, callCount)
		require.Equal(t, int64(1), resp.TotalHits)
		require.Equal(t, "team2", resp.Results.Rows[0].Key.Name)
	})

	t.Run("should return empty result when page exceeds available data", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				return &legacy.ListUserTeamsResult{
					Items:    []legacy.UserTeam{{UID: "team1"}},
					Continue: 0,
				}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  3, // Requesting page 3 but only 1 page available
			Fields: []string{
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM_REF,
			},
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(0), resp.TotalHits)
		require.Len(t, resp.Results.Rows, 0)
	})

	t.Run("should return error when store fails", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				return nil, errors.New("store error")
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Contains(t, err.Error(), "store error")
	})

	t.Run("should extract subject UID from fields.subject.name", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, "user1", query.UserUID)
				return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
	})

	t.Run("should extract subject UID from subject.name", func(t *testing.T) {
		mockStore := &mockLegacyStore{
			listUserTeamsFunc: func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
				require.Equal(t, "user1", query.UserUID)
				return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
			},
		}
		client := NewLegacyUserTeamSearchClient(mockStore, tracing.NewNoopTracerService())

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Namespace: "test-namespace",
			OrgID:     1,
		})

		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "test-namespace",
					Group:     "iam.grafana.app",
					Resource:  "teambindings",
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:    builders.TEAM_BINDING_SUBJECT_NAME,
						Values: []string{"user1"},
					},
				},
			},
		}

		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
	})
}

func Test_subjectUIDFromRequirements(t *testing.T) {
	t.Run("should extract subject UID from fields.subject.name", func(t *testing.T) {
		reqs := []*resourcepb.Requirement{
			{
				Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
				Values: []string{"user1"},
			},
		}
		result := subjectUIDFromRequirements(reqs)
		require.Equal(t, "user1", result)
	})

	t.Run("should extract subject UID from subject.name", func(t *testing.T) {
		reqs := []*resourcepb.Requirement{
			{
				Key:    builders.TEAM_BINDING_SUBJECT_NAME,
				Values: []string{"user2"},
			},
		}
		result := subjectUIDFromRequirements(reqs)
		require.Equal(t, "user2", result)
	})

	t.Run("should return empty string when no matching requirement", func(t *testing.T) {
		reqs := []*resourcepb.Requirement{
			{
				Key:    "other.field",
				Values: []string{"value"},
			},
		}
		result := subjectUIDFromRequirements(reqs)
		require.Empty(t, result)
	})

	t.Run("should return empty string when requirement has no values", func(t *testing.T) {
		reqs := []*resourcepb.Requirement{
			{
				Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
				Values: []string{},
			},
		}
		result := subjectUIDFromRequirements(reqs)
		require.Empty(t, result)
	})

	t.Run("should skip nil requirements", func(t *testing.T) {
		reqs := []*resourcepb.Requirement{
			nil,
			{
				Key:    resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT_NAME,
				Values: []string{"user1"},
			},
		}
		result := subjectUIDFromRequirements(reqs)
		require.Equal(t, "user1", result)
	})
}

type mockLegacyStore struct {
	listUserTeamsFunc func(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error)
	calls             int
}

func (m *mockLegacyStore) ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	m.calls++
	if m.listUserTeamsFunc != nil {
		return m.listUserTeamsFunc(ctx, ns, query)
	}
	return &legacy.ListUserTeamsResult{Items: []legacy.UserTeam{}, Continue: 0}, nil
}

func (m *mockLegacyStore) ListDisplay(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListDisplayQuery) (*legacy.ListUserResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) ListUsers(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserQuery) (*legacy.ListUserResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) CreateUser(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.CreateUserCommand) (*legacy.CreateUserResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) UpdateUser(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.UpdateUserCommand) (*legacy.UpdateUserResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) DeleteUser(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.DeleteUserCommand) error {
	return nil
}

func (m *mockLegacyStore) GetServiceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, query legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) ListServiceAccounts(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListServiceAccountsQuery) (*legacy.ListServiceAccountResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) CreateServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.CreateServiceAccountCommand) (*legacy.CreateServiceAccountResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) DeleteServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.DeleteUserCommand) error {
	return nil
}

func (m *mockLegacyStore) ListServiceAccountTokens(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListServiceAccountTokenQuery) (*legacy.ListServiceAccountTokenResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) GetTeamInternalID(ctx context.Context, ns claims.NamespaceInfo, query legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) CreateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.CreateTeamCommand) (*legacy.CreateTeamResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) UpdateTeam(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.UpdateTeamCommand) (*legacy.UpdateTeamResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) ListTeams(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListTeamQuery) (*legacy.ListTeamResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) CreateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.CreateTeamMemberCommand) (*legacy.CreateTeamMemberResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) DeleteTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.DeleteTeamMemberCommand) error {
	return nil
}

func (m *mockLegacyStore) UpdateTeamMember(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.UpdateTeamMemberCommand) (*legacy.UpdateTeamMemberResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) DeleteTeam(ctx context.Context, ns claims.NamespaceInfo, cmd legacy.DeleteTeamCommand) error {
	return nil
}

func (m *mockLegacyStore) ListTeamBindings(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListTeamBindingsQuery) (*legacy.ListTeamBindingsResult, error) {
	return nil, nil
}

func (m *mockLegacyStore) ListTeamMembers(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListTeamMembersQuery) (*legacy.ListTeamMembersResult, error) {
	return nil, nil
}
