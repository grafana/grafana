// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDefaultColumnsDatasource []V1alpha1LogsDefaultColumnsDatasource

// +k8s:openapi-gen=true
type LogsDefaultColumnsRecords []V1alpha1LogsDefaultColumnsRecords

// +k8s:openapi-gen=true
type LogsDefaultColumnsLabels []V1alpha1LogsDefaultColumnsLabels

// +k8s:openapi-gen=true
type Spec struct {
	Datasource LogsDefaultColumnsDatasource `json:"datasource"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsDatasource struct {
	DsUID   string                    `json:"dsUID"`
	Records LogsDefaultColumnsRecords `json:"records"`
}

// NewV1alpha1LogsDefaultColumnsDatasource creates a new V1alpha1LogsDefaultColumnsDatasource object.
func NewV1alpha1LogsDefaultColumnsDatasource() *V1alpha1LogsDefaultColumnsDatasource {
	return &V1alpha1LogsDefaultColumnsDatasource{}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsRecords struct {
	Columns []string                 `json:"columns"`
	Labels  LogsDefaultColumnsLabels `json:"labels"`
}

// NewV1alpha1LogsDefaultColumnsRecords creates a new V1alpha1LogsDefaultColumnsRecords object.
func NewV1alpha1LogsDefaultColumnsRecords() *V1alpha1LogsDefaultColumnsRecords {
	return &V1alpha1LogsDefaultColumnsRecords{
		Columns: []string{},
	}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsLabels struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewV1alpha1LogsDefaultColumnsLabels creates a new V1alpha1LogsDefaultColumnsLabels object.
func NewV1alpha1LogsDefaultColumnsLabels() *V1alpha1LogsDefaultColumnsLabels {
	return &V1alpha1LogsDefaultColumnsLabels{}
}
