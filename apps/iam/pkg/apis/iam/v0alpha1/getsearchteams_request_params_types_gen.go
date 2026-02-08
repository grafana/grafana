// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetSearchTeamsRequestParams struct {
	Query  *string `json:"query,omitempty"`
	Limit  int64   `json:"limit,omitempty"`
	Offset int64   `json:"offset,omitempty"`
	Page   int64   `json:"page,omitempty"`
}

// NewGetSearchTeamsRequestParams creates a new GetSearchTeamsRequestParams object.
func NewGetSearchTeamsRequestParams() *GetSearchTeamsRequestParams {
	return &GetSearchTeamsRequestParams{}
}
func (GetSearchTeamsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetSearchTeamsRequestParams"
}
