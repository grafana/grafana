// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// IntegrationTypeSchemaResource - K8s-style wrapper for integration type schemas
// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasIntegrationTypeSchemaResource struct {
	Metadata GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata `json:"metadata"`
	Spec     GetIntegrationTypeSchemasIntegrationTypeSchema                         `json:"spec"`
}

// NewGetIntegrationTypeSchemasIntegrationTypeSchemaResource creates a new GetIntegrationTypeSchemasIntegrationTypeSchemaResource object.
func NewGetIntegrationTypeSchemasIntegrationTypeSchemaResource() *GetIntegrationTypeSchemasIntegrationTypeSchemaResource {
	return &GetIntegrationTypeSchemasIntegrationTypeSchemaResource{
		Metadata: *NewGetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata(),
		Spec:     *NewGetIntegrationTypeSchemasIntegrationTypeSchema(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasIntegrationTypeSchemaResource.
func (GetIntegrationTypeSchemasIntegrationTypeSchemaResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasIntegrationTypeSchemaResource"
}

// IntegrationTypeSchema - receiver integration schema format
// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasIntegrationTypeSchema struct {
	Type           string                                                  `json:"type"`
	CurrentVersion string                                                  `json:"currentVersion"`
	Name           string                                                  `json:"name"`
	Heading        *string                                                 `json:"heading,omitempty"`
	Description    *string                                                 `json:"description,omitempty"`
	Info           *string                                                 `json:"info,omitempty"`
	Versions       []GetIntegrationTypeSchemasIntegrationTypeSchemaVersion `json:"versions"`
	Deprecated     *bool                                                   `json:"deprecated,omitempty"`
}

// NewGetIntegrationTypeSchemasIntegrationTypeSchema creates a new GetIntegrationTypeSchemasIntegrationTypeSchema object.
func NewGetIntegrationTypeSchemasIntegrationTypeSchema() *GetIntegrationTypeSchemasIntegrationTypeSchema {
	return &GetIntegrationTypeSchemasIntegrationTypeSchema{
		Versions: []GetIntegrationTypeSchemasIntegrationTypeSchemaVersion{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasIntegrationTypeSchema.
func (GetIntegrationTypeSchemasIntegrationTypeSchema) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasIntegrationTypeSchema"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasIntegrationTypeSchemaVersion struct {
	TypeAlias  *string                          `json:"typeAlias,omitempty"`
	Version    string                           `json:"version"`
	CanCreate  bool                             `json:"canCreate"`
	Options    []GetIntegrationTypeSchemasField `json:"options"`
	Info       *string                          `json:"info,omitempty"`
	Deprecated *bool                            `json:"deprecated,omitempty"`
}

// NewGetIntegrationTypeSchemasIntegrationTypeSchemaVersion creates a new GetIntegrationTypeSchemasIntegrationTypeSchemaVersion object.
func NewGetIntegrationTypeSchemasIntegrationTypeSchemaVersion() *GetIntegrationTypeSchemasIntegrationTypeSchemaVersion {
	return &GetIntegrationTypeSchemasIntegrationTypeSchemaVersion{
		Options: []GetIntegrationTypeSchemasField{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasIntegrationTypeSchemaVersion.
func (GetIntegrationTypeSchemasIntegrationTypeSchemaVersion) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasIntegrationTypeSchemaVersion"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasField struct {
	Element        string                                  `json:"element"`
	InputType      string                                  `json:"inputType"`
	Label          string                                  `json:"label"`
	Description    string                                  `json:"description"`
	Placeholder    string                                  `json:"placeholder"`
	PropertyName   string                                  `json:"propertyName"`
	SelectOptions  []GetIntegrationTypeSchemasSelectOption `json:"selectOptions,omitempty"`
	ShowWhen       GetIntegrationTypeSchemasShowWhen       `json:"showWhen"`
	Required       bool                                    `json:"required"`
	Protected      *bool                                   `json:"protected,omitempty"`
	ValidationRule string                                  `json:"validationRule"`
	Secure         bool                                    `json:"secure"`
	DependsOn      string                                  `json:"dependsOn"`
	SubformOptions []GetIntegrationTypeSchemasField        `json:"subformOptions,omitempty"`
}

// NewGetIntegrationTypeSchemasField creates a new GetIntegrationTypeSchemasField object.
func NewGetIntegrationTypeSchemasField() *GetIntegrationTypeSchemasField {
	return &GetIntegrationTypeSchemasField{
		ShowWhen: *NewGetIntegrationTypeSchemasShowWhen(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasField.
func (GetIntegrationTypeSchemasField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasField"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasSelectOption struct {
	Label       string                                   `json:"label"`
	Value       GetIntegrationTypeSchemasStringOrFloat64 `json:"value"`
	Description string                                   `json:"description"`
}

// NewGetIntegrationTypeSchemasSelectOption creates a new GetIntegrationTypeSchemasSelectOption object.
func NewGetIntegrationTypeSchemasSelectOption() *GetIntegrationTypeSchemasSelectOption {
	return &GetIntegrationTypeSchemasSelectOption{
		Value: *NewGetIntegrationTypeSchemasStringOrFloat64(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasSelectOption.
func (GetIntegrationTypeSchemasSelectOption) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasSelectOption"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasShowWhen struct {
	Field string `json:"field"`
	Is    string `json:"is"`
}

// NewGetIntegrationTypeSchemasShowWhen creates a new GetIntegrationTypeSchemasShowWhen object.
func NewGetIntegrationTypeSchemasShowWhen() *GetIntegrationTypeSchemasShowWhen {
	return &GetIntegrationTypeSchemasShowWhen{}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasShowWhen.
func (GetIntegrationTypeSchemasShowWhen) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasShowWhen"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasResponse struct {
	Items []GetIntegrationTypeSchemasIntegrationTypeSchemaResource `json:"items"`
}

// NewGetIntegrationTypeSchemasResponse creates a new GetIntegrationTypeSchemasResponse object.
func NewGetIntegrationTypeSchemasResponse() *GetIntegrationTypeSchemasResponse {
	return &GetIntegrationTypeSchemasResponse{
		Items: []GetIntegrationTypeSchemasIntegrationTypeSchemaResource{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasResponse.
func (GetIntegrationTypeSchemasResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasResponse"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// NewGetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata creates a new GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata object.
func NewGetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata() *GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata {
	return &GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata{}
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata.
func (GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasV0alpha1IntegrationTypeSchemaResourceMetadata"
}

// +k8s:openapi-gen=true
type GetIntegrationTypeSchemasStringOrFloat64 struct {
	String  *string  `json:"String,omitempty"`
	Float64 *float64 `json:"Float64,omitempty"`
}

// NewGetIntegrationTypeSchemasStringOrFloat64 creates a new GetIntegrationTypeSchemasStringOrFloat64 object.
func NewGetIntegrationTypeSchemasStringOrFloat64() *GetIntegrationTypeSchemasStringOrFloat64 {
	return &GetIntegrationTypeSchemasStringOrFloat64{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `GetIntegrationTypeSchemasStringOrFloat64` as JSON.
func (resource GetIntegrationTypeSchemasStringOrFloat64) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Float64 != nil {
		return json.Marshal(resource.Float64)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `GetIntegrationTypeSchemasStringOrFloat64` from JSON.
func (resource *GetIntegrationTypeSchemasStringOrFloat64) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	var errList []error

	// String
	var String string
	if err := json.Unmarshal(raw, &String); err != nil {
		errList = append(errList, err)
		resource.String = nil
	} else {
		resource.String = &String
		return nil
	}

	// Float64
	var Float64 float64
	if err := json.Unmarshal(raw, &Float64); err != nil {
		errList = append(errList, err)
		resource.Float64 = nil
	} else {
		resource.Float64 = &Float64
		return nil
	}

	return errors.Join(errList...)
}

// OpenAPIModelName returns the OpenAPI model name for GetIntegrationTypeSchemasStringOrFloat64.
func (GetIntegrationTypeSchemasStringOrFloat64) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationTypeSchemasStringOrFloat64"
}
