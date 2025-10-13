package definitions

// AlertingFileExport is the full provisioned file export.
// swagger:model
type AlertingFileExport struct {
	APIVersion    int64                      `json:"apiVersion" yaml:"apiVersion"`
	Groups        []AlertRuleGroupExport     `json:"groups,omitempty" yaml:"groups,omitempty"`
	ContactPoints []ContactPointExport       `json:"contactPoints,omitempty" yaml:"contactPoints,omitempty"`
	Policies      []NotificationPolicyExport `json:"policies,omitempty" yaml:"policies,omitempty"`
	MuteTimings   []MuteTimeIntervalExport   `json:"muteTimes,omitempty" yaml:"muteTimes,omitempty"`
}

// swagger:parameters RouteGetAlertRuleGroupExport RouteGetAlertRuleExport RouteGetContactpointsExport RouteGetContactpointExport RoutePostRulesGroupForExport RouteExportMuteTimings RouteExportMuteTiming
type ExportQueryParams struct {
	// Whether to initiate a download of the file or not.
	// in: query
	// required: false
	// default: false
	Download bool `json:"download"`

	// Format of the downloaded file. Supported yaml, json or hcl. Accept header can also be used, but the query parameter will take precedence.
	// in: query
	// required: false
	// default: yaml
	// enum: yaml,json,hcl
	Format string `json:"format"`
}

// swagger:parameters RouteGetContactpointsExport RouteGetContactpointExport
type DecryptQueryParams struct {
	// Whether any contained secure settings should be decrypted or left redacted. Redacted settings will contain RedactedValue instead. Currently, only org admin can view decrypted secure settings.
	// in: query
	// required: false
	// default: false
	Decrypt bool `json:"decrypt"`
}
