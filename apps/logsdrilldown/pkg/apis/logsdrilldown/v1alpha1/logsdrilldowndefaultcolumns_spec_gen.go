// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsDatasource []LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords []LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels []LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsSpec struct {
	Datasource LogsDrilldownDefaultColumnsLogsDefaultColumnsDatasource `json:"datasource"`
}

// NewLogsDrilldownDefaultColumnsSpec creates a new LogsDrilldownDefaultColumnsSpec object.
func NewLogsDrilldownDefaultColumnsSpec() *LogsDrilldownDefaultColumnsSpec {
	return &LogsDrilldownDefaultColumnsSpec{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource struct {
	DsUID   string                                               `json:"dsUID"`
	Records LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords `json:"records"`
}

// NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource creates a new LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource object.
func NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource() *LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource {
	return &LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsDatasource{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords struct {
	Columns []string                                            `json:"columns"`
	Labels  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels `json:"labels"`
}

// NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords creates a new LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords object.
func NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords() *LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords {
	return &LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsRecords{
		Columns: []string{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels creates a new LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels object.
func NewLogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels() *LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels {
	return &LogsDrilldownDefaultColumnsV1alpha1LogsDefaultColumnsLabels{}
}
