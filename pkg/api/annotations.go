package api

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func GetAnnotations(c *m.ReqContext) Response {

	query := &annotations.ItemQuery{
		From:        c.QueryInt64("from") / 1000,
		To:          c.QueryInt64("to") / 1000,
		OrgId:       c.OrgId,
		AlertId:     c.QueryInt64("alertId"),
		DashboardId: c.QueryInt64("dashboardId"),
		PanelId:     c.QueryInt64("panelId"),
		Limit:       c.QueryInt64("limit"),
		Tags:        c.QueryStrings("tags"),
		Type:        c.Query("type"),
	}

	repo := annotations.GetRepository()

	items, err := repo.Find(query)
	if err != nil {
		return ApiError(500, "Failed to get annotations", err)
	}

	for _, item := range items {
		if item.Email != "" {
			item.AvatarUrl = dtos.GetGravatarUrl(item.Email)
		}
		item.Time = item.Time * 1000
	}

	return Json(200, items)
}

type CreateAnnotationError struct {
	message string
}

func (e *CreateAnnotationError) Error() string {
	return e.message
}

func PostAnnotation(c *m.ReqContext, cmd dtos.PostAnnotationsCmd) Response {
	if canSave, err := canSaveByDashboardID(c, cmd.DashboardId); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	repo := annotations.GetRepository()

	if cmd.Text == "" {
		err := &CreateAnnotationError{"text field should not be empty"}
		return ApiError(500, "Failed to save annotation", err)
	}

	item := annotations.Item{
		OrgId:       c.OrgId,
		UserId:      c.UserId,
		DashboardId: cmd.DashboardId,
		PanelId:     cmd.PanelId,
		Epoch:       cmd.Time / 1000,
		Text:        cmd.Text,
		Data:        cmd.Data,
		Tags:        cmd.Tags,
	}

	if item.Epoch == 0 {
		item.Epoch = time.Now().Unix()
	}

	if err := repo.Save(&item); err != nil {
		return ApiError(500, "Failed to save annotation", err)
	}

	startID := item.Id

	// handle regions
	if cmd.IsRegion {
		item.RegionId = startID

		if item.Data == nil {
			item.Data = simplejson.New()
		}

		if err := repo.Update(&item); err != nil {
			return ApiError(500, "Failed set regionId on annotation", err)
		}

		item.Id = 0
		item.Epoch = cmd.TimeEnd / 1000

		if err := repo.Save(&item); err != nil {
			return ApiError(500, "Failed save annotation for region end time", err)
		}

		return Json(200, util.DynMap{
			"message": "Annotation added",
			"id":      startID,
			"endId":   item.Id,
		})
	}

	return Json(200, util.DynMap{
		"message": "Annotation added",
		"id":      startID,
	})
}

func formatGraphiteAnnotation(what string, data string) string {
	text := what
	if data != "" {
		text = text + "\n" + data
	}
	return text
}

func PostGraphiteAnnotation(c *m.ReqContext, cmd dtos.PostGraphiteAnnotationsCmd) Response {
	repo := annotations.GetRepository()

	if cmd.What == "" {
		err := &CreateAnnotationError{"what field should not be empty"}
		return ApiError(500, "Failed to save Graphite annotation", err)
	}

	if cmd.When == 0 {
		cmd.When = time.Now().Unix()
	}
	text := formatGraphiteAnnotation(cmd.What, cmd.Data)

	// Support tags in prior to Graphite 0.10.0 format (string of tags separated by space)
	var tagsArray []string
	switch tags := cmd.Tags.(type) {
	case string:
		if tags != "" {
			tagsArray = strings.Split(tags, " ")
		} else {
			tagsArray = []string{}
		}
	case []interface{}:
		for _, t := range tags {
			if tagStr, ok := t.(string); ok {
				tagsArray = append(tagsArray, tagStr)
			} else {
				err := &CreateAnnotationError{"tag should be a string"}
				return ApiError(500, "Failed to save Graphite annotation", err)
			}
		}
	default:
		err := &CreateAnnotationError{"unsupported tags format"}
		return ApiError(500, "Failed to save Graphite annotation", err)
	}

	item := annotations.Item{
		OrgId:  c.OrgId,
		UserId: c.UserId,
		Epoch:  cmd.When,
		Text:   text,
		Tags:   tagsArray,
	}

	if err := repo.Save(&item); err != nil {
		return ApiError(500, "Failed to save Graphite annotation", err)
	}

	return Json(200, util.DynMap{
		"message": "Graphite annotation added",
		"id":      item.Id,
	})
}

