// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationEntry struct {
	// Timestamp is the time at which the notification attempt completed.
	Timestamp time.Time `json:"timestamp"`
	// Receiver is the receiver (contact point) title.
	Receiver string `json:"receiver"`
	// Status indicates if the notification contains one or more firing alerts.
	Status CreateNotificationqueryNotificationStatus `json:"status"`
	// Outcome indicaes if the notificaion attempt was successful or if it failed.
	Outcome CreateNotificationqueryNotificationOutcome `json:"outcome"`
	// GroupLabels are the labels uniquely identifying the alert group within a route.
	GroupLabels map[string]string `json:"groupLabels"`
	// Alerts are the alerts grouped into the notification.
	Alerts []CreateNotificationqueryNotificationEntryAlert `json:"alerts"`
	// Retry indicates if the attempt was a retried attempt.
	Retry bool `json:"retry"`
	// Error is the message returned by the contact point if delivery failed.
	Error *string `json:"error,omitempty"`
	// Duration is the length of time the notification attempt took in nanoseconds.
	Duration int64 `json:"duration"`
	// PipelineTime is the time at which the flush began.
	PipelineTime time.Time `json:"pipelineTime"`
	// GroupKey uniquely idenifies the dispatcher alert group.
	GroupKey string `json:"groupKey"`
}

// NewCreateNotificationqueryNotificationEntry creates a new CreateNotificationqueryNotificationEntry object.
func NewCreateNotificationqueryNotificationEntry() *CreateNotificationqueryNotificationEntry {
	return &CreateNotificationqueryNotificationEntry{
		GroupLabels: map[string]string{},
		Alerts:      []CreateNotificationqueryNotificationEntryAlert{},
	}
}

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationStatus string

const (
	CreateNotificationqueryNotificationStatusFiring   CreateNotificationqueryNotificationStatus = "firing"
	CreateNotificationqueryNotificationStatusResolved CreateNotificationqueryNotificationStatus = "resolved"
)

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationOutcome string

const (
	CreateNotificationqueryNotificationOutcomeSuccess CreateNotificationqueryNotificationOutcome = "success"
	CreateNotificationqueryNotificationOutcomeError   CreateNotificationqueryNotificationOutcome = "error"
)

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
}

// NewCreateNotificationqueryNotificationEntryAlert creates a new CreateNotificationqueryNotificationEntryAlert object.
func NewCreateNotificationqueryNotificationEntryAlert() *CreateNotificationqueryNotificationEntryAlert {
	return &CreateNotificationqueryNotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// +k8s:openapi-gen=true
type CreateNotificationqueryResponse struct {
	Entries []CreateNotificationqueryNotificationEntry `json:"entries"`
}

// NewCreateNotificationqueryResponse creates a new CreateNotificationqueryResponse object.
func NewCreateNotificationqueryResponse() *CreateNotificationqueryResponse {
	return &CreateNotificationqueryResponse{
		Entries: []CreateNotificationqueryNotificationEntry{},
	}
}
func (CreateNotificationqueryNotificationEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationEntry"
}
func (CreateNotificationqueryNotificationEntryAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationEntryAlert"
}
func (CreateNotificationqueryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryResponse"
}
