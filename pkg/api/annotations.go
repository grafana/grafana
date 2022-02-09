package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func GetAnnotations(c *models.ReqContext) response.Response {
	query := &annotations.ItemQuery{
		From:        c.QueryInt64("from"),
		To:          c.QueryInt64("to"),
		OrgId:       c.OrgId,
		UserId:      c.QueryInt64("userId"),
		AlertId:     c.QueryInt64("alertId"),
		DashboardId: c.QueryInt64("dashboardId"),
		PanelId:     c.QueryInt64("panelId"),
		Limit:       c.QueryInt64("limit"),
		Tags:        c.QueryStrings("tags"),
		Type:        c.Query("type"),
		MatchAny:    c.QueryBool("matchAny"),
	}

	repo := annotations.GetRepository()

	items, err := repo.Find(query)
	if err != nil {
		return response.Error(500, "Failed to get annotations", err)
	}

	for _, item := range items {
		if item.Email != "" {
			item.AvatarUrl = dtos.GetGravatarUrl(item.Email)
		}
	}

	return response.JSON(200, items)
}

type CreateAnnotationError struct {
	message string
}

func (e *CreateAnnotationError) Error() string {
	return e.message
}

func PostAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PostAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if canSave, err := canSaveByDashboardID(c, cmd.DashboardId); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	repo := annotations.GetRepository()

	if cmd.Text == "" {
		err := &CreateAnnotationError{"text field should not be empty"}
		return response.Error(400, "Failed to save annotation", err)
	}

	item := annotations.Item{
		OrgId:       c.OrgId,
		UserId:      c.UserId,
		DashboardId: cmd.DashboardId,
		PanelId:     cmd.PanelId,
		Epoch:       cmd.Time,
		EpochEnd:    cmd.TimeEnd,
		Text:        cmd.Text,
		Data:        cmd.Data,
		Tags:        cmd.Tags,
	}

	if err := repo.Save(&item); err != nil {
		if errors.Is(err, annotations.ErrTimerangeMissing) {
			return response.Error(400, "Failed to save annotation", err)
		}
		return response.Error(500, "Failed to save annotation", err)
	}

	startID := item.Id

	return response.JSON(200, util.DynMap{
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

func PostGraphiteAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PostGraphiteAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	repo := annotations.GetRepository()

	if cmd.What == "" {
		err := &CreateAnnotationError{"what field should not be empty"}
		return response.Error(400, "Failed to save Graphite annotation", err)
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
				return response.Error(400, "Failed to save Graphite annotation", err)
			}
		}
	default:
		err := &CreateAnnotationError{"unsupported tags format"}
		return response.Error(400, "Failed to save Graphite annotation", err)
	}

	item := annotations.Item{
		OrgId:  c.OrgId,
		UserId: c.UserId,
		Epoch:  cmd.When * 1000,
		Text:   text,
		Tags:   tagsArray,
	}

	if err := repo.Save(&item); err != nil {
		return response.Error(500, "Failed to save Graphite annotation", err)
	}

	return response.JSON(200, util.DynMap{
		"message": "Graphite annotation added",
		"id":      item.Id,
	})
}

func UpdateAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.UpdateAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	repo := annotations.GetRepository()

	if resp := canSave(c, repo, annotationID); resp != nil {
		return resp
	}

	item := annotations.Item{
		OrgId:    c.OrgId,
		UserId:   c.UserId,
		Id:       annotationID,
		Epoch:    cmd.Time,
		EpochEnd: cmd.TimeEnd,
		Text:     cmd.Text,
		Tags:     cmd.Tags,
	}

	if err := repo.Update(&item); err != nil {
		return response.Error(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation updated")
}

func PatchAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PatchAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	repo := annotations.GetRepository()

	if resp := canSave(c, repo, annotationID); resp != nil {
		return resp
	}

	items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: c.OrgId})

	if err != nil || len(items) == 0 {
		return response.Error(404, "Could not find annotation to update", err)
	}

	existing := annotations.Item{
		OrgId:    c.OrgId,
		UserId:   c.UserId,
		Id:       annotationID,
		Epoch:    items[0].Time,
		EpochEnd: items[0].TimeEnd,
		Text:     items[0].Text,
		Tags:     items[0].Tags,
	}

	if cmd.Tags != nil {
		existing.Tags = cmd.Tags
	}

	if cmd.Text != "" && cmd.Text != existing.Text {
		existing.Text = cmd.Text
	}

	if cmd.Time > 0 && cmd.Time != existing.Epoch {
		existing.Epoch = cmd.Time
	}

	if cmd.TimeEnd > 0 && cmd.TimeEnd != existing.EpochEnd {
		existing.EpochEnd = cmd.TimeEnd
	}

	if err := repo.Update(&existing); err != nil {
		return response.Error(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation patched")
}

func DeleteAnnotations(c *models.ReqContext) response.Response {
	cmd := dtos.DeleteAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	repo := annotations.GetRepository()

	err := repo.Delete(&annotations.DeleteParams{
		OrgId:       c.OrgId,
		Id:          cmd.AnnotationId,
		DashboardId: cmd.DashboardId,
		PanelId:     cmd.PanelId,
	})

	if err != nil {
		return response.Error(500, "Failed to delete annotations", err)
	}

	return response.Success("Annotations deleted")
}

func DeleteAnnotationByID(c *models.ReqContext) response.Response {
	repo := annotations.GetRepository()
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	if resp := canSave(c, repo, annotationID); resp != nil {
		return resp
	}

	err = repo.Delete(&annotations.DeleteParams{
		OrgId: c.OrgId,
		Id:    annotationID,
	})
	if err != nil {
		return response.Error(500, "Failed to delete annotation", err)
	}

	return response.Success("Annotation deleted")
}

func canSaveByDashboardID(c *models.ReqContext, dashboardID int64) (bool, error) {
	if dashboardID == 0 && !c.SignedInUser.HasRole(models.ROLE_EDITOR) {
		return false, nil
	}

	if dashboardID != 0 {
		guard := guardian.New(c.Req.Context(), dashboardID, c.OrgId, c.SignedInUser)
		if canEdit, err := guard.CanEdit(); err != nil || !canEdit {
			return false, err
		}
	}

	return true, nil
}

func canSave(c *models.ReqContext, repo annotations.Repository, annotationID int64) response.Response {
	items, err := repo.Find(&annotations.ItemQuery{AnnotationId: annotationID, OrgId: c.OrgId})
	if err != nil || len(items) == 0 {
		return response.Error(500, "Could not find annotation to update", err)
	}

	dashboardID := items[0].DashboardId

	if canSave, err := canSaveByDashboardID(c, dashboardID); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	return nil
}

func GetAnnotationTags(c *models.ReqContext) response.Response {
	query := &annotations.TagsQuery{
		OrgID: c.OrgId,
		Tag:   c.Query("tag"),
		Limit: c.QueryInt64("limit"),
	}

	repo := annotations.GetRepository()
	result, err := repo.FindTags(query)
	if err != nil {
		return response.Error(500, "Failed to find annotation tags", err)
	}

	return response.JSON(200, annotations.GetAnnotationTagsResponse{Result: result})
}
