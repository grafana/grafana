// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// +k8s:openapi-gen=true
type IntegrationTypeSchemaIntegrationSchemaVersion struct {
	TypeAlias  *string                      `json:"typeAlias,omitempty"`
	Version    string                       `json:"version"`
	CanCreate  bool                         `json:"canCreate"`
	Options    []IntegrationTypeSchemaField `json:"options"`
	Info       *string                      `json:"info,omitempty"`
	Deprecated *bool                        `json:"deprecated,omitempty"`
}

// NewIntegrationTypeSchemaIntegrationSchemaVersion creates a new IntegrationTypeSchemaIntegrationSchemaVersion object.
func NewIntegrationTypeSchemaIntegrationSchemaVersion() *IntegrationTypeSchemaIntegrationSchemaVersion {
	return &IntegrationTypeSchemaIntegrationSchemaVersion{
		Options: []IntegrationTypeSchemaField{},
	}
}

// +k8s:openapi-gen=true
type IntegrationTypeSchemaField struct {
	Element        string                              `json:"element"`
	InputType      string                              `json:"inputType"`
	Label          string                              `json:"label"`
	Description    string                              `json:"description"`
	Placeholder    string                              `json:"placeholder"`
	PropertyName   string                              `json:"propertyName"`
	SelectOptions  []IntegrationTypeSchemaSelectOption `json:"selectOptions,omitempty"`
	ShowWhen       IntegrationTypeSchemaShowWhen       `json:"showWhen"`
	Required       bool                                `json:"required"`
	Protected      *bool                               `json:"protected,omitempty"`
	ValidationRule string                              `json:"validationRule"`
	Secure         bool                                `json:"secure"`
	DependsOn      string                              `json:"dependsOn"`
	SubformOptions []IntegrationTypeSchemaField        `json:"subformOptions,omitempty"`
}

// NewIntegrationTypeSchemaField creates a new IntegrationTypeSchemaField object.
func NewIntegrationTypeSchemaField() *IntegrationTypeSchemaField {
	return &IntegrationTypeSchemaField{
		ShowWhen: *NewIntegrationTypeSchemaShowWhen(),
	}
}

// +k8s:openapi-gen=true
type IntegrationTypeSchemaSelectOption struct {
	Label       string                               `json:"label"`
	Value       IntegrationTypeSchemaStringOrFloat64 `json:"value"`
	Description string                               `json:"description"`
}

// NewIntegrationTypeSchemaSelectOption creates a new IntegrationTypeSchemaSelectOption object.
func NewIntegrationTypeSchemaSelectOption() *IntegrationTypeSchemaSelectOption {
	return &IntegrationTypeSchemaSelectOption{
		Value: *NewIntegrationTypeSchemaStringOrFloat64(),
	}
}

// +k8s:openapi-gen=true
type IntegrationTypeSchemaShowWhen struct {
	Field string `json:"field"`
	Is    string `json:"is"`
}

// NewIntegrationTypeSchemaShowWhen creates a new IntegrationTypeSchemaShowWhen object.
func NewIntegrationTypeSchemaShowWhen() *IntegrationTypeSchemaShowWhen {
	return &IntegrationTypeSchemaShowWhen{}
}

// +k8s:openapi-gen=true
type IntegrationTypeSchemaSpec struct {
	Type           string                                          `json:"type"`
	CurrentVersion string                                          `json:"currentVersion"`
	Name           string                                          `json:"name"`
	Heading        *string                                         `json:"heading,omitempty"`
	Description    *string                                         `json:"description,omitempty"`
	Info           *string                                         `json:"info,omitempty"`
	Versions       []IntegrationTypeSchemaIntegrationSchemaVersion `json:"versions"`
	Deprecated     *bool                                           `json:"deprecated,omitempty"`
}

// NewIntegrationTypeSchemaSpec creates a new IntegrationTypeSchemaSpec object.
func NewIntegrationTypeSchemaSpec() *IntegrationTypeSchemaSpec {
	return &IntegrationTypeSchemaSpec{
		Versions: []IntegrationTypeSchemaIntegrationSchemaVersion{},
	}
}

// +k8s:openapi-gen=true
type IntegrationTypeSchemaStringOrFloat64 struct {
	String  *string  `json:"String,omitempty"`
	Float64 *float64 `json:"Float64,omitempty"`
}

// NewIntegrationTypeSchemaStringOrFloat64 creates a new IntegrationTypeSchemaStringOrFloat64 object.
func NewIntegrationTypeSchemaStringOrFloat64() *IntegrationTypeSchemaStringOrFloat64 {
	return &IntegrationTypeSchemaStringOrFloat64{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `IntegrationTypeSchemaStringOrFloat64` as JSON.
func (resource IntegrationTypeSchemaStringOrFloat64) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Float64 != nil {
		return json.Marshal(resource.Float64)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `IntegrationTypeSchemaStringOrFloat64` from JSON.
func (resource *IntegrationTypeSchemaStringOrFloat64) UnmarshalJSON(raw []byte) error {
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
