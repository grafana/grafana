package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /annotations annotations getAnnotations
//
// Find Annotations.
//
// Starting in Grafana v6.4 regions annotations are now returned in one entity that now includes the timeEnd property.
//
// Responses:
// 200: getAnnotationsResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetAnnotations(c *contextmodel.ReqContext) response.Response {
	query := &annotations.ItemQuery{
		From:         c.QueryInt64("from"),
		To:           c.QueryInt64("to"),
		OrgID:        c.OrgID,
		UserID:       c.QueryInt64("userId"),
		AlertID:      c.QueryInt64("alertId"),
		DashboardID:  c.QueryInt64("dashboardId"),
		DashboardUID: c.Query("dashboardUID"),
		PanelID:      c.QueryInt64("panelId"),
		Limit:        c.QueryInt64("limit"),
		Tags:         c.QueryStrings("tags"),
		Type:         c.Query("type"),
		MatchAny:     c.QueryBool("matchAny"),
		SignedInUser: c.SignedInUser,
	}

	// When dashboard UID present in the request, we ignore dashboard ID
	if query.DashboardUID != "" {
		dq := dashboards.GetDashboardQuery{UID: query.DashboardUID, OrgID: c.OrgID}
		dqResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &dq)
		if err != nil {
			return response.Error(http.StatusBadRequest, "Invalid dashboard UID in annotation request", err)
		} else {
			query.DashboardID = dqResult.ID
		}
	}

	items, err := hs.annotationsRepo.Find(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to get annotations", err)
	}

	// since there are several annotations per dashboard, we can cache dashboard uid
	dashboardCache := make(map[int64]*string)
	for _, item := range items {
		if item.Email != "" {
			item.AvatarURL = dtos.GetGravatarUrl(item.Email)
		}

		if item.DashboardID != 0 {
			if val, ok := dashboardCache[item.DashboardID]; ok {
				item.DashboardUID = val
			} else {
				query := dashboards.GetDashboardQuery{ID: item.DashboardID, OrgID: c.OrgID}
				queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
				if err == nil && queryResult != nil {
					item.DashboardUID = &queryResult.UID
					dashboardCache[item.DashboardID] = &queryResult.UID
				}
			}
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

// swagger:route POST /annotations annotations postAnnotation
//
// Create Annotation.
//
// Creates an annotation in the Grafana database. The dashboardId and panelId fields are optional. If they are not specified then an organization annotation is created and can be queried in any dashboard that adds the Grafana annotations data source. When creating a region annotation include the timeEnd property.
// The format for `time` and `timeEnd` should be epoch numbers in millisecond resolution.
// The response for this HTTP request is slightly different in versions prior to v6.4. In prior versions you would also get an endId if you where creating a region. But in 6.4 regions are represented using a single event with time and timeEnd properties.
//
// Responses:
// 200: postAnnotationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) PostAnnotation(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.PostAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// overwrite dashboardId when dashboardUID is not empty
	if cmd.DashboardUID != "" {
		query := dashboards.GetDashboardQuery{OrgID: c.OrgID, UID: cmd.DashboardUID}
		queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
		if err == nil {
			cmd.DashboardId = queryResult.ID
		}
	}

	if canSave, err := hs.canCreateAnnotation(c, cmd.DashboardId); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	if cmd.Text == "" {
		err := &AnnotationError{"text field should not be empty"}
		return response.Error(400, "Failed to save annotation", err)
	}

	item := annotations.Item{
		OrgID:       c.OrgID,
		UserID:      c.UserID,
		DashboardID: cmd.DashboardId,
		PanelID:     cmd.PanelId,
		Epoch:       cmd.Time,
		EpochEnd:    cmd.TimeEnd,
		Text:        cmd.Text,
		Data:        cmd.Data,
		Tags:        cmd.Tags,
	}

	if err := hs.annotationsRepo.Save(c.Req.Context(), &item); err != nil {
		if errors.Is(err, annotations.ErrTimerangeMissing) {
			return response.Error(400, "Failed to save annotation", err)
		}
		return response.ErrOrFallback(500, "Failed to save annotation", err)
	}

	startID := item.ID

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

// swagger:route POST /annotations/graphite annotations postGraphiteAnnotation
//
// Create Annotation in Graphite format.
//
// Creates an annotation by using Graphite-compatible event format. The `when` and `data` fields are optional. If `when` is not specified then the current time will be used as annotation’s timestamp. The `tags` field can also be in prior to Graphite `0.10.0` format (string with multiple tags being separated by a space).
//
// Responses:
// 200: postAnnotationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) PostGraphiteAnnotation(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.PostGraphiteAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
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
		OrgID:  c.OrgID,
		UserID: c.UserID,
		Epoch:  cmd.When * 1000,
		Text:   text,
		Tags:   tagsArray,
	}

	if err := hs.annotationsRepo.Save(c.Req.Context(), &item); err != nil {
		return response.ErrOrFallback(500, "Failed to save Graphite annotation", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Graphite annotation added",
		"id":      item.ID,
	})
}

