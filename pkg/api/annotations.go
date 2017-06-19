package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func GetAnnotations(c *middleware.Context) Response {

	query := &annotations.ItemQuery{
		From:        c.QueryInt64("from") / 1000,
		To:          c.QueryInt64("to") / 1000,
		Type:        annotations.ItemType(c.Query("type")),
		OrgId:       c.OrgId,
		AlertId:     c.QueryInt64("alertId"),
		DashboardId: c.QueryInt64("dashboardId"),
		PanelId:     c.QueryInt64("panelId"),
		Limit:       c.QueryInt64("limit"),
		NewState:    c.QueryStrings("newState"),
	}

	repo := annotations.GetRepository()

	items, err := repo.Find(query)
	if err != nil {
		return ApiError(500, "Failed to get annotations", err)
	}

	result := make([]dtos.Annotation, 0)

	for _, item := range items {
		result = append(result, dtos.Annotation{
			AlertId:   item.AlertId,
			Time:      item.Epoch * 1000,
			Data:      item.Data,
			NewState:  item.NewState,
			PrevState: item.PrevState,
			Text:      item.Text,
			Metric:    item.Metric,
			Title:     item.Title,
			PanelId:   item.PanelId,
			RegionId:  item.RegionId,
			Type:      string(item.Type),
		})
	}

	return Json(200, result)
}

func PostAnnotation(c *middleware.Context, cmd dtos.PostAnnotationsCmd) Response {
	repo := annotations.GetRepository()

	item := annotations.Item{
		OrgId:       c.OrgId,
		DashboardId: cmd.DashboardId,
		PanelId:     cmd.PanelId,
		Epoch:       cmd.Time / 1000,
		Title:       cmd.Title,
		Text:        cmd.Text,
		CategoryId:  cmd.CategoryId,
		NewState:    cmd.FillColor,
		Type:        annotations.EventType,
	}

	if err := repo.Save(&item); err != nil {
		return ApiError(500, "Failed to save annotation", err)
	}

	// handle regions
	if cmd.IsRegion {
		item.RegionId = item.Id

		if err := repo.Update(&item); err != nil {
			return ApiError(500, "Failed set regionId on annotation", err)
		}

		item.Id = 0
		item.Epoch = cmd.TimeEnd

		if err := repo.Save(&item); err != nil {
			return ApiError(500, "Failed save annotation for region end time", err)
		}
	}

	return ApiSuccess("Annotation added")
}

func DeleteAnnotations(c *middleware.Context, cmd dtos.DeleteAnnotationsCmd) Response {
	repo := annotations.GetRepository()

	err := repo.Delete(&annotations.DeleteParams{
		AlertId:     cmd.PanelId,
		DashboardId: cmd.DashboardId,
		PanelId:     cmd.PanelId,
	})

	if err != nil {
		return ApiError(500, "Failed to delete annotations", err)
	}

	return ApiSuccess("Annotations deleted")
}