func UpdateAnnotation(c *m.ReqContext, cmd dtos.UpdateAnnotationsCmd) Response {
	annotationID := c.ParamsInt64(":annotationId")

	repo := annotations.GetRepository()

	if resp := canSave(c, repo, annotationID); resp != nil {
		return resp
	}

	item := annotations.Item{
		OrgId:  c.OrgId,
		UserId: c.UserId,
		Id:     annotationID,
		Epoch:  cmd.Time / 1000,
		Text:   cmd.Text,
		Tags:   cmd.Tags,
	}

	if err := repo.Update(&item); err != nil {
		return ApiError(500, "Failed to update annotation", err)
	}

	if cmd.IsRegion {
		itemRight := item
		itemRight.RegionId = item.Id
		itemRight.Epoch = cmd.TimeEnd / 1000

		// We don't know id of region right event, so set it to 0 and find then using query like
		// ... WHERE region_id = <item.RegionId> AND id != <item.RegionId> ...
		itemRight.Id = 0

		if err := repo.Update(&itemRight); err != nil {
			return ApiError(500, "Failed to update annotation for region end time", err)
		}
	}

	return ApiSuccess("Annotation updated")
}

func DeleteAnnotations(c *m.ReqContext, cmd dtos.DeleteAnnotationsCmd) Response {
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

func DeleteAnnotationById(c *m.ReqContext) Response {
	repo := annotations.GetRepository()
	annotationId := c.ParamsInt64(":annotationId")

	if resp := canSave(c, repo, annotationId); resp != nil {
		return resp
	}

	err := repo.Delete(&annotations.DeleteParams{
		Id: annotationId,
	})

	if err != nil {
		return ApiError(500, "Failed to delete annotation", err)
	}

	return ApiSuccess("Annotation deleted")
}

func DeleteAnnotationRegion(c *m.ReqContext) Response {
	repo := annotations.GetRepository()
	regionID := c.ParamsInt64(":regionId")

	if resp := canSave(c, repo, regionID); resp != nil {
		return resp
	}

	err := repo.Delete(&annotations.DeleteParams{
		RegionId: regionID,
	})

	if err != nil {
		return ApiError(500, "Failed to delete annotation region", err)
	}

	return ApiSuccess("Annotation region deleted")
}

func canSaveByDashboardID(c *m.ReqContext, dashboardID int64) (bool, error) {
	if dashboardID == 0 && !c.SignedInUser.HasRole(m.ROLE_EDITOR) {
		return false, nil
	}

	if dashboardID > 0 {
		guardian := guardian.New(dashboardID, c.OrgId, c.SignedInUser)
		if canEdit, err := guardian.CanEdit(); err != nil || !canEdit {
			return false, err
		}
	}

	return true, nil
}

func canSave(c *m.ReqContext, repo annotations.Repository, annotationId int64) Response {
	items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationId, OrgId: c.OrgId})

	if err != nil || len(items) == 0 {
		return ApiError(500, "Could not find annotation to update", err)
	}

	dashboardID := items[0].DashboardId

	if canSave, err := canSaveByDashboardID(c, dashboardID); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	return nil
}

func canSaveByRegionID(c *m.ReqContext, repo annotations.Repository, regionID int64) Response {
	items, err := repo.Find(&annotations.ItemQuery{RegionId: regionID, OrgId: c.OrgId})

	if err != nil || len(items) == 0 {
		return ApiError(500, "Could not find annotation to update", err)
	}

	dashboardID := items[0].DashboardId

	if canSave, err := canSaveByDashboardID(c, dashboardID); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	return nil
}