// swagger:route PUT /annotations/{annotation_id} annotations updateAnnotation
//
// Update Annotation.
//
// Updates all properties of an annotation that matches the specified id. To only update certain property, consider using the Patch Annotation operation.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateAnnotation(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.UpdateAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	annotation, resp := findAnnotationByID(c.Req.Context(), hs.annotationsRepo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	item := annotations.Item{
		OrgID:    c.OrgID,
		UserID:   c.UserID,
		ID:       annotationID,
		Epoch:    cmd.Time,
		EpochEnd: cmd.TimeEnd,
		Text:     cmd.Text,
		Tags:     cmd.Tags,
		Data:     annotation.Data,
	}

	if cmd.Data != nil {
		item.Data = cmd.Data
	}

	if err := hs.annotationsRepo.Update(c.Req.Context(), &item); err != nil {
		return response.ErrOrFallback(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation updated")
}

// swagger:route PATCH /annotations/{annotation_id} annotations patchAnnotation
//
// Patch Annotation.
//
// Updates one or more properties of an annotation that matches the specified ID.
// This operation currently supports updating of the `text`, `tags`, `time` and `timeEnd` properties.
// This is available in Grafana 6.0.0-beta2 and above.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) PatchAnnotation(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.PatchAnnotationsCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	annotation, resp := findAnnotationByID(c.Req.Context(), hs.annotationsRepo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	existing := annotations.Item{
		OrgID:    c.OrgID,
		UserID:   c.UserID,
		ID:       annotationID,
		Epoch:    annotation.Time,
		EpochEnd: annotation.TimeEnd,
		Text:     annotation.Text,
		Tags:     annotation.Tags,
		Data:     annotation.Data,
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

	if cmd.Data != nil {
		existing.Data = cmd.Data
	}

	if err := hs.annotationsRepo.Update(c.Req.Context(), &existing); err != nil {
		return response.ErrOrFallback(500, "Failed to update annotation", err)
	}

	return response.Success("Annotation patched")
}

