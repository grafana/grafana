// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDefaultColumns struct {
	Datasource []V1alpha1LogsDefaultColumnsDatasource `json:"datasource"`
}

// NewLogsDefaultColumns creates a new LogsDefaultColumns object.
func NewLogsDefaultColumns() *LogsDefaultColumns {
	return &LogsDefaultColumns{
		Datasource: []V1alpha1LogsDefaultColumnsDatasource{},
	}
}

// +k8s:openapi-gen=true
type Spec struct {
	DefaultFields      []string           `json:"defaultFields"`
	PrettifyJSON       bool               `json:"prettifyJSON"`
	WrapLogMessage     bool               `json:"wrapLogMessage"`
	InterceptDismissed bool               `json:"interceptDismissed"`
	DefaultColumns     LogsDefaultColumns `json:"defaultColumns"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		DefaultFields:  []string{},
		DefaultColumns: *NewLogsDefaultColumns(),
	}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsDatasourceRecordsLabels struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewV1alpha1LogsDefaultColumnsDatasourceRecordsLabels creates a new V1alpha1LogsDefaultColumnsDatasourceRecordsLabels object.
func NewV1alpha1LogsDefaultColumnsDatasourceRecordsLabels() *V1alpha1LogsDefaultColumnsDatasourceRecordsLabels {
	return &V1alpha1LogsDefaultColumnsDatasourceRecordsLabels{}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsDatasourceRecords struct {
	Columns []string                                            `json:"columns"`
	Labels  []V1alpha1LogsDefaultColumnsDatasourceRecordsLabels `json:"labels"`
}

// NewV1alpha1LogsDefaultColumnsDatasourceRecords creates a new V1alpha1LogsDefaultColumnsDatasourceRecords object.
func NewV1alpha1LogsDefaultColumnsDatasourceRecords() *V1alpha1LogsDefaultColumnsDatasourceRecords {
	return &V1alpha1LogsDefaultColumnsDatasourceRecords{
		Columns: []string{},
		Labels:  []V1alpha1LogsDefaultColumnsDatasourceRecordsLabels{},
	}
}

// +k8s:openapi-gen=true
type V1alpha1LogsDefaultColumnsDatasource struct {
	DsUID   string                                        `json:"dsUID"`
	Records []V1alpha1LogsDefaultColumnsDatasourceRecords `json:"records"`
}

// NewV1alpha1LogsDefaultColumnsDatasource creates a new V1alpha1LogsDefaultColumnsDatasource object.
func NewV1alpha1LogsDefaultColumnsDatasource() *V1alpha1LogsDefaultColumnsDatasource {
	return &V1alpha1LogsDefaultColumnsDatasource{
		Records: []V1alpha1LogsDefaultColumnsDatasourceRecords{},
	}
}
