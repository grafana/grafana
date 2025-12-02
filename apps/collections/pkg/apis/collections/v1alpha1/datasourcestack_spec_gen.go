// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type DataSourceStackTemplateSpec map[string]DataSourceStackDataSourceStackTemplateItem

// +k8s:openapi-gen=true
type DataSourceStackDataSourceStackTemplateItem struct {
	// type
	Group string `json:"group"`
	// variable name / display name
	Name string `json:"name"`
}

// NewDataSourceStackDataSourceStackTemplateItem creates a new DataSourceStackDataSourceStackTemplateItem object.
func NewDataSourceStackDataSourceStackTemplateItem() *DataSourceStackDataSourceStackTemplateItem {
	return &DataSourceStackDataSourceStackTemplateItem{}
}

// +k8s:openapi-gen=true
type DataSourceStackModeSpec struct {
	Name       string              `json:"name"`
	Uid        string              `json:"uid"`
	Definition DataSourceStackMode `json:"definition"`
}

// NewDataSourceStackModeSpec creates a new DataSourceStackModeSpec object.
func NewDataSourceStackModeSpec() *DataSourceStackModeSpec {
	return &DataSourceStackModeSpec{}
}

// +k8s:openapi-gen=true
type DataSourceStackMode map[string]DataSourceStackModeItem

// +k8s:openapi-gen=true
type DataSourceStackModeItem struct {
	// grafana data source uid
	DataSourceRef string `json:"dataSourceRef"`
}

// NewDataSourceStackModeItem creates a new DataSourceStackModeItem object.
func NewDataSourceStackModeItem() *DataSourceStackModeItem {
	return &DataSourceStackModeItem{}
}

// +k8s:openapi-gen=true
type DataSourceStackSpec struct {
	Template DataSourceStackTemplateSpec `json:"template"`
	Modes    []DataSourceStackModeSpec   `json:"modes"`
}

// NewDataSourceStackSpec creates a new DataSourceStackSpec object.
func NewDataSourceStackSpec() *DataSourceStackSpec {
	return &DataSourceStackSpec{
		Modes: []DataSourceStackModeSpec{},
	}
}
