package user

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestUserLegacySearchClient_Search(t *testing.T) {
	testCases := []struct {
		name          string
		fieldKey      string
		fieldValues   []string
		expectedQuery string
	}{
		{
			name:          "search by title",
			fieldKey:      res.SEARCH_FIELD_TITLE,
			fieldValues:   []string{"test user"},
			expectedQuery: "test user",
		},
		{
			name:          "search by title (multiple values)",
			fieldKey:      res.SEARCH_FIELD_TITLE,
			fieldValues:   []string{"user1", "user2"},
			expectedQuery: "user1",
		},
		{
			name:          "search by login",
			fieldKey:      "fields.login",
			fieldValues:   []string{"testlogin"},
			expectedQuery: "testlogin",
		},
		{
			name:          "search by email",
			fieldKey:      "fields.email",
			fieldValues:   []string{"test@example.com"},
			expectedQuery: "test@example.com",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockOrgService := orgtest.NewMockService(t)
			client := NewUserLegacySearchClient(mockOrgService, tracing.NewNoopTracerService(), &setting.Cfg{})
			ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1})
			req := &resourcepb.ResourceSearchRequest{
				Limit: 10,
				Page:  1,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{Namespace: "default"},
					Fields: []*resourcepb.Requirement{
						{Key: tc.fieldKey, Values: tc.fieldValues},
					},
				},
				Fields: []string{"email", "login"},
			}

			mockUsers := []*org.OrgUserDTO{
				{UID: "uid1", Name: "Test User 1", Email: "test1@example.com", Login: "testlogin1"},
			}

			mockOrgService.On("SearchOrgUsers", mock.Anything, mock.MatchedBy(func(q *org.SearchOrgUsersQuery) bool {
				return q.Query == tc.expectedQuery && q.Limit == 10 && q.Page == 1
			})).Return(&org.SearchOrgUsersQueryResult{
				OrgUsers:   mockUsers,
				TotalCount: 1,
			}, nil)

			resp, err := client.Search(ctx, req)
			require.NoError(t, err)
			require.NotNil(t, resp)
			require.Equal(t, int64(1), resp.TotalHits)
			require.Len(t, resp.Results.Rows, 1)

			// Verify columns
			expectedColumns := getColumns(req.Fields)
			require.Equal(t, len(expectedColumns), len(resp.Results.Columns))
			for i, col := range resp.Results.Columns {
				require.Equal(t, expectedColumns[i].Name, col.Name)
			}

			// Verify rows
			for i, u := range mockUsers {
				row := resp.Results.Rows[i]
				require.Equal(t, "default", row.Key.Namespace)
				require.Equal(t, UserResourceGroup, row.Key.Group)
				require.Equal(t, UserResource, row.Key.Resource)
				require.Equal(t, u.UID, row.Key.Name)

				expectedCells := createCells(&org.OrgUserDTO{
					UID:   u.UID,
					Name:  u.Name,
					Email: u.Email,
					Login: u.Login,
				}, req.Fields)
				require.Equal(t, expectedCells, row.Cells)
			}
		})
	}

	t.Run("title should have precedence over login and email", func(t *testing.T) {
		mockOrgService := orgtest.NewMockService(t)
		client := NewUserLegacySearchClient(mockOrgService, tracing.NewNoopTracerService(), &setting.Cfg{})
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1})
		req := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{Namespace: "default"},
				Fields: []*resourcepb.Requirement{
					{Key: res.SEARCH_FIELD_TITLE, Values: []string{"title"}},
					{Key: "fields.login", Values: []string{"login"}},
					{Key: "fields.email", Values: []string{"email"}},
				},
			},
		}

		mockOrgService.On("SearchOrgUsers", mock.Anything, mock.MatchedBy(func(q *org.SearchOrgUsersQuery) bool {
			return q.Query == "title"
		})).Return(&org.SearchOrgUsersQueryResult{OrgUsers: []*org.OrgUserDTO{}, TotalCount: 0}, nil)

		_, err := client.Search(ctx, req)
		require.NoError(t, err)
	})
}
