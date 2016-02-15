package api

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	_ "github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func populateDashboardsById(dashboardByIds []int64) ([]m.PlaylistDashboardDto, error) {
	result := make([]m.PlaylistDashboardDto, 0)

	if len(dashboardByIds) > 0 {
		dashboardQuery := m.GetDashboardsQuery{DashboardIds: dashboardByIds}
		if err := bus.Dispatch(&dashboardQuery); err != nil {
			return result, err
		}

		for _, item := range *dashboardQuery.Result {
			result = append(result, m.PlaylistDashboardDto{
				Id:    item.Id,
				Slug:  item.Slug,
				Title: item.Title,
				Uri:   "db/" + item.Slug,
			})
		}
	}

	return result, nil
}

func populateDashboardsByTag(orgId, userId int64, dashboardByTag []string) []m.PlaylistDashboardDto {
	result := make([]m.PlaylistDashboardDto, 0)

	if len(dashboardByTag) > 0 {
		for _, tag := range dashboardByTag {
			searchQuery := search.Query{
				Title:     "",
				Tags:      []string{tag},
				UserId:    userId,
				Limit:     100,
				IsStarred: false,
				OrgId:     orgId,
			}

			if err := bus.Dispatch(&searchQuery); err == nil {
				for _, item := range searchQuery.Result {
					result = append(result, m.PlaylistDashboardDto{
						Id:    item.Id,
						Title: item.Title,
						Uri:   item.Uri,
					})
				}
			}
		}
	}

	return result
}

func LoadPlaylistDashboards(orgId, userId, playlistId int64) ([]m.PlaylistDashboardDto, error) {
	playlistItems, _ := LoadPlaylistItems(playlistId)

	dashboardByIds := make([]int64, 0)
	dashboardByTag := make([]string, 0)

	for _, i := range playlistItems {
		if i.Type == "dashboard_by_id" {
			dashboardId, _ := strconv.ParseInt(i.Value, 10, 64)
			dashboardByIds = append(dashboardByIds, dashboardId)
		}

		if i.Type == "dashboard_by_tag" {
			dashboardByTag = append(dashboardByTag, i.Value)
		}
	}

	result := make([]m.PlaylistDashboardDto, 0)

	var k, _ = populateDashboardsById(dashboardByIds)
	result = append(result, k...)
	result = append(result, populateDashboardsByTag(orgId, userId, dashboardByTag)...)

	return result, nil
}
