// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationEntry struct {
	// Timestamp is the time at which the notification attempt completed.
	Timestamp time.Time `json:"timestamp"`
	// Uuid is a unique identifier for the notification attempt.
	Uuid string `json:"uuid"`
	// Receiver is the receiver (contact point) title.
	Receiver string `json:"receiver"`
	// Integration is the integration (contact point type) name.
	Integration string `json:"integration"`
	// IntegrationIndex is the index of the integration within the receiver.
	IntegrationIndex int64 `json:"integrationIndex"`
	// Status indicates if the notification contains one or more firing alerts.
	Status CreateNotificationqueryNotificationStatus `json:"status"`
	// Outcome indicaes if the notificaion attempt was successful or if it failed.
	Outcome CreateNotificationqueryNotificationOutcome `json:"outcome"`
	// GroupLabels are the labels uniquely identifying the alert group within a route.
	GroupLabels map[string]string `json:"groupLabels"`
	// RuleUIDs are the unique identifiers of the alert rules included in the notification.
	RuleUIDs []string `json:"ruleUIDs"`
	// AlertCount is the total number of alerts included in the notification.
	AlertCount int64 `json:"alertCount"`
	// Alerts are the alerts grouped into the notification. Deprecated: not populated, will be removed.
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
		RuleUIDs:    []string{},
		Alerts:      []CreateNotificationqueryNotificationEntryAlert{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryNotificationEntry.
func (CreateNotificationqueryNotificationEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationEntry"
}

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationStatus string

const (
	CreateNotificationqueryNotificationStatusFiring   CreateNotificationqueryNotificationStatus = "firing"
	CreateNotificationqueryNotificationStatusResolved CreateNotificationqueryNotificationStatus = "resolved"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryNotificationStatus.
func (CreateNotificationqueryNotificationStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationStatus"
}

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationOutcome string

const (
	CreateNotificationqueryNotificationOutcomeSuccess CreateNotificationqueryNotificationOutcome = "success"
	CreateNotificationqueryNotificationOutcomeError   CreateNotificationqueryNotificationOutcome = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryNotificationOutcome.
func (CreateNotificationqueryNotificationOutcome) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationOutcome"
}

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	Enrichments interface{}       `json:"enrichments,omitempty"`
}

// NewCreateNotificationqueryNotificationEntryAlert creates a new CreateNotificationqueryNotificationEntryAlert object.
func NewCreateNotificationqueryNotificationEntryAlert() *CreateNotificationqueryNotificationEntryAlert {
	return &CreateNotificationqueryNotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryNotificationEntryAlert.
func (CreateNotificationqueryNotificationEntryAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationEntryAlert"
}

// +k8s:openapi-gen=true
type CreateNotificationqueryNotificationCount struct {
	Receiver         *string                                     `json:"receiver,omitempty"`
	Integration      *string                                     `json:"integration,omitempty"`
	IntegrationIndex *int64                                      `json:"integrationIndex,omitempty"`
	Status           *CreateNotificationqueryNotificationStatus  `json:"status,omitempty"`
	Outcome          *CreateNotificationqueryNotificationOutcome `json:"outcome,omitempty"`
	Error            *string                                     `json:"error,omitempty"`
	// Count is the number of notification attempts in the time period.
	Count int64 `json:"count"`
}

// NewCreateNotificationqueryNotificationCount creates a new CreateNotificationqueryNotificationCount object.
func NewCreateNotificationqueryNotificationCount() *CreateNotificationqueryNotificationCount {
	return &CreateNotificationqueryNotificationCount{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryNotificationCount.
func (CreateNotificationqueryNotificationCount) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryNotificationCount"
}

// +k8s:openapi-gen=true
type CreateNotificationqueryResponse struct {
	Entries []CreateNotificationqueryNotificationEntry `json:"entries"`
	Counts  []CreateNotificationqueryNotificationCount `json:"counts"`
}

// NewCreateNotificationqueryResponse creates a new CreateNotificationqueryResponse object.
func NewCreateNotificationqueryResponse() *CreateNotificationqueryResponse {
	return &CreateNotificationqueryResponse{
		Entries: []CreateNotificationqueryNotificationEntry{},
		Counts:  []CreateNotificationqueryNotificationCount{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryResponse.
func (CreateNotificationqueryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryResponse"
}
