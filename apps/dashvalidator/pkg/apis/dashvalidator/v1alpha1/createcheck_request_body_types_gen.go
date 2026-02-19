// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

type CreateCheckRequestBody struct {
	DashboardJson      map[string]any                                     `json:"dashboardJson"`
	DatasourceMappings []CreateCheckRequestV1alpha1BodyDatasourceMappings `json:"datasourceMappings"`
}

// NewCreateCheckRequestBody creates a new CreateCheckRequestBody object.
func NewCreateCheckRequestBody() *CreateCheckRequestBody {
	return &CreateCheckRequestBody{
		DashboardJson:      map[string]any{},
		DatasourceMappings: []CreateCheckRequestV1alpha1BodyDatasourceMappings{},
	}
}

type CreateCheckRequestV1alpha1BodyDatasourceMappings struct {
	Uid  string  `json:"uid"`
	Type string  `json:"type"`
	Name *string `json:"name,omitempty"`
}

// NewCreateCheckRequestV1alpha1BodyDatasourceMappings creates a new CreateCheckRequestV1alpha1BodyDatasourceMappings object.
func NewCreateCheckRequestV1alpha1BodyDatasourceMappings() *CreateCheckRequestV1alpha1BodyDatasourceMappings {
	return &CreateCheckRequestV1alpha1BodyDatasourceMappings{}
}