// swagger:route POST /annotations/mass-delete annotations massDeleteAnnotations
//
// Delete multiple annotations.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) MassDeleteAnnotations(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.MassDeleteAnnotationsCmd{}
	err := web.Bind(c.Req, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.DashboardUID != "" {
		query := dashboards.GetDashboardQuery{OrgID: c.OrgID, UID: cmd.DashboardUID}
		queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
		if err == nil {
			cmd.DashboardId = queryResult.ID
		}
	}

	if (cmd.DashboardId != 0 && cmd.PanelId == 0) || (cmd.PanelId != 0 && cmd.DashboardId == 0) {
		err := &AnnotationError{message: "DashboardId and PanelId are both required for mass delete"}
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	var deleteParams *annotations.DeleteParams

	// validations only for RBAC. A user can mass delete all annotations in a (dashboard + panel) or a specific annotation
	// if has access to that dashboard.
	var dashboardId int64

	if cmd.AnnotationId != 0 {
		annotation, respErr := findAnnotationByID(c.Req.Context(), hs.annotationsRepo, cmd.AnnotationId, c.SignedInUser)
		if respErr != nil {
			return respErr
		}
		dashboardId = annotation.DashboardID
		deleteParams = &annotations.DeleteParams{
			OrgID: c.OrgID,
			ID:    cmd.AnnotationId,
		}
	} else {
		dashboardId = cmd.DashboardId
		deleteParams = &annotations.DeleteParams{
			OrgID:       c.OrgID,
			DashboardID: cmd.DashboardId,
			PanelID:     cmd.PanelId,
		}
	}

	canSave, err := hs.canMassDeleteAnnotations(c, dashboardId)
	if err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	err = hs.annotationsRepo.Delete(c.Req.Context(), deleteParams)

	if err != nil {
		return response.Error(500, "Failed to delete annotations", err)
	}

	return response.Success("Annotations deleted")
}

// swagger:route GET /annotations/{annotation_id} annotations getAnnotationByID
//
// Get Annotation by ID.
//
// Responses:
// 200: getAnnotationByIDResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetAnnotationByID(c *contextmodel.ReqContext) response.Response {
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	annotation, resp := findAnnotationByID(c.Req.Context(), hs.annotationsRepo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if annotation.Email != "" {
		annotation.AvatarURL = dtos.GetGravatarUrl(annotation.Email)
	}

	return response.JSON(200, annotation)
}

// swagger:route DELETE /annotations/{annotation_id} annotations deleteAnnotationByID
//
// Delete Annotation By ID.
//
// Deletes the annotation that matches the specified ID.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) DeleteAnnotationByID(c *contextmodel.ReqContext) response.Response {
	annotationID, err := strconv.ParseInt(web.Params(c.Req)[":annotationId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "annotationId is invalid", err)
	}

	annotation, resp := findAnnotationByID(c.Req.Context(), hs.annotationsRepo, annotationID, c.SignedInUser)
	if resp != nil {
		return resp
	}

	if canSave, err := hs.canSaveAnnotation(c, annotation); err != nil || !canSave {
		return dashboardGuardianResponse(err)
	}

	err = hs.annotationsRepo.Delete(c.Req.Context(), &annotations.DeleteParams{
		OrgID: c.OrgID,
		ID:    annotationID,
	})
	if err != nil {
		return response.Error(500, "Failed to delete annotation", err)
	}

	return response.Success("Annotation deleted")
}

func (hs *HTTPServer) canSaveAnnotation(c *contextmodel.ReqContext, annotation *annotations.ItemDTO) (bool, error) {
	if annotation.GetType() == annotations.Dashboard {
		return canEditDashboard(c, annotation.DashboardID)
	} else {
		return true, nil
	}
}

func canEditDashboard(c *contextmodel.ReqContext, dashboardID int64) (bool, error) {
	guard, err := guardian.New(c.Req.Context(), dashboardID, c.OrgID, c.SignedInUser)
	if err != nil {
		return false, err
	}

	if canEdit, err := guard.CanEdit(); err != nil || !canEdit {
		return false, err
	}

	return true, nil
}

func findAnnotationByID(ctx context.Context, repo annotations.Repository, annotationID int64, user *user.SignedInUser) (*annotations.ItemDTO, response.Response) {
	query := &annotations.ItemQuery{
		AnnotationID: annotationID,
		OrgID:        user.OrgID,
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

// swagger:route GET /annotations/tags annotations getAnnotationTags
//
// Find Annotations Tags.
//
// Find all the event tags created in the annotations.
//
// Responses:
// 200: getAnnotationTagsResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetAnnotationTags(c *contextmodel.ReqContext) response.Response {
	query := &annotations.TagsQuery{
		OrgID: c.OrgID,
		Tag:   c.Query("tag"),
		Limit: c.QueryInt64("limit"),
	}

	result, err := hs.annotationsRepo.FindTags(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, "Failed to find annotation tags", err)
	}

	return response.JSON(http.StatusOK, annotations.GetAnnotationTagsResponse{Result: result})
}

// AnnotationTypeScopeResolver provides an ScopeAttributeResolver able to
// resolve annotation types. Scope "annotations:id:<id>" will be translated to "annotations:type:<type>,
// where <type> is the type of annotation with id <id>.
func AnnotationTypeScopeResolver(annotationsRepo annotations.Repository) (string, accesscontrol.ScopeAttributeResolver) {
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
		tempUser := &user.SignedInUser{
			OrgID: orgID,
			Permissions: map[int64]map[string][]string{
				orgID: {
					dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
					accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				},
			},
		}

		annotation, resp := findAnnotationByID(ctx, annotationsRepo, int64(annotationId), tempUser)
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

func (hs *HTTPServer) canCreateAnnotation(c *contextmodel.ReqContext, dashboardId int64) (bool, error) {
	if dashboardId != 0 {
		evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, accesscontrol.ScopeAnnotationsTypeDashboard)
		if canSave, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator); err != nil || !canSave {
			return canSave, err
		}

		return canEditDashboard(c, dashboardId)
	} else { // organization annotations
		evaluator := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, accesscontrol.ScopeAnnotationsTypeOrganization)
		return hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluator)
	}
}

