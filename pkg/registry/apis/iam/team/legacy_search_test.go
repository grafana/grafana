package team

import (
	"context"
	"encoding/binary"
	"errors"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestLegacyTeamSearchClient_Search(t *testing.T) {
	t.Run("search by query", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService)

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit:  10,
			Page:   1,
			Query:  "test",
			Fields: []string{"name", "email", "provisioned", "externalUID", "memberCount", "permission", "accessControl"},
		}

		mockTeamService.ExpectedSearchTeamsResult = team.SearchTeamQueryResult{
			Teams: []*team.TeamDTO{
				{
					UID:           "testTeamUID",
					Name:          "test team",
					Email:         "test@example.com",
					IsProvisioned: true,
					ExternalUID:   "testExternalUID",
					MemberCount:   10,
					Permission:    team.PermissionTypeAdmin,
					AccessControl: map[string]bool{"test": true},
				},
			},
			TotalCount: 1,
			Page:       1,
			PerPage:    10,
		}

		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.Equal(t, int64(1), resp.TotalHits)
		require.Len(t, resp.Results.Rows, 1)
		require.Len(t, resp.Results.Columns, 8)
		require.Equal(t, "default", resp.Results.Rows[0].Key.Namespace)
		require.Equal(t, "iam.grafana.com", resp.Results.Rows[0].Key.Group)
		require.Equal(t, "teams", resp.Results.Rows[0].Key.Resource)
		require.Equal(t, "testTeamUID", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "testTeamUID", string(resp.Results.Rows[0].Cells[0]))
		require.Equal(t, "test team", string(resp.Results.Rows[0].Cells[1]))
		require.Equal(t, "test@example.com", string(resp.Results.Rows[0].Cells[2]))
		require.Equal(t, "true", string(resp.Results.Rows[0].Cells[3]))
		require.Equal(t, "testExternalUID", string(resp.Results.Rows[0].Cells[4]))
		require.Equal(t, 10, int(binary.BigEndian.Uint64(resp.Results.Rows[0].Cells[5])))
		require.Equal(t, team.PermissionTypeAdmin, team.PermissionType(binary.BigEndian.Uint32(resp.Results.Rows[0].Cells[6])))
		require.Equal(t, "{\"test\":true}", string(resp.Results.Rows[0].Cells[7]))
	})

	t.Run("returns error if page is negative", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService)
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  -1,
		}

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "invalid page number: -1", err.Error())
	})

	t.Run("returns error if page is greater than math.MaxInt32", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService)
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  math.MaxInt32 + 1,
		}

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "invalid page number: 2147483648", err.Error())
	})

	t.Run("returns error if search teams fails", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService)
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  1,
			Query: "test",
		}

		mockTeamService.ExpectedError = errors.New("search teams failed")

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "search teams failed", err.Error())
	})
}
