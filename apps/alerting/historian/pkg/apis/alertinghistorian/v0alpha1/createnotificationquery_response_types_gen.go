// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type NotificationQueryResult struct {
	Entries []NotificationEntry `json:"entries"`
}

// NewNotificationQueryResult creates a new NotificationQueryResult object.
func NewNotificationQueryResult() *NotificationQueryResult {
	return &NotificationQueryResult{
		Entries: []NotificationEntry{},
	}
}

// +k8s:openapi-gen=true
type NotificationEntry struct {
	// RFC3339Nano
	Timestamp    int64                    `json:"timestamp"`
	Receiver     string                   `json:"receiver"`
	Status       NotificationStatus       `json:"status"`
	Outcome      NotificationOutcome      `json:"outcome"`
	GroupLabels  map[string]string        `json:"groupLabels"`
	Alerts       []NotificationEntryAlert `json:"alerts"`
	Retry        bool                     `json:"retry"`
	Error        *string                  `json:"error,omitempty"`
	Duration     int64                    `json:"duration"`
	PipelineTime int64                    `json:"pipelineTime"`
}

// NewNotificationEntry creates a new NotificationEntry object.
func NewNotificationEntry() *NotificationEntry {
	return &NotificationEntry{
		GroupLabels: map[string]string{},
		Alerts:      []NotificationEntryAlert{},
	}
}

// +k8s:openapi-gen=true
type NotificationStatus string

const (
	NotificationStatusFiring   NotificationStatus = "firing"
	NotificationStatusResolved NotificationStatus = "resolved"
)

// +k8s:openapi-gen=true
type NotificationOutcome string

const (
	NotificationOutcomeSuccess NotificationOutcome = "success"
	NotificationOutcomeError   NotificationOutcome = "error"
)

// +k8s:openapi-gen=true
type NotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    int64             `json:"startsAt"`
	EndsAt      int64             `json:"endsAt"`
}

// NewNotificationEntryAlert creates a new NotificationEntryAlert object.
func NewNotificationEntryAlert() *NotificationEntryAlert {
	return &NotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// +k8s:openapi-gen=true
type CreateNotificationquery struct {
	Body NotificationQueryResult `json:"body"`
}

// NewCreateNotificationquery creates a new CreateNotificationquery object.
func NewCreateNotificationquery() *CreateNotificationquery {
	return &CreateNotificationquery{
		Body: *NewNotificationQueryResult(),
	}
}
