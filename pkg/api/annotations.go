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
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetAnnotations(c *models.ReqContext) response.Response {
	query := &annotations.ItemQuery{
		From:         c.QueryInt64("from"),
		To:           c.QueryInt64("to"),
		OrgId:        c.OrgId,
		UserId:       c.QueryInt64("userId"),
		AlertId:      c.QueryInt64("alertId"),
		DashboardId:  c.QueryInt64("dashboardId"),
		PanelId:      c.QueryInt64("panelId"),
		Limit:        c.QueryInt64("limit"),
		Tags:         c.QueryStrings("tags"),
		Type:         c.Query("type"),
		MatchAny:     c.QueryBool("matchAny"),
		SignedInUser: c.SignedInUser,
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

	return response.JSON(http.StatusOK, items)
}

type AnnotationError struct {
	message string
}

func (e *AnnotationError) Error() string {
	return e.message
}

func (hs *HTTPServer) PostAnnotation(c *models.ReqContext) response.Response {
	cmd := dtos.PostAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if canSave, err := hs.canCreateAnnotation(c, cmd.DashboardId); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	repo := annotations.GetRepository()

	if cmd.Text == "" {
		err := &AnnotationError{"text field should not be empty"}
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

	return response.JSON(http.StatusOK, util.DynMap{
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
		err := &AnnotationError{"what field should not be empty"}
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
				err := &AnnotationError{"tag should be a string"}
				return response.Error(400, "Failed to save Graphite annotation", err)
			}
		}
	default:
		err := &AnnotationError{"unsupported tags format"}
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

	return response.JSON(http.StatusOK, util.DynMap{
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

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
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

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
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

func (hs *HTTPServer) MassDeleteAnnotations(c *models.ReqContext) response.Response {
	cmd := dtos.MassDeleteAnnotationsCmd{}
	err := web.Bind(c.Req, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if (cmd.DashboardId != 0 && cmd.PanelId == 0) || (cmd.PanelId != 0 && cmd.DashboardId == 0) {
		err := &AnnotationError{message: "DashboardId and PanelId are both required for mass delete"}
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	repo := annotations.GetRepository()
	var deleteParams *annotations.DeleteParams

	// validations only for RBAC. A user can mass delete all annotations in a (dashboard + panel) or a specific annotation
	// if has access to that dashboard.
	if !hs.AccessControl.IsDisabled() {
		var dashboardId int64

		if cmd.AnnotationId != 0 {
			annotation, respErr := findAnnotationByID(c.Req.Context(), repo, cmd.AnnotationId, c.SignedInUser)
			if respErr != nil {
				return respErr
			}
			dashboardId = annotation.DashboardId
			deleteParams = &annotations.DeleteParams{
				OrgId: c.OrgId,
				Id:    cmd.AnnotationId,
			}
		} else {
			dashboardId = cmd.DashboardId
			deleteParams = &annotations.DeleteParams{
				OrgId:       c.OrgId,
				DashboardId: cmd.DashboardId,
				PanelId:     cmd.PanelId,
			}
		}

		canSave, err := hs.canMassDeleteAnnotations(c, dashboardId)
		if err != nil || !canSave {
			return dashboardGuardianResponse(err)
		}
	} else { // legacy permissions
		deleteParams = &annotations.DeleteParams{
			OrgId:       c.OrgId,
			Id:          cmd.AnnotationId,
			DashboardId: cmd.DashboardId,
			PanelId:     cmd.PanelId,
		}
	}

	err = repo.Delete(c.Req.Context(), deleteParams)

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

	annotation, resp := findAnnotationByID(c.Req.Context(), repo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	err = repo.Delete(c.Req.Context(), &annotations.DeleteParams{
		OrgId: c.OrgId,
		Id:    annotationID,
	})
	if err != nil {
		return response.Error(500, "Failed to delete annotation", err)
	}

	return response.Success("Annotation deleted")
}

func (hs *HTTPServer) canSaveAnnotation(c *models.ReqContext, annotation *annotations.ItemDTO) (bool, error) {
	if annotation.GetType() == annotations.Dashboard {
		return canEditDashboard(c, annotation.DashboardId)
	} else {
		if hs.AccessControl.IsDisabled() {
			return c.SignedInUser.HasRole(models.ROLE_EDITOR), nil
		}
		return true, nil
	}
}

func canEditDashboard(c *models.ReqContext, dashboardID int64) (bool, error) {
	guard := guardian.New(c.Req.Context(), dashboardID, c.OrgId, c.SignedInUser)
	if canEdit, err := guard.CanEdit(); err != nil || !canEdit {
		return false, err
	}

	return true, nil
}

func findAnnotationByID(ctx context.Context, repo annotations.Repository, annotationID int64, user *models.SignedInUser) (*annotations.ItemDTO, response.Response) {
	query := &annotations.ItemQuery{
		AnnotationId: annotationID,
		OrgId:        user.OrgId,
		SignedInUser: user,
	}
	items, err := repo.Find(ctx, query)

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
	result, err := repo.FindTags(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to find annotation tags", err)
	}

	return response.JSON(http.StatusOK, annotations.GetAnnotationTagsResponse{Result: result})
}

// AnnotationTypeScopeResolver provides an ScopeAttributeResolver able to
// resolve annotation types. Scope "annotations:id:<id>" will be translated to "annotations:type:<type>,
// where <type> is the type of annotation with id <id>.
func AnnotationTypeScopeResolver() (string, accesscontrol.ScopeAttributeResolver) {
	prefix := accesscontrol.ScopeAnnotationsProvider.GetResourceScope("")
	return prefix, accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, initialScope string) ([]string, error) {
		scopeParts := strings.Split(initialScope, ":")
		if scopeParts[0] != accesscontrol.ScopeAnnotationsRoot || len(scopeParts) != 3 {
			return nil, accesscontrol.ErrInvalidScope
		}

		annotationIdStr := scopeParts[2]
		annotationId, err := strconv.Atoi(annotationIdStr)
		if err != nil {
			return nil, accesscontrol.ErrInvalidScope
		}

		// tempUser is used to resolve annotation type.
		// The annotation doesn't get returned to the real user, so real user's permissions don't matter here.
		tempUser := &models.SignedInUser{
			OrgId: orgID,
			Permissions: map[int64]map[string][]string{
				orgID: {
					accesscontrol.ActionDashboardsRead:  {accesscontrol.ScopeDashboardsAll},
					accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				},
			},
		}

		annotation, resp := findAnnotationByID(ctx, annotations.GetRepository(), int64(annotationId), tempUser)
		if resp != nil {
			return nil, errors.New("could not resolve annotation type")
		}

		if annotation.GetType() == annotations.Organization {
			return []string{accesscontrol.ScopeAnnotationsTypeOrganization}, nil
		} else {
			return []string{accesscontrol.ScopeAnnotationsTypeDashboard}, nil
		}
	})
}

func (hs *HTTPServer) canCreateAnnotation(c *models.ReqContext, dashboardId int64) (bool, error) {
	if dashboardId != 0 {
		if !hs.AccessControl.IsDisabled() {
			evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, accesscontrol.ScopeAnnotationsTypeDashboard)
			if canSave, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator); err != nil || !canSave {
				return canSave, err
			}
		}
		return canEditDashboard(c, dashboardId)
	} else { // organization annotations
		if !hs.AccessControl.IsDisabled() {
			evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, accesscontrol.ScopeAnnotationsTypeOrganization)
			return hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
		} else {
			return c.SignedInUser.HasRole(models.ROLE_EDITOR), nil
		}
	}
}

func (hs *HTTPServer) canMassDeleteAnnotations(c *models.ReqContext, dashboardID int64) (bool, error) {
	if dashboardID == 0 {
		evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, accesscontrol.ScopeAnnotationsTypeOrganization)
		return hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
	} else {
		evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, accesscontrol.ScopeAnnotationsTypeDashboard)
		canSave, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
		if err != nil || !canSave {
			return false, err
		}

		canSave, err = canEditDashboard(c, dashboardID)
		if err != nil || !canSave {
			return false, err
		}
	}

	return true, nil
}
