package api

import (
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	_ "github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func populateDashboardsById(dashboardByIds []int64, dashboardIdOrder map[int64]int) (dtos.PlaylistDashboardsSlice, error) {
	result := make(dtos.PlaylistDashboardsSlice, 0)

	if len(dashboardByIds) > 0 {
		dashboardQuery := m.GetDashboardsQuery{DashboardIds: dashboardByIds}
		if err := bus.Dispatch(&dashboardQuery); err != nil {
			return result, err
		}

		for _, item := range dashboardQuery.Result {
			result = append(result, dtos.PlaylistDashboard{
				Id:    item.Id,
				Slug:  item.Slug,
				Title: item.Title,
				Uri:   "db/" + item.Slug,
				Order: dashboardIdOrder[item.Id],
			})
		}
	}

	return result, nil
}

func populateDashboardsByTag(orgId int64, signedInUser *m.SignedInUser, dashboardByTag []string, dashboardTagOrder map[string]int) dtos.PlaylistDashboardsSlice {
	result := make(dtos.PlaylistDashboardsSlice, 0)

	if len(dashboardByTag) > 0 {
		for _, tag := range dashboardByTag {
			searchQuery := search.Query{
				Title:        "",
				Tags:         []string{tag},
				SignedInUser: signedInUser,
				Limit:        100,
				IsStarred:    false,
				OrgId:        orgId,
			}

			if err := bus.Dispatch(&searchQuery); err == nil {
				for _, item := range searchQuery.Result {
					result = append(result, dtos.PlaylistDashboard{
						Id:    item.Id,
						Title: item.Title,
						Uri:   item.Uri,
						Order: dashboardTagOrder[tag],
					})
				}
			}
		}
	}

	return result
}

func LoadPlaylistDashboards(orgId int64, signedInUser *m.SignedInUser, playlistId int64) (dtos.PlaylistDashboardsSlice, error) {
	playlistItems, _ := LoadPlaylistItems(playlistId)

	dashboardByIds := make([]int64, 0)
	dashboardByTag := make([]string, 0)
	dashboardIdOrder := make(map[int64]int)
	dashboardTagOrder := make(map[string]int)

	for _, i := range playlistItems {
		if i.Type == "dashboard_by_id" {
			dashboardId, _ := strconv.ParseInt(i.Value, 10, 64)
			dashboardByIds = append(dashboardByIds, dashboardId)
			dashboardIdOrder[dashboardId] = i.Order
		}

		if i.Type == "dashboard_by_tag" {
			dashboardByTag = append(dashboardByTag, i.Value)
			dashboardTagOrder[i.Value] = i.Order
		}
	}

	result := make(dtos.PlaylistDashboardsSlice, 0)

	var k, _ = populateDashboardsById(dashboardByIds, dashboardIdOrder)
	result = append(result, k...)
	result = append(result, populateDashboardsByTag(orgId, signedInUser, dashboardByTag, dashboardTagOrder)...)

	sort.Sort(result)
	return result, nil
}
