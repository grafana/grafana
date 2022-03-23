package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetAnnotations(c *models.ReqContext) response.Response {
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

	items, err := repo.Find(c.Req.Context(), query)
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

func (hs *HTTPServer) PostAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PostAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	var canSave bool
	var err error
	if cmd.DashboardId != 0 {
		canSave, err = canSaveDashboardAnnotation(c, cmd.DashboardId)
	} else { // organization annotations
		if !hs.Features.IsEnabled(featuremgmt.FlagAccesscontrol) {
			canSave = canSaveOrganizationAnnotation(c)
		} else {
			// This is an additional validation needed only for FGAC Organization Annotations.
			// It is not possible to do it in the middleware because we need to look
			// into the request to determine if this is a Organization annotation or not
			canSave, err = hs.canCreateOrganizationAnnotation(c)
		}
	}

	if err != nil || !canSave {
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

func (hs *HTTPServer) PostGraphiteAnnotation(c *models.ReqContext) response.Response {
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

func (hs *HTTPServer) UpdateAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.UpdateAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	repo := annotations.GetRepository()

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.OrgId)
	if resp != nil {
		return resp
	}

	canSave := true
	if annotation.GetType() == annotations.Dashboard {
		canSave, err = canSaveDashboardAnnotation(c, annotation.DashboardId)
	} else {
		if !hs.Features.IsEnabled(featuremgmt.FlagAccesscontrol) {
			canSave = canSaveOrganizationAnnotation(c)
		}
	}

	if err != nil || !canSave {
		return dashboardGuardianResponse(err)
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

	if err := repo.Update(c.Req.Context(), &item); err != nil {
		return response.Error(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation updated")
}

func (hs *HTTPServer) PatchAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PatchAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	repo := annotations.GetRepository()

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.OrgId)
	if resp != nil {
		return resp
	}

	canSave := true
	if annotation.GetType() == annotations.Dashboard {
		canSave, err = canSaveDashboardAnnotation(c, annotation.DashboardId)
	} else {
		if !hs.Features.IsEnabled(featuremgmt.FlagAccesscontrol) {
			canSave = canSaveOrganizationAnnotation(c)
		}
	}
	if err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	existing := annotations.Item{
		OrgId:    c.OrgId,
		UserId:   c.UserId,
		Id:       annotationID,
		Epoch:    annotation.Time,
		EpochEnd: annotation.TimeEnd,
		Text:     annotation.Text,
		Tags:     annotation.Tags,
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

	if err := repo.Update(c.Req.Context(), &existing); err != nil {
		return response.Error(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation patched")
}

func (hs *HTTPServer) DeleteAnnotations(c *models.ReqContext) response.Response {
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

func (hs *HTTPServer) DeleteAnnotationByID(c *models.ReqContext) response.Response {
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	repo := annotations.GetRepository()

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.OrgId)
	if resp != nil {
		return resp
	}

	canSave := true
	if annotation.GetType() == annotations.Dashboard {
		canSave, err = canSaveDashboardAnnotation(c, annotation.DashboardId)
	} else {
		if !hs.Features.IsEnabled(featuremgmt.FlagAccesscontrol) {
			canSave = canSaveOrganizationAnnotation(c)
		}
	}

	if err != nil || !canSave {
		return dashboardGuardianResponse(err)
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

func canSaveDashboardAnnotation(c *models.ReqContext, dashboardID int64) (bool, error) {
	guard := guardian.New(c.Req.Context(), dashboardID, c.OrgId, c.SignedInUser)
	if canEdit, err := guard.CanEdit(); err != nil || !canEdit {
		return false, err
	}

	return true, nil
}

func canSaveOrganizationAnnotation(c *models.ReqContext) bool {
	return c.SignedInUser.HasRole(models.ROLE_EDITOR)
}

func findAnnotationByID(ctx context.Context, repo annotations.Repository, annotationID int64, orgID int64) (*annotations.ItemDTO, response.Response) {
	items, err := repo.Find(ctx, &annotations.ItemQuery{AnnotationId: annotationID, OrgId: orgID})

	if err != nil {
		return nil, response.Error(500, "Failed to find annotation", err)
	}

	if len(items) == 0 {
		return nil, response.Error(404, "Annotation not found", nil)
	}

	return items[0], nil
}

func (hs *HTTPServer) GetAnnotationTags(c *models.ReqContext) response.Response {
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

// AnnotationTypeScopeResolver provides an AttributeScopeResolver able to
// resolve annotation types. Scope "annotations:id:<id>" will be translated to "annotations:type:<type>,
// where <type> is the type of annotation with id <id>.
func AnnotationTypeScopeResolver() (string, accesscontrol.AttributeScopeResolveFunc) {
	annotationTypeResolver := func(ctx context.Context, orgID int64, initialScope string) (string, error) {
		scopeParts := strings.Split(initialScope, ":")
		if scopeParts[0] != accesscontrol.ScopeAnnotationsRoot || len(scopeParts) != 3 {
			return "", accesscontrol.ErrInvalidScope
		}

		annotationIdStr := scopeParts[2]
		annotationId, err := strconv.Atoi(annotationIdStr)
		if err != nil {
			return "", accesscontrol.ErrInvalidScope
		}

		annotation, resp := findAnnotationByID(ctx, annotations.GetRepository(), int64(annotationId), orgID)
		if resp != nil {
			return "", err
		}

		if annotation.GetType() == annotations.Organization {
			return accesscontrol.ScopeAnnotationsTypeOrganization, nil
		} else {
			return accesscontrol.ScopeAnnotationsTypeDashboard, nil
		}
	}
	return accesscontrol.ScopeAnnotationsProvider.GetResourceScope(""), annotationTypeResolver
}

func (hs *HTTPServer) canCreateOrganizationAnnotation(c *models.ReqContext) (bool, error) {
	evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, accesscontrol.ScopeAnnotationsTypeOrganization)
	return hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
}
