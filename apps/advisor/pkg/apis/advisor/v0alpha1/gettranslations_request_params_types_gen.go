// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type GetTranslationsRequestParams struct {
	// BCP 47 locale (e.g. "es-ES"). Defaults to "en-US" server-side if empty.
	Lang string `json:"lang"`
}

// NewGetTranslationsRequestParams creates a new GetTranslationsRequestParams object.
func NewGetTranslationsRequestParams() *GetTranslationsRequestParams {
	return &GetTranslationsRequestParams{}
}

// OpenAPIModelName returns the OpenAPI model name for GetTranslationsRequestParams.
func (GetTranslationsRequestParams) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.GetTranslationsRequestParams"
}
