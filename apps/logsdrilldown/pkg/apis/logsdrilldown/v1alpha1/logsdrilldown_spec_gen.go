// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownLogsDefaultColumns struct {
	Datasource []LogsDrilldownV1alpha1LogsDefaultColumnsDatasource `json:"datasource"`
}

// NewLogsDrilldownLogsDefaultColumns creates a new LogsDrilldownLogsDefaultColumns object.
func NewLogsDrilldownLogsDefaultColumns() *LogsDrilldownLogsDefaultColumns {
	return &LogsDrilldownLogsDefaultColumns{
		Datasource: []LogsDrilldownV1alpha1LogsDefaultColumnsDatasource{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownSpec struct {
	DefaultFields      []string                        `json:"defaultFields"`
	PrettifyJSON       bool                            `json:"prettifyJSON"`
	WrapLogMessage     bool                            `json:"wrapLogMessage"`
	InterceptDismissed bool                            `json:"interceptDismissed"`
	DefaultColumns     LogsDrilldownLogsDefaultColumns `json:"defaultColumns"`
}

// NewLogsDrilldownSpec creates a new LogsDrilldownSpec object.
func NewLogsDrilldownSpec() *LogsDrilldownSpec {
	return &LogsDrilldownSpec{
		DefaultFields:  []string{},
		DefaultColumns: *NewLogsDrilldownLogsDefaultColumns(),
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels creates a new LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels object.
func NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels() *LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels {
	return &LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels{}
}

// +k8s:openapi-gen=true
type LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords struct {
	Columns []string                                                         `json:"columns"`
	Labels  []LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels `json:"labels"`
}

// NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords creates a new LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords object.
func NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords() *LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords {
	return &LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords{
		Columns: []string{},
		Labels:  []LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecordsLabels{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownV1alpha1LogsDefaultColumnsDatasource struct {
	DsUID   string                                                     `json:"dsUID"`
	Records []LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords `json:"records"`
}

// NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasource creates a new LogsDrilldownV1alpha1LogsDefaultColumnsDatasource object.
func NewLogsDrilldownV1alpha1LogsDefaultColumnsDatasource() *LogsDrilldownV1alpha1LogsDefaultColumnsDatasource {
	return &LogsDrilldownV1alpha1LogsDefaultColumnsDatasource{
		Records: []LogsDrilldownV1alpha1LogsDefaultColumnsDatasourceRecords{},
	}
}
