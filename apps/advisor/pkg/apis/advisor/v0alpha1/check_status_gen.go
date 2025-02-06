// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CheckReportError struct {
	// Severity of the error
	Severity CheckReportErrorSeverity `json:"severity"`
	// Human readable reason for the error
	Reason string `json:"reason"`
	// Action to take to resolve the error
	Action string `json:"action"`
	// Step ID that the error is associated with
	StepID string `json:"stepID"`
	// Item ID that the error is associated with
	ItemID string `json:"itemID"`
}

// NewCheckReportError creates a new CheckReportError object.
func NewCheckReportError() *CheckReportError {
	return &CheckReportError{}
}

// +k8s:openapi-gen=true
type CheckstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State CheckStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewCheckstatusOperatorState creates a new CheckstatusOperatorState object.
func NewCheckstatusOperatorState() *CheckstatusOperatorState {
	return &CheckstatusOperatorState{}
}

// +k8s:openapi-gen=true
type CheckStatus struct {
	Report CheckV0alpha1StatusReport `json:"report"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]CheckstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewCheckStatus creates a new CheckStatus object.
func NewCheckStatus() *CheckStatus {
	return &CheckStatus{
		Report: *NewCheckV0alpha1StatusReport(),
	}
}

// +k8s:openapi-gen=true
type CheckReportErrorSeverity string

const (
	CheckReportErrorSeverityHigh CheckReportErrorSeverity = "high"
	CheckReportErrorSeverityLow  CheckReportErrorSeverity = "low"
)

// +k8s:openapi-gen=true
type CheckStatusOperatorStateState string

const (
	CheckStatusOperatorStateStateSuccess    CheckStatusOperatorStateState = "success"
	CheckStatusOperatorStateStateInProgress CheckStatusOperatorStateState = "in_progress"
	CheckStatusOperatorStateStateFailed     CheckStatusOperatorStateState = "failed"
)

// +k8s:openapi-gen=true
type CheckV0alpha1StatusReport struct {
	// Number of elements analyzed
	Count int64 `json:"count"`
	// List of errors
	Errors []CheckReportError `json:"errors"`
}

// NewCheckV0alpha1StatusReport creates a new CheckV0alpha1StatusReport object.
func NewCheckV0alpha1StatusReport() *CheckV0alpha1StatusReport {
	return &CheckV0alpha1StatusReport{}
}
