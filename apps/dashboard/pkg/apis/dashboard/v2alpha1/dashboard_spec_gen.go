// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2alpha1

import (
	json "encoding/json"
	errors "errors"
	fmt "fmt"
)

// +k8s:openapi-gen=true
type DashboardValueMapping = DashboardValueMapOrRangeMap

// NewDashboardValueMapping creates a new DashboardValueMapping object.
func NewDashboardValueMapping() *DashboardValueMapping {
	return NewDashboardValueMapOrRangeMap()
}

// Maps text values to a color or different display text and color.
// For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// +k8s:openapi-gen=true
type DashboardValueMap struct {
	Type DashboardMappingType `json:"type"`
	// Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } }
	Options map[string]DashboardValueMappingResult `json:"options"`
}

// NewDashboardValueMap creates a new DashboardValueMap object.
func NewDashboardValueMap() *DashboardValueMap {
	return &DashboardValueMap{
		Type: DashboardMappingTypeValue,
	}
}

// Supported value mapping types
// `value`: Maps text values to a color or different display text and color. For example, you can configure a value mapping so that all instances of the value 10 appear as Perfection! rather than the number.
// `range`: Maps numerical ranges to a display text and color. For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// `regex`: Maps regular expressions to replacement text and a color. For example, if a value is www.example.com, you can configure a regex value mapping so that Grafana displays www and truncates the domain.
// `special`: Maps special values like Null, NaN (not a number), and boolean values like true and false to a display text and color. See SpecialValueMatch to see the list of special values. For example, you can configure a special value mapping so that null values appear as N/A.
// +k8s:openapi-gen=true
type DashboardMappingType string

const (
	DashboardMappingTypeValue   DashboardMappingType = "value"
	DashboardMappingTypeRange   DashboardMappingType = "range"
	DashboardMappingTypeRegex   DashboardMappingType = "regex"
	DashboardMappingTypeSpecial DashboardMappingType = "special"
)

// Result used as replacement with text and color when the value matches
// +k8s:openapi-gen=true
type DashboardValueMappingResult struct {
	// Text to display when the value matches
	Text *string `json:"text,omitempty"`
	// Text to use when the value matches
	Color *string `json:"color,omitempty"`
	// Icon to display when the value matches. Only specific visualizations.
	Icon *string `json:"icon,omitempty"`
	// Position in the mapping array. Only used internally.
	Index *int32 `json:"index,omitempty"`
}

// NewDashboardValueMappingResult creates a new DashboardValueMappingResult object.
func NewDashboardValueMappingResult() *DashboardValueMappingResult {
	return &DashboardValueMappingResult{}
}

// Maps numerical ranges to a display text and color.
// For example, if a value is within a certain range, you can configure a range value mapping to display Low or High rather than the number.
// +k8s:openapi-gen=true
type DashboardRangeMap struct {
	Type DashboardMappingType `json:"type"`
	// Range to match against and the result to apply when the value is within the range
	Options DashboardV2alpha1RangeMapOptions `json:"options"`
}

// NewDashboardRangeMap creates a new DashboardRangeMap object.
func NewDashboardRangeMap() *DashboardRangeMap {
	return &DashboardRangeMap{
		Type:    DashboardMappingTypeRange,
		Options: *NewDashboardV2alpha1RangeMapOptions(),
	}
}

// +k8s:openapi-gen=true
type DashboardSpec struct {
	Mappings []DashboardValueMapping `json:"mappings,omitempty"`
}

// NewDashboardSpec creates a new DashboardSpec object.
func NewDashboardSpec() *DashboardSpec {
	return &DashboardSpec{}
}

// +k8s:openapi-gen=true
type DashboardV2alpha1RangeMapOptions struct {
	// Min value of the range. It can be null which means -Infinity
	From *float64 `json:"from"`
	// Max value of the range. It can be null which means +Infinity
	To *float64 `json:"to"`
	// Config to apply when the value is within the range
	Result DashboardValueMappingResult `json:"result"`
}

// NewDashboardV2alpha1RangeMapOptions creates a new DashboardV2alpha1RangeMapOptions object.
func NewDashboardV2alpha1RangeMapOptions() *DashboardV2alpha1RangeMapOptions {
	return &DashboardV2alpha1RangeMapOptions{
		Result: *NewDashboardValueMappingResult(),
	}
}

// +k8s:openapi-gen=true
type DashboardValueMapOrRangeMap struct {
	ValueMap *DashboardValueMap `json:"ValueMap,omitempty"`
	RangeMap *DashboardRangeMap `json:"RangeMap,omitempty"`
}

// NewDashboardValueMapOrRangeMap creates a new DashboardValueMapOrRangeMap object.
func NewDashboardValueMapOrRangeMap() *DashboardValueMapOrRangeMap {
	return &DashboardValueMapOrRangeMap{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardValueMapOrRangeMap` as JSON.
func (resource DashboardValueMapOrRangeMap) MarshalJSON() ([]byte, error) {
	if resource.ValueMap != nil {
		return json.Marshal(resource.ValueMap)
	}
	if resource.RangeMap != nil {
		return json.Marshal(resource.RangeMap)
	}
	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardValueMapOrRangeMap` from JSON.
func (resource *DashboardValueMapOrRangeMap) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return errors.New("discriminator field 'type' not found in payload")
	}

	switch discriminator {
	case "range":
		var dashboardRangeMap DashboardRangeMap
		if err := json.Unmarshal(raw, &dashboardRangeMap); err != nil {
			return err
		}

		resource.RangeMap = &dashboardRangeMap
		return nil
	case "value":
		var dashboardValueMap DashboardValueMap
		if err := json.Unmarshal(raw, &dashboardValueMap); err != nil {
			return err
		}

		resource.ValueMap = &dashboardValueMap
		return nil
	}

	return fmt.Errorf("could not unmarshal resource with `type = %v`", discriminator)
}
