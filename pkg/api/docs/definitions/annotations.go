package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/annotations"
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

// swagger:route GET /annotations/{annotation_id} annotations getAnnotation
//
// Get Annotation by Id.
//
// Responses:
// 200: getAnnotationResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route POST /annotations/mass-delete annotations massDeleteAnnotations
//
// Delete multiple annotations.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 500: internalServerError

// swagger:route POST /annotations annotations createAnnotation
//
// Create Annotation.
//
// Creates an annotation in the Grafana database. The dashboardId and panelId fields are optional. If they are not specified then an organization annotation is created and can be queried in any dashboard that adds the Grafana annotations data source. When creating a region annotation include the timeEnd property.
// The format for `time` and `timeEnd` should be epoch numbers in millisecond resolution.
// The response for this HTTP request is slightly different in versions prior to v6.4. In prior versions you would also get an endId if you where creating a region. But in 6.4 regions are represented using a single event with time and timeEnd properties.
//
// Responses:
// 200: createAnnotationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /annotations/graphite annotations createGraphiteAnnotation
//
// Create Annotation in Graphite format.
//
// Creates an annotation by using Graphite-compatible event format. The `when` and `data` fields are optional. If `when` is not specified then the current time will be used as annotation’s timestamp. The `tags` field can also be in prior to Graphite `0.10.0` format (string with multiple tags being separated by a space).
//
// Responses:
// 200: createAnnotationResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

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

// swagger:route PATCH /annotations/{annotation_id} annotations patchAnnotation
//
// Patch Annotation
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

// swagger:route DELETE /annotations/{annotation_id} annotations deleteAnnotation
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

// swagger:parameters getAnnotation
type GetAnnotationParams struct {
	// in:path
	// required:true
	AnnotationID string `json:"annotation_id"`
}

// swagger:parameters deleteAnnotation
type DeleteAnnotationParams struct {
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
type GetAnnotationTagssParams struct {
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

// swagger:parameters createAnnotation
type CreateAnnotationParams struct {
	// in:body
	// required:true
	Body dtos.PostAnnotationsCmd `json:"body"`
}

// swagger:parameters createGraphiteAnnotation
type CreateGraphiteAnnotationParams struct {
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

// swagger:response getAnnotationResponse
type GetAnnotationResponse struct {
	// The response message
	// in: body
	Body *annotations.ItemDTO `json:"body"`
}

// swagger:response createAnnotationResponse
type CreateAnnotationResponse struct {
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
