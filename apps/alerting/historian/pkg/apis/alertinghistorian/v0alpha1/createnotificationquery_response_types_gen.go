// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationEntry struct {
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
	Status CreateNotificationQueryNotificationStatus `json:"status"`
	// Outcome indicaes if the notificaion attempt was successful or if it failed.
	Outcome CreateNotificationQueryNotificationOutcome `json:"outcome"`
	// GroupLabels are the labels uniquely identifying the alert group within a route.
	GroupLabels map[string]string `json:"groupLabels"`
	// RuleUIDs are the unique identifiers of the alert rules included in the notification.
	RuleUIDs []string `json:"ruleUIDs"`
	// AlertCount is the total number of alerts included in the notification.
	AlertCount int64 `json:"alertCount"`
	// Alerts are the alerts grouped into the notification. Deprecated: not populated, will be removed.
	Alerts []CreateNotificationQueryNotificationEntryAlert `json:"alerts"`
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

// NewCreateNotificationQueryNotificationEntry creates a new CreateNotificationQueryNotificationEntry object.
func NewCreateNotificationQueryNotificationEntry() *CreateNotificationQueryNotificationEntry {
	return &CreateNotificationQueryNotificationEntry{
		GroupLabels: map[string]string{},
		RuleUIDs:    []string{},
		Alerts:      []CreateNotificationQueryNotificationEntryAlert{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationEntry.
func (CreateNotificationQueryNotificationEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationEntry"
}

// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationStatus string

const (
	CreateNotificationQueryNotificationStatusFiring   CreateNotificationQueryNotificationStatus = "firing"
	CreateNotificationQueryNotificationStatusResolved CreateNotificationQueryNotificationStatus = "resolved"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationStatus.
func (CreateNotificationQueryNotificationStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationStatus"
}

// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationOutcome string

const (
	CreateNotificationQueryNotificationOutcomeSuccess CreateNotificationQueryNotificationOutcome = "success"
	CreateNotificationQueryNotificationOutcomeError   CreateNotificationQueryNotificationOutcome = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationOutcome.
func (CreateNotificationQueryNotificationOutcome) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationOutcome"
}

// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	Enrichments interface{}       `json:"enrichments,omitempty"`
}

// NewCreateNotificationQueryNotificationEntryAlert creates a new CreateNotificationQueryNotificationEntryAlert object.
func NewCreateNotificationQueryNotificationEntryAlert() *CreateNotificationQueryNotificationEntryAlert {
	return &CreateNotificationQueryNotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationEntryAlert.
func (CreateNotificationQueryNotificationEntryAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationEntryAlert"
}

// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationCount struct {
	Receiver         *string                                     `json:"receiver,omitempty"`
	Integration      *string                                     `json:"integration,omitempty"`
	IntegrationIndex *int64                                      `json:"integrationIndex,omitempty"`
	Status           *CreateNotificationQueryNotificationStatus  `json:"status,omitempty"`
	Outcome          *CreateNotificationQueryNotificationOutcome `json:"outcome,omitempty"`
	Error            *string                                     `json:"error,omitempty"`
	RuleUID          *string                                     `json:"ruleUID,omitempty"`
	// Count is the number of notification attempts in the time period. Set for counts queries.
	Count int64 `json:"count"`
	// Values is the list of (timestamp, count) pairs in the time series. Set for range_counts queries.
	Values []CreateNotificationQueryNotificationRangeValue `json:"values"`
}

// NewCreateNotificationQueryNotificationCount creates a new CreateNotificationQueryNotificationCount object.
func NewCreateNotificationQueryNotificationCount() *CreateNotificationQueryNotificationCount {
	return &CreateNotificationQueryNotificationCount{
		Values: []CreateNotificationQueryNotificationRangeValue{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationCount.
func (CreateNotificationQueryNotificationCount) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationCount"
}

// NotificationRangeValue is a single (timestamp, count) data point in a range count series.
// +k8s:openapi-gen=true
type CreateNotificationQueryNotificationRangeValue struct {
	// Timestamp is the Unix epoch in seconds for this data point.
	Timestamp int64 `json:"timestamp"`
	// Count is the number of notification attempts at this point in time.
	Count int64 `json:"count"`
}

// NewCreateNotificationQueryNotificationRangeValue creates a new CreateNotificationQueryNotificationRangeValue object.
func NewCreateNotificationQueryNotificationRangeValue() *CreateNotificationQueryNotificationRangeValue {
	return &CreateNotificationQueryNotificationRangeValue{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryNotificationRangeValue.
func (CreateNotificationQueryNotificationRangeValue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryNotificationRangeValue"
}

// +k8s:openapi-gen=true
type CreateNotificationQueryResponse struct {
	Entries []CreateNotificationQueryNotificationEntry `json:"entries"`
	Counts  []CreateNotificationQueryNotificationCount `json:"counts"`
}

// NewCreateNotificationQueryResponse creates a new CreateNotificationQueryResponse object.
func NewCreateNotificationQueryResponse() *CreateNotificationQueryResponse {
	return &CreateNotificationQueryResponse{
		Entries: []CreateNotificationQueryNotificationEntry{},
		Counts:  []CreateNotificationQueryNotificationCount{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryResponse.
func (CreateNotificationQueryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryResponse"
}
