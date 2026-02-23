// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

type CreateNotificationqueryRequestNotificationStatus string

const (
	CreateNotificationqueryRequestNotificationStatusFiring   CreateNotificationqueryRequestNotificationStatus = "firing"
	CreateNotificationqueryRequestNotificationStatusResolved CreateNotificationqueryRequestNotificationStatus = "resolved"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestNotificationStatus.
func (CreateNotificationqueryRequestNotificationStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestNotificationStatus"
}

type CreateNotificationqueryRequestNotificationOutcome string

const (
	CreateNotificationqueryRequestNotificationOutcomeSuccess CreateNotificationqueryRequestNotificationOutcome = "success"
	CreateNotificationqueryRequestNotificationOutcomeError   CreateNotificationqueryRequestNotificationOutcome = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestNotificationOutcome.
func (CreateNotificationqueryRequestNotificationOutcome) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestNotificationOutcome"
}

type CreateNotificationqueryRequestMatchers []CreateNotificationqueryRequestMatcher

type CreateNotificationqueryRequestMatcher struct {
	Type  CreateNotificationqueryRequestMatcherType `json:"type"`
	Label string                                    `json:"label"`
	Value string                                    `json:"value"`
}

// NewCreateNotificationqueryRequestMatcher creates a new CreateNotificationqueryRequestMatcher object.
func NewCreateNotificationqueryRequestMatcher() *CreateNotificationqueryRequestMatcher {
	return &CreateNotificationqueryRequestMatcher{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestMatcher.
func (CreateNotificationqueryRequestMatcher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestMatcher"
}

type CreateNotificationqueryRequestBody struct {
	// From is the starting timestamp for the query.
	From *time.Time `json:"from,omitempty"`
	// To is the starting timestamp for the query.
	To *time.Time `json:"to,omitempty"`
	// Limit is the maximum number of entries to return.
	Limit *int64 `json:"limit,omitempty"`
	// Receiver optionally filters the entries by receiver title (contact point).
	Receiver *string `json:"receiver,omitempty"`
	// Status optionally filters the entries to only either firing or resolved.
	Status *CreateNotificationqueryRequestNotificationStatus `json:"status,omitempty"`
	// Outcome optionally filters the entries to only either successful or failed attempts.
	Outcome *CreateNotificationqueryRequestNotificationOutcome `json:"outcome,omitempty"`
	// RuleUID optionally filters the entries to a specific alert rule.
	RuleUID *string `json:"ruleUID,omitempty"`
	// GroupLabels optionally filters the entries by matching group labels.
	GroupLabels *CreateNotificationqueryRequestMatchers `json:"groupLabels,omitempty"`
	// Labels optionally filters the entries by matching alert labels.
	Labels *CreateNotificationqueryRequestMatchers `json:"labels,omitempty"`
}

// NewCreateNotificationqueryRequestBody creates a new CreateNotificationqueryRequestBody object.
func NewCreateNotificationqueryRequestBody() *CreateNotificationqueryRequestBody {
	return &CreateNotificationqueryRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestBody.
func (CreateNotificationqueryRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestBody"
}

type CreateNotificationqueryRequestMatcherType string

const (
	CreateNotificationqueryRequestMatcherTypeEqual         CreateNotificationqueryRequestMatcherType = "="
	CreateNotificationqueryRequestMatcherTypeNotEqual      CreateNotificationqueryRequestMatcherType = "!="
	CreateNotificationqueryRequestMatcherTypeEqualRegex    CreateNotificationqueryRequestMatcherType = "=~"
	CreateNotificationqueryRequestMatcherTypeNotEqualRegex CreateNotificationqueryRequestMatcherType = "!~"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestMatcherType.
func (CreateNotificationqueryRequestMatcherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestMatcherType"
}
