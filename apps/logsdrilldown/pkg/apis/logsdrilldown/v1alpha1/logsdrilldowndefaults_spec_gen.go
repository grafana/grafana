// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsLogsDefaultColumns struct {
	Datasource []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource `json:"datasource"`
}

// NewLogsDrilldownDefaultsLogsDefaultColumns creates a new LogsDrilldownDefaultsLogsDefaultColumns object.
func NewLogsDrilldownDefaultsLogsDefaultColumns() *LogsDrilldownDefaultsLogsDefaultColumns {
	return &LogsDrilldownDefaultsLogsDefaultColumns{
		Datasource: []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsSpec struct {
	DefaultFields      []string                                `json:"defaultFields"`
	PrettifyJSON       bool                                    `json:"prettifyJSON"`
	WrapLogMessage     bool                                    `json:"wrapLogMessage"`
	InterceptDismissed bool                                    `json:"interceptDismissed"`
	DefaultColumns     LogsDrilldownDefaultsLogsDefaultColumns `json:"defaultColumns"`
}

// NewLogsDrilldownDefaultsSpec creates a new LogsDrilldownDefaultsSpec object.
func NewLogsDrilldownDefaultsSpec() *LogsDrilldownDefaultsSpec {
	return &LogsDrilldownDefaultsSpec{
		DefaultFields:  []string{},
		DefaultColumns: *NewLogsDrilldownDefaultsLogsDefaultColumns(),
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels creates a new LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels object.
func NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels() *LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels {
	return &LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords struct {
	Columns []string                                                                 `json:"columns"`
	Labels  []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels `json:"labels"`
}

// NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords creates a new LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords object.
func NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords() *LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords {
	return &LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords{
		Columns: []string{},
		Labels:  []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecordsLabels{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource struct {
	DsUID   string                                                             `json:"dsUID"`
	Records []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords `json:"records"`
}

// NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource creates a new LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource object.
func NewLogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource() *LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource {
	return &LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasource{
		Records: []LogsDrilldownDefaultsV1alpha1LogsDefaultColumnsDatasourceRecords{},
	}
}
