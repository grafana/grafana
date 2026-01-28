// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// IntegrationTypeSchema - receiver integration schema format
// +k8s:openapi-gen=true
type IntegrationTypeSchema struct {
	Type           string                     `json:"type"`
	CurrentVersion string                     `json:"currentVersion"`
	Name           string                     `json:"name"`
	Heading        *string                    `json:"heading,omitempty"`
	Description    *string                    `json:"description,omitempty"`
	Info           *string                    `json:"info,omitempty"`
	Versions       []IntegrationSchemaVersion `json:"versions"`
	Deprecated     *bool                      `json:"deprecated,omitempty"`
}

// NewIntegrationTypeSchema creates a new IntegrationTypeSchema object.
func NewIntegrationTypeSchema() *IntegrationTypeSchema {
	return &IntegrationTypeSchema{
		Versions: []IntegrationSchemaVersion{},
	}
}

// +k8s:openapi-gen=true
type IntegrationSchemaVersion struct {
	TypeAlias  *string `json:"typeAlias,omitempty"`
	Version    string  `json:"version"`
	CanCreate  bool    `json:"canCreate"`
	Options    []Field `json:"options"`
	Info       *string `json:"info,omitempty"`
	Deprecated *bool   `json:"deprecated,omitempty"`
}

// NewIntegrationSchemaVersion creates a new IntegrationSchemaVersion object.
func NewIntegrationSchemaVersion() *IntegrationSchemaVersion {
	return &IntegrationSchemaVersion{
		Options: []Field{},
	}
}

// +k8s:openapi-gen=true
type Field struct {
	Element        string         `json:"element"`
	InputType      string         `json:"inputType"`
	Label          string         `json:"label"`
	Description    string         `json:"description"`
	Placeholder    string         `json:"placeholder"`
	PropertyName   string         `json:"propertyName"`
	SelectOptions  []SelectOption `json:"selectOptions,omitempty"`
	ShowWhen       ShowWhen       `json:"showWhen"`
	Required       bool           `json:"required"`
	Protected      *bool          `json:"protected,omitempty"`
	ValidationRule string         `json:"validationRule"`
	Secure         bool           `json:"secure"`
	DependsOn      string         `json:"dependsOn"`
	SubformOptions []Field        `json:"subformOptions,omitempty"`
}

// NewField creates a new Field object.
func NewField() *Field {
	return &Field{
		ShowWhen: *NewShowWhen(),
	}
}

// +k8s:openapi-gen=true
type SelectOption struct {
	Label       string          `json:"label"`
	Value       StringOrFloat64 `json:"value"`
	Description string          `json:"description"`
}

// NewSelectOption creates a new SelectOption object.
func NewSelectOption() *SelectOption {
	return &SelectOption{
		Value: *NewStringOrFloat64(),
	}
}

// +k8s:openapi-gen=true
type ShowWhen struct {
	Field string `json:"field"`
	Is    string `json:"is"`
}

// NewShowWhen creates a new ShowWhen object.
func NewShowWhen() *ShowWhen {
	return &ShowWhen{}
}

// +k8s:openapi-gen=true
type GetReceiversschema struct {
	Schemas []IntegrationTypeSchema `json:"schemas"`
}

// NewGetReceiversschema creates a new GetReceiversschema object.
func NewGetReceiversschema() *GetReceiversschema {
	return &GetReceiversschema{
		Schemas: []IntegrationTypeSchema{},
	}
}

// +k8s:openapi-gen=true
type StringOrFloat64 struct {
	String  *string  `json:"String,omitempty"`
	Float64 *float64 `json:"Float64,omitempty"`
}

// NewStringOrFloat64 creates a new StringOrFloat64 object.
func NewStringOrFloat64() *StringOrFloat64 {
	return &StringOrFloat64{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `StringOrFloat64` as JSON.
func (resource StringOrFloat64) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Float64 != nil {
		return json.Marshal(resource.Float64)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `StringOrFloat64` from JSON.
func (resource *StringOrFloat64) UnmarshalJSON(raw []byte) error {
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
