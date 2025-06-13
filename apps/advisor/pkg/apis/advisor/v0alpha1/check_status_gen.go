// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CheckErrorLink struct {
	// URL to a page with more information about the error
	Url string `json:"url"`
	// Human readable error message
	Message string `json:"message"`
}

// NewCheckErrorLink creates a new CheckErrorLink object.
func NewCheckErrorLink() *CheckErrorLink {
	return &CheckErrorLink{}
}

// +k8s:openapi-gen=true
type CheckReportFailure struct {
	// Severity of the failure
	Severity CheckReportFailureSeverity `json:"severity"`
	// Step ID that the failure is associated with
	StepID string `json:"stepID"`
	// Human readable identifier of the item that failed
	Item string `json:"item"`
	// ID of the item that failed
	ItemID string `json:"itemID"`
	// Links to actions that can be taken to resolve the failure
	Links []CheckErrorLink `json:"links"`
}

// NewCheckReportFailure creates a new CheckReportFailure object.
func NewCheckReportFailure() *CheckReportFailure {
	return &CheckReportFailure{}
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
type CheckReportFailureSeverity string

const (
	CheckReportFailureSeverityHigh CheckReportFailureSeverity = "high"
	CheckReportFailureSeverityLow  CheckReportFailureSeverity = "low"
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
	// List of failures
	Failures []CheckReportFailure `json:"failures"`
}

// NewCheckV0alpha1StatusReport creates a new CheckV0alpha1StatusReport object.
func NewCheckV0alpha1StatusReport() *CheckV0alpha1StatusReport {
	return &CheckV0alpha1StatusReport{}
}
