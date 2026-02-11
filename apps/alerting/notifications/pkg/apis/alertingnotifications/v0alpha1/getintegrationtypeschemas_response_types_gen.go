// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// IntegrationTypeSchemaResource - K8s-style wrapper for integration type schemas
// +k8s:openapi-gen=true
type GetIntegrationtypeschemasIntegrationTypeSchemaResource struct {
	Metadata GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata `json:"metadata"`
	Spec     GetIntegrationtypeschemasIntegrationTypeSchema                         `json:"spec"`
}

// NewGetIntegrationtypeschemasIntegrationTypeSchemaResource creates a new GetIntegrationtypeschemasIntegrationTypeSchemaResource object.
func NewGetIntegrationtypeschemasIntegrationTypeSchemaResource() *GetIntegrationtypeschemasIntegrationTypeSchemaResource {
	return &GetIntegrationtypeschemasIntegrationTypeSchemaResource{
		Metadata: *NewGetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata(),
		Spec:     *NewGetIntegrationtypeschemasIntegrationTypeSchema(),
	}
}

// IntegrationTypeSchema - receiver integration schema format
// +k8s:openapi-gen=true
type GetIntegrationtypeschemasIntegrationTypeSchema struct {
	Type           string                                                  `json:"type"`
	CurrentVersion string                                                  `json:"currentVersion"`
	Name           string                                                  `json:"name"`
	Heading        *string                                                 `json:"heading,omitempty"`
	Description    *string                                                 `json:"description,omitempty"`
	Info           *string                                                 `json:"info,omitempty"`
	Versions       []GetIntegrationtypeschemasIntegrationTypeSchemaVersion `json:"versions"`
	Deprecated     *bool                                                   `json:"deprecated,omitempty"`
}

// NewGetIntegrationtypeschemasIntegrationTypeSchema creates a new GetIntegrationtypeschemasIntegrationTypeSchema object.
func NewGetIntegrationtypeschemasIntegrationTypeSchema() *GetIntegrationtypeschemasIntegrationTypeSchema {
	return &GetIntegrationtypeschemasIntegrationTypeSchema{
		Versions: []GetIntegrationtypeschemasIntegrationTypeSchemaVersion{},
	}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasIntegrationTypeSchemaVersion struct {
	TypeAlias  *string                          `json:"typeAlias,omitempty"`
	Version    string                           `json:"version"`
	CanCreate  bool                             `json:"canCreate"`
	Options    []GetIntegrationtypeschemasField `json:"options"`
	Info       *string                          `json:"info,omitempty"`
	Deprecated *bool                            `json:"deprecated,omitempty"`
}

// NewGetIntegrationtypeschemasIntegrationTypeSchemaVersion creates a new GetIntegrationtypeschemasIntegrationTypeSchemaVersion object.
func NewGetIntegrationtypeschemasIntegrationTypeSchemaVersion() *GetIntegrationtypeschemasIntegrationTypeSchemaVersion {
	return &GetIntegrationtypeschemasIntegrationTypeSchemaVersion{
		Options: []GetIntegrationtypeschemasField{},
	}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasField struct {
	Element        string                                  `json:"element"`
	InputType      string                                  `json:"inputType"`
	Label          string                                  `json:"label"`
	Description    string                                  `json:"description"`
	Placeholder    string                                  `json:"placeholder"`
	PropertyName   string                                  `json:"propertyName"`
	SelectOptions  []GetIntegrationtypeschemasSelectOption `json:"selectOptions,omitempty"`
	ShowWhen       GetIntegrationtypeschemasShowWhen       `json:"showWhen"`
	Required       bool                                    `json:"required"`
	Protected      *bool                                   `json:"protected,omitempty"`
	ValidationRule string                                  `json:"validationRule"`
	Secure         bool                                    `json:"secure"`
	DependsOn      string                                  `json:"dependsOn"`
	SubformOptions []GetIntegrationtypeschemasField        `json:"subformOptions,omitempty"`
}

// NewGetIntegrationtypeschemasField creates a new GetIntegrationtypeschemasField object.
func NewGetIntegrationtypeschemasField() *GetIntegrationtypeschemasField {
	return &GetIntegrationtypeschemasField{
		ShowWhen: *NewGetIntegrationtypeschemasShowWhen(),
	}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasSelectOption struct {
	Label       string                                   `json:"label"`
	Value       GetIntegrationtypeschemasStringOrFloat64 `json:"value"`
	Description string                                   `json:"description"`
}

// NewGetIntegrationtypeschemasSelectOption creates a new GetIntegrationtypeschemasSelectOption object.
func NewGetIntegrationtypeschemasSelectOption() *GetIntegrationtypeschemasSelectOption {
	return &GetIntegrationtypeschemasSelectOption{
		Value: *NewGetIntegrationtypeschemasStringOrFloat64(),
	}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasShowWhen struct {
	Field string `json:"field"`
	Is    string `json:"is"`
}

// NewGetIntegrationtypeschemasShowWhen creates a new GetIntegrationtypeschemasShowWhen object.
func NewGetIntegrationtypeschemasShowWhen() *GetIntegrationtypeschemasShowWhen {
	return &GetIntegrationtypeschemasShowWhen{}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasResponse struct {
	Items []GetIntegrationtypeschemasIntegrationTypeSchemaResource `json:"items"`
}

// NewGetIntegrationtypeschemasResponse creates a new GetIntegrationtypeschemasResponse object.
func NewGetIntegrationtypeschemasResponse() *GetIntegrationtypeschemasResponse {
	return &GetIntegrationtypeschemasResponse{
		Items: []GetIntegrationtypeschemasIntegrationTypeSchemaResource{},
	}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

// NewGetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata creates a new GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata object.
func NewGetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata() *GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata {
	return &GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata{}
}

// +k8s:openapi-gen=true
type GetIntegrationtypeschemasStringOrFloat64 struct {
	String  *string  `json:"String,omitempty"`
	Float64 *float64 `json:"Float64,omitempty"`
}

// NewGetIntegrationtypeschemasStringOrFloat64 creates a new GetIntegrationtypeschemasStringOrFloat64 object.
func NewGetIntegrationtypeschemasStringOrFloat64() *GetIntegrationtypeschemasStringOrFloat64 {
	return &GetIntegrationtypeschemasStringOrFloat64{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `GetIntegrationtypeschemasStringOrFloat64` as JSON.
func (resource GetIntegrationtypeschemasStringOrFloat64) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Float64 != nil {
		return json.Marshal(resource.Float64)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `GetIntegrationtypeschemasStringOrFloat64` from JSON.
func (resource *GetIntegrationtypeschemasStringOrFloat64) UnmarshalJSON(raw []byte) error {
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
func (GetIntegrationtypeschemasIntegrationTypeSchemaResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasIntegrationTypeSchemaResource"
}
func (GetIntegrationtypeschemasIntegrationTypeSchema) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasIntegrationTypeSchema"
}
func (GetIntegrationtypeschemasIntegrationTypeSchemaVersion) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasIntegrationTypeSchemaVersion"
}
func (GetIntegrationtypeschemasField) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasField"
}
func (GetIntegrationtypeschemasSelectOption) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasSelectOption"
}
func (GetIntegrationtypeschemasShowWhen) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasShowWhen"
}
func (GetIntegrationtypeschemasResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasResponse"
}
func (GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasV0alpha1IntegrationTypeSchemaResourceMetadata"
}
func (GetIntegrationtypeschemasStringOrFloat64) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.GetIntegrationtypeschemasStringOrFloat64"
}