func (hs *HTTPServer) canMassDeleteAnnotations(c *contextmodel.ReqContext, dashboardID int64) (bool, error) {
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

// swagger:parameters getAnnotationByID
type GetAnnotationByIDParams struct {
	// in:path
	// required:true
	AnnotationID string `json:"annotation_id"`
}

// swagger:parameters deleteAnnotationByID
type DeleteAnnotationByIDParams struct {
	// in:path
	// required:true
	AnnotationID string `json:"annotation_id"`
}

// swagger:parameters getAnnotations
type GetAnnotationsParams struct {
	// Find annotations created after specific epoch datetime in milliseconds.
	// in:query
	// required:false
	From int64 `json:"from"`
	// Find annotations created before specific epoch datetime in milliseconds.
	// in:query
	// required:false
	To int64 `json:"to"`
	// Limit response to annotations created by specific user.
	// in:query
	// required:false
	UserID int64 `json:"userId"`
	// Find annotations for a specified alert.
	// in:query
	// required:false
	AlertID int64 `json:"alertId"`
	// Find annotations that are scoped to a specific dashboard
	// in:query
	// required:false
	DashboardID int64 `json:"dashboardId"`
	// Find annotations that are scoped to a specific dashboard
	// in:query
	// required:false
	DashboardUID string `json:"dashboardUID"`
	// Find annotations that are scoped to a specific panel
	// in:query
	// required:false
	PanelID int64 `json:"panelId"`
	// Max limit for results returned.
	// in:query
	// required:false
	Limit int64 `json:"limit"`
	// Use this to filter organization annotations. Organization annotations are annotations from an annotation data source that are not connected specifically to a dashboard or panel. You can filter by multiple tags.
	// in:query
	// required:false
	// type: array
	// collectionFormat: multi
	Tags []string `json:"tags"`
	// Return alerts or user created annotations
	// in:query
	// required:false
	// Description:
	// * `alert`
	// * `annotation`
	// enum: alert,annotation
	Type string `json:"type"`
	// Match any or all tags
	// in:query
	// required:false
	MatchAny bool `json:"matchAny"`
}

// swagger:parameters getAnnotationTags
type GetAnnotationTagsParams struct {
	// Tag is a string that you can use to filter tags.
	// in:query
	// required:false
	Tag string `json:"tag"`
	// Max limit for results returned.
	// in:query
	// required:false
	// default: 100
	Limit string `json:"limit"`
}

// swagger:parameters massDeleteAnnotations
type MassDeleteAnnotationsParams struct {
	// in:body
	// required:true
	Body dtos.MassDeleteAnnotationsCmd `json:"body"`
}

// swagger:parameters postAnnotation
type PostAnnotationParams struct {
	// in:body
	// required:true
	Body dtos.PostAnnotationsCmd `json:"body"`
}

// swagger:parameters postGraphiteAnnotation
type PostGraphiteAnnotationParams struct {
	// in:body
	// required:true
	Body dtos.PostGraphiteAnnotationsCmd `json:"body"`
}

// swagger:parameters updateAnnotation
type UpdateAnnotationParams struct {
	// in:path
	// required:true
	AnnotationID string `json:"annotation_id"`
	// in:body
	// required:true
	Body dtos.UpdateAnnotationsCmd `json:"body"`
}

// swagger:parameters patchAnnotation
type PatchAnnotationParams struct {
	// in:path
	// required:true
	AnnotationID string `json:"annotation_id"`
	// in:body
	// required:true
	Body dtos.PatchAnnotationsCmd `json:"body"`
}

// swagger:response getAnnotationsResponse
type GetAnnotationsResponse struct {
	// The response message
	// in: body
	Body []*annotations.ItemDTO `json:"body"`
}

// swagger:response getAnnotationByIDResponse
type GetAnnotationByIDResponse struct {
	// The response message
	// in: body
	Body *annotations.ItemDTO `json:"body"`
}

// swagger:response postAnnotationResponse
type PostAnnotationResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the created annotation.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Message Message of the created annotation.
		// required: true
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response getAnnotationTagsResponse
type GetAnnotationTagsResponse struct {
	// The response message
	// in: body
	Body annotations.GetAnnotationTagsResponse `json:"body"`
}
