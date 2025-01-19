// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginCheckstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PluginCheckStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPluginCheckstatusOperatorState creates a new PluginCheckstatusOperatorState object.
func NewPluginCheckstatusOperatorState() *PluginCheckstatusOperatorState {
	return &PluginCheckstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PluginCheckStatus struct {
	Report PluginCheckV0alpha1StatusReport `json:"report"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PluginCheckstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPluginCheckStatus creates a new PluginCheckStatus object.
func NewPluginCheckStatus() *PluginCheckStatus {
	return &PluginCheckStatus{
		Report: *NewPluginCheckV0alpha1StatusReport(),
	}
}

// +k8s:openapi-gen=true
type PluginCheckStatusOperatorStateState string

const (
	PluginCheckStatusOperatorStateStateSuccess    PluginCheckStatusOperatorStateState = "success"
	PluginCheckStatusOperatorStateStateInProgress PluginCheckStatusOperatorStateState = "in_progress"
	PluginCheckStatusOperatorStateStateFailed     PluginCheckStatusOperatorStateState = "failed"
)

// +k8s:openapi-gen=true
type PluginCheckStatusType string

const (
	PluginCheckStatusTypeInvestigation PluginCheckStatusType = "investigation"
	PluginCheckStatusTypeAction        PluginCheckStatusType = "action"
)

// +k8s:openapi-gen=true
type PluginCheckV0alpha1StatusReportErrors struct {
	// Investigation or Action recommended
	Type PluginCheckStatusType `json:"type"`
	// Reason for the error
	Reason string `json:"reason"`
	// Action to take
	Action string `json:"action"`
}

// NewPluginCheckV0alpha1StatusReportErrors creates a new PluginCheckV0alpha1StatusReportErrors object.
func NewPluginCheckV0alpha1StatusReportErrors() *PluginCheckV0alpha1StatusReportErrors {
	return &PluginCheckV0alpha1StatusReportErrors{}
}

// +k8s:openapi-gen=true
type PluginCheckV0alpha1StatusReport struct {
	// Number of elements analyzed
	Count int64 `json:"count"`
	// List of errors
	Errors []PluginCheckV0alpha1StatusReportErrors `json:"errors"`
}

// NewPluginCheckV0alpha1StatusReport creates a new PluginCheckV0alpha1StatusReport object.
func NewPluginCheckV0alpha1StatusReport() *PluginCheckV0alpha1StatusReport {
	return &PluginCheckV0alpha1StatusReport{}
}
