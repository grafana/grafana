// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RepositoryHealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`
	// When the health was checked last time
	Checked *int64 `json:"checked,omitempty"`
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	Message []string `json:"message,omitempty"`
}

// NewRepositoryHealthStatus creates a new RepositoryHealthStatus object.
func NewRepositoryHealthStatus() *RepositoryHealthStatus {
	return &RepositoryHealthStatus{}
}

// +k8s:openapi-gen=true
type RepositorySyncStatus struct {
	// pending, running, success, error
	State RepositorySyncStatusState `json:"state"`
	// The ID for the job that ran this sync
	Job *string `json:"job,omitempty"`
	// When the sync job started
	Started *int64 `json:"started,omitempty"`
	// When the sync job finished
	Finished *int64 `json:"finished,omitempty"`
	// When the next sync check is scheduled
	Scheduled *int64 `json:"scheduled,omitempty"`
	// Summary messages (will be shown to users)
	Message []string `json:"message"`
	// The repository ref when the last successful sync ran
	LastRef *string `json:"lastRef,omitempty"`
	// Incremental synchronization for versioned repositories
	Incremental *bool `json:"incremental,omitempty"`
}

// NewRepositorySyncStatus creates a new RepositorySyncStatus object.
func NewRepositorySyncStatus() *RepositorySyncStatus {
	return &RepositorySyncStatus{
		Message: []string{},
	}
}

// +k8s:openapi-gen=true
type RepositoryResourceCount struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

// NewRepositoryResourceCount creates a new RepositoryResourceCount object.
func NewRepositoryResourceCount() *RepositoryResourceCount {
	return &RepositoryResourceCount{}
}

// +k8s:openapi-gen=true
type RepositorystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RepositoryStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRepositorystatusOperatorState creates a new RepositorystatusOperatorState object.
func NewRepositorystatusOperatorState() *RepositorystatusOperatorState {
	return &RepositorystatusOperatorState{}
}

// +k8s:openapi-gen=true
type RepositoryWebhookStatus struct {
	Id               *int64   `json:"id,omitempty"`
	Url              *string  `json:"url,omitempty"`
	Secret           *string  `json:"secret,omitempty"`
	EncryptedSecret  []string `json:"encryptedSecret,omitempty"`
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
	LastEvent        *int64   `json:"lastEvent,omitempty"`
}

// NewRepositoryWebhookStatus creates a new RepositoryWebhookStatus object.
func NewRepositoryWebhookStatus() *RepositoryWebhookStatus {
	return &RepositoryWebhookStatus{}
}

// +k8s:openapi-gen=true
type RepositoryStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// This will get updated with the current health status (and updated periodically)
	Health RepositoryHealthStatus `json:"health"`
	// Sync information with the last sync information
	Sync RepositorySyncStatus `json:"sync"`
	// The object count when sync last ran
	Stats []RepositoryResourceCount `json:"stats,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RepositorystatusOperatorState `json:"operatorStates,omitempty"`
	// Webhook Information (if applicable)
	Webhook *RepositoryWebhookStatus `json:"webhook,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRepositoryStatus creates a new RepositoryStatus object.
func NewRepositoryStatus() *RepositoryStatus {
	return &RepositoryStatus{
		Health: *NewRepositoryHealthStatus(),
		Sync:   *NewRepositorySyncStatus(),
	}
}

// +k8s:openapi-gen=true
type RepositorySyncStatusState string

const (
	RepositorySyncStatusStatePending RepositorySyncStatusState = "pending"
	RepositorySyncStatusStateRunning RepositorySyncStatusState = "running"
	RepositorySyncStatusStateSuccess RepositorySyncStatusState = "success"
	RepositorySyncStatusStateError   RepositorySyncStatusState = "error"
)

// +k8s:openapi-gen=true
type RepositoryStatusOperatorStateState string

const (
	RepositoryStatusOperatorStateStateSuccess    RepositoryStatusOperatorStateState = "success"
	RepositoryStatusOperatorStateStateInProgress RepositoryStatusOperatorStateState = "in_progress"
	RepositoryStatusOperatorStateStateFailed     RepositoryStatusOperatorStateState = "failed"
)
