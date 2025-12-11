// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords []LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord struct {
	Columns []string                                            `json:"columns"`
	Labels  LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels `json:"labels"`
}

// NewLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord creates a new LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord object.
func NewLogsDrilldownDefaultColumnsLogsDefaultColumnsRecord() *LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord {
	return &LogsDrilldownDefaultColumnsLogsDefaultColumnsRecord{
		Columns: []string{},
	}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsLabels []LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel creates a new LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel object.
func NewLogsDrilldownDefaultColumnsLogsDefaultColumnsLabel() *LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel {
	return &LogsDrilldownDefaultColumnsLogsDefaultColumnsLabel{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsSpec struct {
	Records LogsDrilldownDefaultColumnsLogsDefaultColumnsRecords `json:"records"`
}

// NewLogsDrilldownDefaultColumnsSpec creates a new LogsDrilldownDefaultColumnsSpec object.
func NewLogsDrilldownDefaultColumnsSpec() *LogsDrilldownDefaultColumnsSpec {
	return &LogsDrilldownDefaultColumnsSpec{}
}
