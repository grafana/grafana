package api

import (
	"context"

	"github.com/grafana/grafana/pkg/api/dtos"
	_ "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/user"
)

func (hs *HTTPServer) populateDashboardsByID(ctx context.Context, dashboardByIDs []int64, dashboardIDOrder map[int64]int) (dtos.PlaylistDashboardsSlice, error) {
	result := make(dtos.PlaylistDashboardsSlice, 0)

	if len(dashboardByIDs) > 0 {
		dashboardQuery := dashboards.GetDashboardsQuery{DashboardIDs: dashboardByIDs}
		dashboardQueryResult, err := hs.DashboardService.GetDashboards(ctx, &dashboardQuery)
		if err != nil {
			return result, err
		}

		for _, item := range dashboardQueryResult {
			result = append(result, dtos.PlaylistDashboard{
				Id:    item.ID,
				Slug:  item.Slug,
				Title: item.Title,
				Uri:   "db/" + item.Slug,
				Url:   dashboards.GetDashboardURL(item.UID, item.Slug),
				Order: dashboardIDOrder[item.ID],
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

		hits, err := hs.SearchService.SearchHandler(ctx, &searchQuery)
		if err == nil {
			for _, item := range hits {
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
