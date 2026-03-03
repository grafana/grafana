// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v2beta1

import (
	json "encoding/json"
	errors "errors"
)

// +k8s:openapi-gen=true
type DashboardGridLayoutKind struct {
	Kind string                  `json:"kind"`
	Spec DashboardGridLayoutSpec `json:"spec"`
}

// NewDashboardGridLayoutKind creates a new DashboardGridLayoutKind object.
func NewDashboardGridLayoutKind() *DashboardGridLayoutKind {
	return &DashboardGridLayoutKind{
		Kind: "GridLayout",
		Spec: *NewDashboardGridLayoutSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardGridLayoutKind.
func (DashboardGridLayoutKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardGridLayoutKind"
}

// +k8s:openapi-gen=true
type DashboardGridLayoutSpec struct {
	Items []DashboardGridLayoutItemKind `json:"items"`
}

// NewDashboardGridLayoutSpec creates a new DashboardGridLayoutSpec object.
func NewDashboardGridLayoutSpec() *DashboardGridLayoutSpec {
	return &DashboardGridLayoutSpec{
		Items: []DashboardGridLayoutItemKind{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardGridLayoutSpec.
func (DashboardGridLayoutSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardGridLayoutSpec"
}

// +k8s:openapi-gen=true
type DashboardGridLayoutItemKind struct {
	Kind string                      `json:"kind"`
	Spec DashboardGridLayoutItemSpec `json:"spec"`
}

// NewDashboardGridLayoutItemKind creates a new DashboardGridLayoutItemKind object.
func NewDashboardGridLayoutItemKind() *DashboardGridLayoutItemKind {
	return &DashboardGridLayoutItemKind{
		Kind: "GridLayoutItem",
		Spec: *NewDashboardGridLayoutItemSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardGridLayoutItemKind.
func (DashboardGridLayoutItemKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardGridLayoutItemKind"
}

// +k8s:openapi-gen=true
type DashboardGridLayoutItemSpec struct {
	X      int64 `json:"x"`
	Y      int64 `json:"y"`
	Width  int64 `json:"width"`
	Height int64 `json:"height"`
	// reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
	Element DashboardElementReference `json:"element"`
	Repeat  *DashboardRepeatOptions   `json:"repeat,omitempty"`
}

// NewDashboardGridLayoutItemSpec creates a new DashboardGridLayoutItemSpec object.
func NewDashboardGridLayoutItemSpec() *DashboardGridLayoutItemSpec {
	return &DashboardGridLayoutItemSpec{
		Element: *NewDashboardElementReference(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardGridLayoutItemSpec.
func (DashboardGridLayoutItemSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardGridLayoutItemSpec"
}

// +k8s:openapi-gen=true
type DashboardElementReference struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// NewDashboardElementReference creates a new DashboardElementReference object.
func NewDashboardElementReference() *DashboardElementReference {
	return &DashboardElementReference{
		Kind: "ElementReference",
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardElementReference.
func (DashboardElementReference) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardElementReference"
}

// +k8s:openapi-gen=true
type DashboardRepeatOptions struct {
	Mode      string                           `json:"mode"`
	Value     string                           `json:"value"`
	Direction *DashboardRepeatOptionsDirection `json:"direction,omitempty"`
	MaxPerRow *int64                           `json:"maxPerRow,omitempty"`
}

// NewDashboardRepeatOptions creates a new DashboardRepeatOptions object.
func NewDashboardRepeatOptions() *DashboardRepeatOptions {
	return &DashboardRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardRepeatOptions.
func (DashboardRepeatOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardRepeatOptions"
}

// other repeat modes will be added in the future: label, frame
// +k8s:openapi-gen=true
const DashboardRepeatMode = "variable"

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutKind struct {
	Kind string                      `json:"kind"`
	Spec DashboardAutoGridLayoutSpec `json:"spec"`
}

// NewDashboardAutoGridLayoutKind creates a new DashboardAutoGridLayoutKind object.
func NewDashboardAutoGridLayoutKind() *DashboardAutoGridLayoutKind {
	return &DashboardAutoGridLayoutKind{
		Kind: "AutoGridLayout",
		Spec: *NewDashboardAutoGridLayoutSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutKind.
func (DashboardAutoGridLayoutKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutKind"
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpec struct {
	MaxColumnCount  *float64                                   `json:"maxColumnCount,omitempty"`
	ColumnWidthMode DashboardAutoGridLayoutSpecColumnWidthMode `json:"columnWidthMode"`
	ColumnWidth     *float64                                   `json:"columnWidth,omitempty"`
	RowHeightMode   DashboardAutoGridLayoutSpecRowHeightMode   `json:"rowHeightMode"`
	RowHeight       *float64                                   `json:"rowHeight,omitempty"`
	FillScreen      *bool                                      `json:"fillScreen,omitempty"`
	Items           []DashboardAutoGridLayoutItemKind          `json:"items"`
}

// NewDashboardAutoGridLayoutSpec creates a new DashboardAutoGridLayoutSpec object.
func NewDashboardAutoGridLayoutSpec() *DashboardAutoGridLayoutSpec {
	return &DashboardAutoGridLayoutSpec{
		MaxColumnCount:  (func(input float64) *float64 { return &input })(3),
		ColumnWidthMode: DashboardAutoGridLayoutSpecColumnWidthModeStandard,
		RowHeightMode:   DashboardAutoGridLayoutSpecRowHeightModeStandard,
		FillScreen:      (func(input bool) *bool { return &input })(false),
		Items:           []DashboardAutoGridLayoutItemKind{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutSpec.
func (DashboardAutoGridLayoutSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutSpec"
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutItemKind struct {
	Kind string                          `json:"kind"`
	Spec DashboardAutoGridLayoutItemSpec `json:"spec"`
}

// NewDashboardAutoGridLayoutItemKind creates a new DashboardAutoGridLayoutItemKind object.
func NewDashboardAutoGridLayoutItemKind() *DashboardAutoGridLayoutItemKind {
	return &DashboardAutoGridLayoutItemKind{
		Kind: "AutoGridLayoutItem",
		Spec: *NewDashboardAutoGridLayoutItemSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutItemKind.
func (DashboardAutoGridLayoutItemKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutItemKind"
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutItemSpec struct {
	Element              DashboardElementReference               `json:"element"`
	Repeat               *DashboardAutoGridRepeatOptions         `json:"repeat,omitempty"`
	ConditionalRendering *DashboardConditionalRenderingGroupKind `json:"conditionalRendering,omitempty"`
}

// NewDashboardAutoGridLayoutItemSpec creates a new DashboardAutoGridLayoutItemSpec object.
func NewDashboardAutoGridLayoutItemSpec() *DashboardAutoGridLayoutItemSpec {
	return &DashboardAutoGridLayoutItemSpec{
		Element: *NewDashboardElementReference(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutItemSpec.
func (DashboardAutoGridLayoutItemSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutItemSpec"
}

// +k8s:openapi-gen=true
type DashboardAutoGridRepeatOptions struct {
	Mode  string `json:"mode"`
	Value string `json:"value"`
}

// NewDashboardAutoGridRepeatOptions creates a new DashboardAutoGridRepeatOptions object.
func NewDashboardAutoGridRepeatOptions() *DashboardAutoGridRepeatOptions {
	return &DashboardAutoGridRepeatOptions{
		Mode: DashboardRepeatMode,
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridRepeatOptions.
func (DashboardAutoGridRepeatOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridRepeatOptions"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupKind struct {
	Kind string                                 `json:"kind"`
	Spec DashboardConditionalRenderingGroupSpec `json:"spec"`
}

// NewDashboardConditionalRenderingGroupKind creates a new DashboardConditionalRenderingGroupKind object.
func NewDashboardConditionalRenderingGroupKind() *DashboardConditionalRenderingGroupKind {
	return &DashboardConditionalRenderingGroupKind{
		Kind: "ConditionalRenderingGroup",
		Spec: *NewDashboardConditionalRenderingGroupSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingGroupKind.
func (DashboardConditionalRenderingGroupKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingGroupKind"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpec struct {
	Visibility DashboardConditionalRenderingGroupSpecVisibility                                                                 `json:"visibility"`
	Condition  DashboardConditionalRenderingGroupSpecCondition                                                                  `json:"condition"`
	Items      []DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind `json:"items"`
}

// NewDashboardConditionalRenderingGroupSpec creates a new DashboardConditionalRenderingGroupSpec object.
func NewDashboardConditionalRenderingGroupSpec() *DashboardConditionalRenderingGroupSpec {
	return &DashboardConditionalRenderingGroupSpec{
		Items: []DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingGroupSpec.
func (DashboardConditionalRenderingGroupSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingGroupSpec"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableKind struct {
	Kind string                                    `json:"kind"`
	Spec DashboardConditionalRenderingVariableSpec `json:"spec"`
}

// NewDashboardConditionalRenderingVariableKind creates a new DashboardConditionalRenderingVariableKind object.
func NewDashboardConditionalRenderingVariableKind() *DashboardConditionalRenderingVariableKind {
	return &DashboardConditionalRenderingVariableKind{
		Kind: "ConditionalRenderingVariable",
		Spec: *NewDashboardConditionalRenderingVariableSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingVariableKind.
func (DashboardConditionalRenderingVariableKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingVariableKind"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableSpec struct {
	Variable string                                            `json:"variable"`
	Operator DashboardConditionalRenderingVariableSpecOperator `json:"operator"`
	Value    string                                            `json:"value"`
}

// NewDashboardConditionalRenderingVariableSpec creates a new DashboardConditionalRenderingVariableSpec object.
func NewDashboardConditionalRenderingVariableSpec() *DashboardConditionalRenderingVariableSpec {
	return &DashboardConditionalRenderingVariableSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingVariableSpec.
func (DashboardConditionalRenderingVariableSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingVariableSpec"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingDataKind struct {
	Kind string                                `json:"kind"`
	Spec DashboardConditionalRenderingDataSpec `json:"spec"`
}

// NewDashboardConditionalRenderingDataKind creates a new DashboardConditionalRenderingDataKind object.
func NewDashboardConditionalRenderingDataKind() *DashboardConditionalRenderingDataKind {
	return &DashboardConditionalRenderingDataKind{
		Kind: "ConditionalRenderingData",
		Spec: *NewDashboardConditionalRenderingDataSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingDataKind.
func (DashboardConditionalRenderingDataKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingDataKind"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingDataSpec struct {
	Value bool `json:"value"`
}

// NewDashboardConditionalRenderingDataSpec creates a new DashboardConditionalRenderingDataSpec object.
func NewDashboardConditionalRenderingDataSpec() *DashboardConditionalRenderingDataSpec {
	return &DashboardConditionalRenderingDataSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingDataSpec.
func (DashboardConditionalRenderingDataSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingDataSpec"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingTimeRangeSizeKind struct {
	Kind string                                         `json:"kind"`
	Spec DashboardConditionalRenderingTimeRangeSizeSpec `json:"spec"`
}

// NewDashboardConditionalRenderingTimeRangeSizeKind creates a new DashboardConditionalRenderingTimeRangeSizeKind object.
func NewDashboardConditionalRenderingTimeRangeSizeKind() *DashboardConditionalRenderingTimeRangeSizeKind {
	return &DashboardConditionalRenderingTimeRangeSizeKind{
		Kind: "ConditionalRenderingTimeRangeSize",
		Spec: *NewDashboardConditionalRenderingTimeRangeSizeSpec(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingTimeRangeSizeKind.
func (DashboardConditionalRenderingTimeRangeSizeKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingTimeRangeSizeKind"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingTimeRangeSizeSpec struct {
	Value string `json:"value"`
}

// NewDashboardConditionalRenderingTimeRangeSizeSpec creates a new DashboardConditionalRenderingTimeRangeSizeSpec object.
func NewDashboardConditionalRenderingTimeRangeSizeSpec() *DashboardConditionalRenderingTimeRangeSizeSpec {
	return &DashboardConditionalRenderingTimeRangeSizeSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingTimeRangeSizeSpec.
func (DashboardConditionalRenderingTimeRangeSizeSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingTimeRangeSizeSpec"
}

// +k8s:openapi-gen=true
type DashboardPreferences struct {
	// Default layout that would be used when adding new elements
	DefaultLayout *DashboardGridLayoutKindOrAutoGridLayoutKind `json:"defaultLayout,omitempty"`
}

// NewDashboardPreferences creates a new DashboardPreferences object.
func NewDashboardPreferences() *DashboardPreferences {
	return &DashboardPreferences{}
}

// OpenAPIModelName returns the OpenAPI model name for DashboardPreferences.
func (DashboardPreferences) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardPreferences"
}

// +k8s:openapi-gen=true
type DashboardRepeatOptionsDirection string

const (
	DashboardRepeatOptionsDirectionH DashboardRepeatOptionsDirection = "h"
	DashboardRepeatOptionsDirectionV DashboardRepeatOptionsDirection = "v"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardRepeatOptionsDirection.
func (DashboardRepeatOptionsDirection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardRepeatOptionsDirection"
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpecColumnWidthMode string

const (
	DashboardAutoGridLayoutSpecColumnWidthModeNarrow   DashboardAutoGridLayoutSpecColumnWidthMode = "narrow"
	DashboardAutoGridLayoutSpecColumnWidthModeStandard DashboardAutoGridLayoutSpecColumnWidthMode = "standard"
	DashboardAutoGridLayoutSpecColumnWidthModeWide     DashboardAutoGridLayoutSpecColumnWidthMode = "wide"
	DashboardAutoGridLayoutSpecColumnWidthModeCustom   DashboardAutoGridLayoutSpecColumnWidthMode = "custom"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutSpecColumnWidthMode.
func (DashboardAutoGridLayoutSpecColumnWidthMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutSpecColumnWidthMode"
}

// +k8s:openapi-gen=true
type DashboardAutoGridLayoutSpecRowHeightMode string

const (
	DashboardAutoGridLayoutSpecRowHeightModeShort    DashboardAutoGridLayoutSpecRowHeightMode = "short"
	DashboardAutoGridLayoutSpecRowHeightModeStandard DashboardAutoGridLayoutSpecRowHeightMode = "standard"
	DashboardAutoGridLayoutSpecRowHeightModeTall     DashboardAutoGridLayoutSpecRowHeightMode = "tall"
	DashboardAutoGridLayoutSpecRowHeightModeCustom   DashboardAutoGridLayoutSpecRowHeightMode = "custom"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardAutoGridLayoutSpecRowHeightMode.
func (DashboardAutoGridLayoutSpecRowHeightMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardAutoGridLayoutSpecRowHeightMode"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpecVisibility string

const (
	DashboardConditionalRenderingGroupSpecVisibilityShow DashboardConditionalRenderingGroupSpecVisibility = "show"
	DashboardConditionalRenderingGroupSpecVisibilityHide DashboardConditionalRenderingGroupSpecVisibility = "hide"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingGroupSpecVisibility.
func (DashboardConditionalRenderingGroupSpecVisibility) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingGroupSpecVisibility"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingGroupSpecCondition string

const (
	DashboardConditionalRenderingGroupSpecConditionAnd DashboardConditionalRenderingGroupSpecCondition = "and"
	DashboardConditionalRenderingGroupSpecConditionOr  DashboardConditionalRenderingGroupSpecCondition = "or"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingGroupSpecCondition.
func (DashboardConditionalRenderingGroupSpecCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingGroupSpecCondition"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableSpecOperator string

const (
	DashboardConditionalRenderingVariableSpecOperatorEquals     DashboardConditionalRenderingVariableSpecOperator = "equals"
	DashboardConditionalRenderingVariableSpecOperatorNotEquals  DashboardConditionalRenderingVariableSpecOperator = "notEquals"
	DashboardConditionalRenderingVariableSpecOperatorMatches    DashboardConditionalRenderingVariableSpecOperator = "matches"
	DashboardConditionalRenderingVariableSpecOperatorNotMatches DashboardConditionalRenderingVariableSpecOperator = "notMatches"
)

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingVariableSpecOperator.
func (DashboardConditionalRenderingVariableSpecOperator) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingVariableSpecOperator"
}

// +k8s:openapi-gen=true
type DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind struct {
	ConditionalRenderingVariableKind      *DashboardConditionalRenderingVariableKind      `json:"ConditionalRenderingVariableKind,omitempty"`
	ConditionalRenderingDataKind          *DashboardConditionalRenderingDataKind          `json:"ConditionalRenderingDataKind,omitempty"`
	ConditionalRenderingTimeRangeSizeKind *DashboardConditionalRenderingTimeRangeSizeKind `json:"ConditionalRenderingTimeRangeSizeKind,omitempty"`
}

// NewDashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind creates a new DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind object.
func NewDashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind() *DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind {
	return &DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind` as JSON.
func (resource DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) MarshalJSON() ([]byte, error) {
	if resource.ConditionalRenderingVariableKind != nil {
		return json.Marshal(resource.ConditionalRenderingVariableKind)
	}
	if resource.ConditionalRenderingDataKind != nil {
		return json.Marshal(resource.ConditionalRenderingDataKind)
	}
	if resource.ConditionalRenderingTimeRangeSizeKind != nil {
		return json.Marshal(resource.ConditionalRenderingTimeRangeSizeKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind` from JSON.
func (resource *DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "ConditionalRenderingData":
		var dashboardConditionalRenderingDataKind DashboardConditionalRenderingDataKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingDataKind); err != nil {
			return err
		}

		resource.ConditionalRenderingDataKind = &dashboardConditionalRenderingDataKind
		return nil
	case "ConditionalRenderingTimeRangeSize":
		var dashboardConditionalRenderingTimeRangeSizeKind DashboardConditionalRenderingTimeRangeSizeKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingTimeRangeSizeKind); err != nil {
			return err
		}

		resource.ConditionalRenderingTimeRangeSizeKind = &dashboardConditionalRenderingTimeRangeSizeKind
		return nil
	case "ConditionalRenderingVariable":
		var dashboardConditionalRenderingVariableKind DashboardConditionalRenderingVariableKind
		if err := json.Unmarshal(raw, &dashboardConditionalRenderingVariableKind); err != nil {
			return err
		}

		resource.ConditionalRenderingVariableKind = &dashboardConditionalRenderingVariableKind
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind.
func (DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind"
}

// +k8s:openapi-gen=true
type DashboardGridLayoutKindOrAutoGridLayoutKind struct {
	GridLayoutKind     *DashboardGridLayoutKind     `json:"GridLayoutKind,omitempty"`
	AutoGridLayoutKind *DashboardAutoGridLayoutKind `json:"AutoGridLayoutKind,omitempty"`
}

// NewDashboardGridLayoutKindOrAutoGridLayoutKind creates a new DashboardGridLayoutKindOrAutoGridLayoutKind object.
func NewDashboardGridLayoutKindOrAutoGridLayoutKind() *DashboardGridLayoutKindOrAutoGridLayoutKind {
	return &DashboardGridLayoutKindOrAutoGridLayoutKind{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `DashboardGridLayoutKindOrAutoGridLayoutKind` as JSON.
func (resource DashboardGridLayoutKindOrAutoGridLayoutKind) MarshalJSON() ([]byte, error) {
	if resource.GridLayoutKind != nil {
		return json.Marshal(resource.GridLayoutKind)
	}
	if resource.AutoGridLayoutKind != nil {
		return json.Marshal(resource.AutoGridLayoutKind)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `DashboardGridLayoutKindOrAutoGridLayoutKind` from JSON.
func (resource *DashboardGridLayoutKindOrAutoGridLayoutKind) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return nil
	}

	switch discriminator {
	case "AutoGridLayout":
		var dashboardAutoGridLayoutKind DashboardAutoGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardAutoGridLayoutKind); err != nil {
			return err
		}

		resource.AutoGridLayoutKind = &dashboardAutoGridLayoutKind
		return nil
	case "GridLayout":
		var dashboardGridLayoutKind DashboardGridLayoutKind
		if err := json.Unmarshal(raw, &dashboardGridLayoutKind); err != nil {
			return err
		}

		resource.GridLayoutKind = &dashboardGridLayoutKind
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for DashboardGridLayoutKindOrAutoGridLayoutKind.
func (DashboardGridLayoutKindOrAutoGridLayoutKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v2beta1.DashboardGridLayoutKindOrAutoGridLayoutKind"
}
