// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateSearchExternalGroupMappingsBody struct {
	Teams     []string `json:"teams"`
	TotalHits int64    `json:"totalHits"`
}

// NewCreateSearchExternalGroupMappingsBody creates a new CreateSearchExternalGroupMappingsBody object.
func NewCreateSearchExternalGroupMappingsBody() *CreateSearchExternalGroupMappingsBody {
	return &CreateSearchExternalGroupMappingsBody{
		Teams: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchExternalGroupMappingsBody.
func (CreateSearchExternalGroupMappingsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsBody"
}
