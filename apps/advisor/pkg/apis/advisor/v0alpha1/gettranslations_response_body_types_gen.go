// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GetTranslationsBody struct {
	// Flat map of i18n key -> translated string for the requested locale.
	Translations map[string]string `json:"translations"`
}

// NewGetTranslationsBody creates a new GetTranslationsBody object.
func NewGetTranslationsBody() *GetTranslationsBody {
	return &GetTranslationsBody{
		Translations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetTranslationsBody.
func (GetTranslationsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.advisor.pkg.apis.advisor.v0alpha1.GetTranslationsBody"
}
