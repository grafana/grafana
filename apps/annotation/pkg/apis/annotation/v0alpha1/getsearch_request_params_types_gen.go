// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchRequestParams struct {
	// Return only annotations on the dashboard with this UID.
	DashboardUID *string `json:"dashboardUID,omitempty"`
	// Return only annotations on the panel with this ID.
	PanelID *int64 `json:"panelID,omitempty"`
	// Start of the time range, in milliseconds since the Unix epoch.
	From *int64 `json:"from,omitempty"`
	// End of the time range, in milliseconds since the Unix epoch.
	To *int64 `json:"to,omitempty"`
	// Maximum number of annotations to return in one page. Defaults to 100.
	Limit *int64 `json:"limit,omitempty"`
	// Continue token from the metadata.continue field of the previous page.
	Continue *string `json:"continue,omitempty"`
	// Return only annotations with these tags. Repeat the parameter to pass several tags.
	Tag []string `json:"tag,omitempty"`
	// If true, match annotations that have any of the tags. If false (the default), an annotation must have all of them.
	TagsMatchAny *bool `json:"tagsMatchAny,omitempty"`
	// Return only annotations with these scopes. Repeat the parameter to pass several scopes.
	Scope []string `json:"scope,omitempty"`
	// If true (the default), match annotations that have any of the scopes. If false, an annotation must have all of them.
	ScopesMatchAny *bool `json:"scopesMatchAny,omitempty"`
	// Return only annotations created by the user with this UID.
	CreatedBy *string `json:"createdBy,omitempty"`
	// Return only the annotation with this ID from the legacy /api/annotations API.
	LegacyID *int64 `json:"legacyID,omitempty"`
	// Whether to return deleted annotations. "include" returns deleted and live annotations, "only" returns only deleted ones. Live annotations only by default.
	Deleted *GetSearchRequestParamsDeleted `json:"deleted,omitempty"`
}

// NewGetSearchRequestParams creates a new GetSearchRequestParams object.
func NewGetSearchRequestParams() *GetSearchRequestParams {
	return &GetSearchRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetSearchRequestParams.
func (GetSearchRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchRequestParams"
}

type GetSearchRequestParamsDeleted string

const (
	GetSearchRequestParamsDeletedInclude GetSearchRequestParamsDeleted = "include"
	GetSearchRequestParamsDeletedOnly    GetSearchRequestParamsDeleted = "only"
)

// OpenAPIModelName returns the OpenAPI model name for GetSearchRequestParamsDeleted.
func (GetSearchRequestParamsDeleted) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.GetSearchRequestParamsDeleted"
}
