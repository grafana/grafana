// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DatasourceCheckstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State DatasourceCheckStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewDatasourceCheckstatusOperatorState creates a new DatasourceCheckstatusOperatorState object.
func NewDatasourceCheckstatusOperatorState() *DatasourceCheckstatusOperatorState {
	return &DatasourceCheckstatusOperatorState{}
}

// +k8s:openapi-gen=true
type DatasourceCheckStatus struct {
	Report DatasourceCheckV0alpha1StatusReport `json:"report"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]DatasourceCheckstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewDatasourceCheckStatus creates a new DatasourceCheckStatus object.
func NewDatasourceCheckStatus() *DatasourceCheckStatus {
	return &DatasourceCheckStatus{
		Report: *NewDatasourceCheckV0alpha1StatusReport(),
	}
}

// +k8s:openapi-gen=true
type DatasourceCheckStatusOperatorStateState string

const (
	DatasourceCheckStatusOperatorStateStateSuccess    DatasourceCheckStatusOperatorStateState = "success"
	DatasourceCheckStatusOperatorStateStateInProgress DatasourceCheckStatusOperatorStateState = "in_progress"
	DatasourceCheckStatusOperatorStateStateFailed     DatasourceCheckStatusOperatorStateState = "failed"
)

// +k8s:openapi-gen=true
type DatasourceCheckStatusType string

const (
	DatasourceCheckStatusTypeInvestigation DatasourceCheckStatusType = "investigation"
	DatasourceCheckStatusTypeAction        DatasourceCheckStatusType = "action"
)

// +k8s:openapi-gen=true
type DatasourceCheckV0alpha1StatusReportErrors struct {
	// Investigation or Action recommended
	Type DatasourceCheckStatusType `json:"type"`
	// Reason for the error
	Reason string `json:"reason"`
	// Action to take
	Action string `json:"action"`
}

// NewDatasourceCheckV0alpha1StatusReportErrors creates a new DatasourceCheckV0alpha1StatusReportErrors object.
func NewDatasourceCheckV0alpha1StatusReportErrors() *DatasourceCheckV0alpha1StatusReportErrors {
	return &DatasourceCheckV0alpha1StatusReportErrors{}
}

// +k8s:openapi-gen=true
type DatasourceCheckV0alpha1StatusReport struct {
	// Number of elements analyzed
	Count int64 `json:"count"`
	// List of errors
	Errors []DatasourceCheckV0alpha1StatusReportErrors `json:"errors"`
}

// NewDatasourceCheckV0alpha1StatusReport creates a new DatasourceCheckV0alpha1StatusReport object.
func NewDatasourceCheckV0alpha1StatusReport() *DatasourceCheckV0alpha1StatusReport {
	return &DatasourceCheckV0alpha1StatusReport{}
}
