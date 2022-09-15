package api

import (
	"context"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	_ "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/user"
)

func (hs *HTTPServer) populateDashboardsByID(ctx context.Context, dashboardByIDs []int64, dashboardIDOrder map[int64]int) (dtos.PlaylistDashboardsSlice, error) {
	result := make(dtos.PlaylistDashboardsSlice, 0)

	if len(dashboardByIDs) > 0 {
		dashboardQuery := models.GetDashboardsQuery{DashboardIds: dashboardByIDs}
		if err := hs.DashboardService.GetDashboards(ctx, &dashboardQuery); err != nil {
			return result, err
		}

		for _, item := range dashboardQuery.Result {
			result = append(result, dtos.PlaylistDashboard{
				Id:    item.Id,
				Slug:  item.Slug,
				Title: item.Title,
				Uri:   "db/" + item.Slug,
				Url:   models.GetDashboardUrl(item.Uid, item.Slug),
				Order: dashboardIDOrder[item.Id],
			})
		}
	}

	return result, nil
}

func (hs *HTTPServer) populateDashboardsByTag(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, dashboardByTag []string, dashboardTagOrder map[string]int) dtos.PlaylistDashboardsSlice {
	result := make(dtos.PlaylistDashboardsSlice, 0)

	for _, tag := range dashboardByTag {
		searchQuery := search.Query{
			Title:        "",
			Tags:         []string{tag},
			SignedInUser: signedInUser,
			Limit:        100,
			IsStarred:    false,
			OrgId:        orgID,
		}

		if err := hs.SearchService.SearchHandler(ctx, &searchQuery); err == nil {
			for _, item := range searchQuery.Result {
				result = append(result, dtos.PlaylistDashboard{
					Id:    item.ID,
					Slug:  item.Slug,
					Title: item.Title,
					Uri:   item.URI,
					Url:   item.URL,
					Order: dashboardTagOrder[tag],
				})
			}
		}
	}

	return result
}

// Deprecated -- the frontend can do this better
func (hs *HTTPServer) LoadPlaylistDashboards(ctx context.Context, orgID int64, signedInUser *user.SignedInUser, playlistUID string) (dtos.PlaylistDashboardsSlice, error) {
	playlistItems, _ := hs.LoadPlaylistItems(ctx, playlistUID, orgID)

	dashboardByIDs := make([]int64, 0)
	dashboardByTag := make([]string, 0)
	dashboardIDOrder := make(map[int64]int)
	dashboardTagOrder := make(map[string]int)

	for _, i := range playlistItems {
		if i.Type == "dashboard_by_id" {
			dashboardID, _ := strconv.ParseInt(i.Value, 10, 64)
			dashboardByIDs = append(dashboardByIDs, dashboardID)
			dashboardIDOrder[dashboardID] = i.Order
		}

		if i.Type == "dashboard_by_tag" {
			dashboardByTag = append(dashboardByTag, i.Value)
			dashboardTagOrder[i.Value] = i.Order
		}
	}

	result := make(dtos.PlaylistDashboardsSlice, 0)

	var k, _ = hs.populateDashboardsByID(ctx, dashboardByIDs, dashboardIDOrder)
	result = append(result, k...)
	result = append(result, hs.populateDashboardsByTag(ctx, orgID, signedInUser, dashboardByTag, dashboardTagOrder)...)

	sort.Sort(result)
	return result, nil
}
