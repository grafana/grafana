// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetUserTeamsRequestParams struct {
	Limit    int64  `json:"limit"`
	Continue string `json:"continue"`
}

// NewGetUserTeamsRequestParams creates a new GetUserTeamsRequestParams object.
func NewGetUserTeamsRequestParams() *GetUserTeamsRequestParams {
	return &GetUserTeamsRequestParams{
		Limit:    0,
		Continue: "",
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetUserTeamsRequestParams.
func (GetUserTeamsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.GetUserTeamsRequestParams"
}
