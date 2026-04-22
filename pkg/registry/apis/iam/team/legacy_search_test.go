package team

import (
	"context"
	"errors"
	"fmt"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestLegacyTeamSearchClient_Search(t *testing.T) {
	t.Run("search by query", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, tracing.InitializeTracerForTest())

		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit:  10,
			Page:   1,
			Query:  "test",
			Fields: []string{"name", "email", "provisioned", "externalUID"},
		}

		mockTeamService.ExpectedSearchTeamsResult = team.SearchTeamQueryResult{
			Teams: []*team.TeamDTO{
				{
					UID:           "testTeamUID",
					Name:          "test team",
					Email:         "test@example.com",
					IsProvisioned: true,
					ExternalUID:   "testExternalUID",
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
		require.Len(t, resp.Results.Columns, 5)
		require.Equal(t, "default", resp.Results.Rows[0].Key.Namespace)
		require.Equal(t, "iam.grafana.com", resp.Results.Rows[0].Key.Group)
		require.Equal(t, "teams", resp.Results.Rows[0].Key.Resource)
		require.Equal(t, "testTeamUID", resp.Results.Rows[0].Key.Name)
		require.Equal(t, "testTeamUID", string(resp.Results.Rows[0].Cells[0]))
		require.Equal(t, "test team", string(resp.Results.Rows[0].Cells[1]))
		require.Equal(t, "test@example.com", string(resp.Results.Rows[0].Cells[2]))
		require.Equal(t, "true", string(resp.Results.Rows[0].Cells[3]))
		require.Equal(t, "testExternalUID", string(resp.Results.Rows[0].Cells[4]))
	})

	t.Run("returns error if page is negative", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, tracing.InitializeTracerForTest())
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
		client := NewLegacyTeamSearchClient(mockTeamService, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: 10,
			Page:  math.MaxInt32 + 1,
		}

		_, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Equal(t, "invalid page number: 2147483648", err.Error())
	})

	t.Run("returns error if limit exceeds common.MaxListLimit", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, tracing.InitializeTracerForTest())
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, Namespace: "default"})
		req := &resourcepb.ResourceSearchRequest{
			Limit: common.MaxListLimit + 1,
			Page:  1,
		}

		resp, err := client.Search(ctx, req)
		require.Error(t, err)
		require.Nil(t, resp)
		require.Equal(t, fmt.Sprintf("limit cannot be greater than %d", common.MaxListLimit), err.Error())
	})

	t.Run("returns error if search teams fails", func(t *testing.T) {
		mockTeamService := teamtest.NewFakeService()
		client := NewLegacyTeamSearchClient(mockTeamService, tracing.InitializeTracerForTest())
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

func Test_titleFromRequirements(t *testing.T) {
	t.Run("should extract title from fields", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"My Team"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "My Team", title)
	})

	t.Run("should return empty string when no title requirement", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: "other.field", Values: []string{"value"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "", title)
	})

	t.Run("should return error when values are empty", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{}},
			},
		}
		_, err := titleFromRequirements(opts)
		require.EqualError(t, err, "title filter requires exactly one value, got 0")
	})

	t.Run("should return error when multiple values provided", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"a", "b"}},
			},
		}
		_, err := titleFromRequirements(opts)
		require.EqualError(t, err, "title filter requires exactly one value, got 2")
	})

	t.Run("should return empty string when opts is nil", func(t *testing.T) {
		title, err := titleFromRequirements(nil)
		require.NoError(t, err)
		require.Equal(t, "", title)
	})

	t.Run("should skip nil requirements", func(t *testing.T) {
		opts := &resourcepb.ListOptions{
			Fields: []*resourcepb.Requirement{
				nil,
				{Key: res.SEARCH_FIELD_TITLE, Values: []string{"Found"}},
			},
		}
		title, err := titleFromRequirements(opts)
		require.NoError(t, err)
		require.Equal(t, "Found", title)
	})
}
