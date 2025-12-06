// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDefaultColumnsRecords []LogsDefaultColumnsRecord

// +k8s:openapi-gen=true
type LogsDefaultColumnsRecord struct {
	Columns []string                 `json:"columns"`
	Labels  LogsDefaultColumnsLabels `json:"labels"`
}

// NewLogsDefaultColumnsRecord creates a new LogsDefaultColumnsRecord object.
func NewLogsDefaultColumnsRecord() *LogsDefaultColumnsRecord {
	return &LogsDefaultColumnsRecord{
		Columns: []string{},
	}
}

// +k8s:openapi-gen=true
type LogsDefaultColumnsLabels []LogsDefaultColumnsLabel

// +k8s:openapi-gen=true
type LogsDefaultColumnsLabel struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// NewLogsDefaultColumnsLabel creates a new LogsDefaultColumnsLabel object.
func NewLogsDefaultColumnsLabel() *LogsDefaultColumnsLabel {
	return &LogsDefaultColumnsLabel{}
}

// +k8s:openapi-gen=true
type Spec struct {
	Records LogsDefaultColumnsRecords `json:"records"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{}
}
