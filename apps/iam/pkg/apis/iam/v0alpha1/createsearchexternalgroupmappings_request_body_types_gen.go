// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateSearchExternalGroupMappingsRequestBody struct {
	ExternalGroups []string `json:"externalGroups,omitempty"`
}

// NewCreateSearchExternalGroupMappingsRequestBody creates a new CreateSearchExternalGroupMappingsRequestBody object.
func NewCreateSearchExternalGroupMappingsRequestBody() *CreateSearchExternalGroupMappingsRequestBody {
	return &CreateSearchExternalGroupMappingsRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchExternalGroupMappingsRequestBody.
func (CreateSearchExternalGroupMappingsRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsRequestBody"
}
