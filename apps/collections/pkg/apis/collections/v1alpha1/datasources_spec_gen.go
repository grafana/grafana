// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type DatasourcesTemplateSpec map[string]DatasourcesDataSourceTemplateSpec

// +k8s:openapi-gen=true
type DatasourcesDataSourceTemplateSpec struct {
	// type
	Group string `json:"group"`
	// variable name / display name
	Name string `json:"name"`
}

// NewDatasourcesDataSourceTemplateSpec creates a new DatasourcesDataSourceTemplateSpec object.
func NewDatasourcesDataSourceTemplateSpec() *DatasourcesDataSourceTemplateSpec {
	return &DatasourcesDataSourceTemplateSpec{}
}

// +k8s:openapi-gen=true
type DatasourcesMode struct {
	Name       string              `json:"name"`
	Uid        string              `json:"uid"`
	Definition DatasourcesModeSpec `json:"definition"`
}

// NewDatasourcesMode creates a new DatasourcesMode object.
func NewDatasourcesMode() *DatasourcesMode {
	return &DatasourcesMode{}
}

// +k8s:openapi-gen=true
type DatasourcesModeSpec map[string]DatasourcesDataSourceRef

// +k8s:openapi-gen=true
type DatasourcesDataSourceRef struct {
	// grafana data source uid
	Name string `json:"name"`
}

// NewDatasourcesDataSourceRef creates a new DatasourcesDataSourceRef object.
func NewDatasourcesDataSourceRef() *DatasourcesDataSourceRef {
	return &DatasourcesDataSourceRef{}
}

// +k8s:openapi-gen=true
type DatasourcesSpec struct {
	Template DatasourcesTemplateSpec `json:"template"`
	Modes    []DatasourcesMode       `json:"modes"`
}

// NewDatasourcesSpec creates a new DatasourcesSpec object.
func NewDatasourcesSpec() *DatasourcesSpec {
	return &DatasourcesSpec{
		Modes: []DatasourcesMode{},
	}
}
