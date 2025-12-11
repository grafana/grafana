// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type NotificationEntry struct {
	// Timestamp is the time at which the notification attempt completed.
	Timestamp time.Time `json:"timestamp"`
	// Receiver is the receiver (contact point) title.
	Receiver string `json:"receiver"`
	// Status indicates if the notification contains one or more firing alerts.
	Status NotificationStatus `json:"status"`
	// Outcome indicaes if the notificaion attempt was successful or if it failed.
	Outcome NotificationOutcome `json:"outcome"`
	// GroupLabels are the labels uniquely identifying the alert group within a route.
	GroupLabels map[string]string `json:"groupLabels"`
	// Alerts are the alerts grouped into the notification.
	Alerts []NotificationEntryAlert `json:"alerts"`
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
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
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
	Entries []NotificationEntry `json:"entries"`
}

// NewCreateNotificationquery creates a new CreateNotificationquery object.
func NewCreateNotificationquery() *CreateNotificationquery {
	return &CreateNotificationquery{
		Entries: []NotificationEntry{},
	}
}
