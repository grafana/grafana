// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecords []LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord struct {
	Labels []string `json:"labels"`
}

// NewLogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord creates a new LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord object.
func NewLogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord() *LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord {
	return &LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord{
		Labels: []string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord.
func (LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecord"
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsSpec struct {
	Records LogsDrilldownDefaultLabelsLogsLogsDefaultLabelsRecords `json:"records"`
}

// NewLogsDrilldownDefaultLabelsSpec creates a new LogsDrilldownDefaultLabelsSpec object.
func NewLogsDrilldownDefaultLabelsSpec() *LogsDrilldownDefaultLabelsSpec {
	return &LogsDrilldownDefaultLabelsSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultLabelsSpec.
func (LogsDrilldownDefaultLabelsSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultLabelsSpec"
}
