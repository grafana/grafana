// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

type CreateToolRequestMatchers []CreateToolRequestMatcher

type CreateToolRequestMatcher struct {
	Type  CreateToolRequestMatcherType `json:"type"`
	Label string                       `json:"label"`
	Value string                       `json:"value"`
}

// NewCreateToolRequestMatcher creates a new CreateToolRequestMatcher object.
func NewCreateToolRequestMatcher() *CreateToolRequestMatcher {
	return &CreateToolRequestMatcher{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestMatcher.
func (CreateToolRequestMatcher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestMatcher"
}

type CreateToolRequestBody struct {
	// Operation specifies the the sub-tool to invoke.
	Operation CreateToolRequestBodyOperation `json:"operation"`
	// RuleUID specifies a specific alert rule UID to get history for.
	RuleUID *string `json:"ruleUID,omitempty"`
	// Type of query to perform (default: entries)
	Type *CreateToolRequestBodyType `json:"type,omitempty"`
	// From is the starting timestamp for the query.
	From *time.Time `json:"from,omitempty"`
	// To is the starting timestamp for the query.
	To *time.Time `json:"to,omitempty"`
	// Limit is the maximum number of entries to return.
	Limit *int64 `json:"limit,omitempty"`
	// GetAlertStateHistory holds get_alert_state_history operation specific options.
	GetAlertStateHistory *CreateToolRequestV0alpha1BodyGetAlertStateHistory `json:"get_alert_state_history,omitempty"`
	// GetNotificationHistory holds get_notification_history operation specific options
	GetNotificationHistory *CreateToolRequestV0alpha1BodyGetNotificationHistory `json:"get_notification_history,omitempty"`
}

// NewCreateToolRequestBody creates a new CreateToolRequestBody object.
func NewCreateToolRequestBody() *CreateToolRequestBody {
	return &CreateToolRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestBody.
func (CreateToolRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestBody"
}

type CreateToolRequestV0alpha1BodyGetAlertStateHistory struct {
	// State optionally filters alert state transition
	Type *CreateToolRequestV0alpha1BodyGetAlertStateHistoryType `json:"type,omitempty"`
}

// NewCreateToolRequestV0alpha1BodyGetAlertStateHistory creates a new CreateToolRequestV0alpha1BodyGetAlertStateHistory object.
func NewCreateToolRequestV0alpha1BodyGetAlertStateHistory() *CreateToolRequestV0alpha1BodyGetAlertStateHistory {
	return &CreateToolRequestV0alpha1BodyGetAlertStateHistory{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestV0alpha1BodyGetAlertStateHistory.
func (CreateToolRequestV0alpha1BodyGetAlertStateHistory) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestV0alpha1BodyGetAlertStateHistory"
}

type CreateToolRequestV0alpha1BodyGetNotificationHistory struct {
	// Receiver optionally filters the entries by receiver title (contact point).
	Receiver *string `json:"receiver,omitempty"`
	// Status optionally filters the entries to only either firing or resolved.
	Status *CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus `json:"status,omitempty"`
	// Outcome optionally filters the entries to only either successful or failed attempts.
	Outcome *CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome `json:"outcome,omitempty"`
	// GroupLabels optionally filters the entries by matching group labels.
	GroupLabels *CreateToolRequestMatchers `json:"groupLabels,omitempty"`
	// Labels optionally filters the entries by matching alert labels.
	Labels *CreateToolRequestMatchers `json:"labels,omitempty"`
}

// NewCreateToolRequestV0alpha1BodyGetNotificationHistory creates a new CreateToolRequestV0alpha1BodyGetNotificationHistory object.
func NewCreateToolRequestV0alpha1BodyGetNotificationHistory() *CreateToolRequestV0alpha1BodyGetNotificationHistory {
	return &CreateToolRequestV0alpha1BodyGetNotificationHistory{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestV0alpha1BodyGetNotificationHistory.
func (CreateToolRequestV0alpha1BodyGetNotificationHistory) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestV0alpha1BodyGetNotificationHistory"
}

type CreateToolRequestMatcherType string

const (
	CreateToolRequestMatcherTypeEqual         CreateToolRequestMatcherType = "="
	CreateToolRequestMatcherTypeNotEqual      CreateToolRequestMatcherType = "!="
	CreateToolRequestMatcherTypeEqualRegex    CreateToolRequestMatcherType = "=~"
	CreateToolRequestMatcherTypeNotEqualRegex CreateToolRequestMatcherType = "!~"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestMatcherType.
func (CreateToolRequestMatcherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestMatcherType"
}

type CreateToolRequestBodyOperation string

const (
	CreateToolRequestBodyOperationGetAlertStateHistory   CreateToolRequestBodyOperation = "get_alert_state_history"
	CreateToolRequestBodyOperationGetNotificationHistory CreateToolRequestBodyOperation = "get_notification_history"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestBodyOperation.
func (CreateToolRequestBodyOperation) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestBodyOperation"
}

type CreateToolRequestBodyType string

const (
	CreateToolRequestBodyTypeEntries CreateToolRequestBodyType = "entries"
	CreateToolRequestBodyTypeCounts  CreateToolRequestBodyType = "counts"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestBodyType.
func (CreateToolRequestBodyType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestBodyType"
}

type CreateToolRequestV0alpha1BodyGetAlertStateHistoryType string

const (
	CreateToolRequestV0alpha1BodyGetAlertStateHistoryTypeNormal   CreateToolRequestV0alpha1BodyGetAlertStateHistoryType = "normal"
	CreateToolRequestV0alpha1BodyGetAlertStateHistoryTypePending  CreateToolRequestV0alpha1BodyGetAlertStateHistoryType = "pending"
	CreateToolRequestV0alpha1BodyGetAlertStateHistoryTypeAlerting CreateToolRequestV0alpha1BodyGetAlertStateHistoryType = "alerting"
	CreateToolRequestV0alpha1BodyGetAlertStateHistoryTypeNoData   CreateToolRequestV0alpha1BodyGetAlertStateHistoryType = "nodata"
	CreateToolRequestV0alpha1BodyGetAlertStateHistoryTypeError    CreateToolRequestV0alpha1BodyGetAlertStateHistoryType = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestV0alpha1BodyGetAlertStateHistoryType.
func (CreateToolRequestV0alpha1BodyGetAlertStateHistoryType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestV0alpha1BodyGetAlertStateHistoryType"
}

type CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus string

const (
	CreateToolRequestV0alpha1BodyGetNotificationHistoryStatusFiring   CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus = "firing"
	CreateToolRequestV0alpha1BodyGetNotificationHistoryStatusResolved CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus = "resolved"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus.
func (CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestV0alpha1BodyGetNotificationHistoryStatus"
}

type CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome string

const (
	CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcomeSuccess CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome = "success"
	CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcomeFailure CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome = "failure"
)

// OpenAPIModelName returns the OpenAPI model name for CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome.
func (CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateToolRequestV0alpha1BodyGetNotificationHistoryOutcome"
}
