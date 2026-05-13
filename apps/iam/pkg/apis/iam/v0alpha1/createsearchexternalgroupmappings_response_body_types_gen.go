// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CreateSearchExternalGroupMappingsExternalGroupMappingHit struct {
	TeamRef         string `json:"teamRef"`
	ExternalGroupId string `json:"externalGroupId"`
}

// NewCreateSearchExternalGroupMappingsExternalGroupMappingHit creates a new CreateSearchExternalGroupMappingsExternalGroupMappingHit object.
func NewCreateSearchExternalGroupMappingsExternalGroupMappingHit() *CreateSearchExternalGroupMappingsExternalGroupMappingHit {
	return &CreateSearchExternalGroupMappingsExternalGroupMappingHit{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchExternalGroupMappingsExternalGroupMappingHit.
func (CreateSearchExternalGroupMappingsExternalGroupMappingHit) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsExternalGroupMappingHit"
}

// +k8s:openapi-gen=true
type CreateSearchExternalGroupMappingsBody struct {
	Items []CreateSearchExternalGroupMappingsExternalGroupMappingHit `json:"items"`
}

// NewCreateSearchExternalGroupMappingsBody creates a new CreateSearchExternalGroupMappingsBody object.
func NewCreateSearchExternalGroupMappingsBody() *CreateSearchExternalGroupMappingsBody {
	return &CreateSearchExternalGroupMappingsBody{
		Items: []CreateSearchExternalGroupMappingsExternalGroupMappingHit{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateSearchExternalGroupMappingsBody.
func (CreateSearchExternalGroupMappingsBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.CreateSearchExternalGroupMappingsBody"
}
