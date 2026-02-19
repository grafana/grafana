// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

type CreateNotificationQueryRequestNotificationStatus string

const (
	CreateNotificationQueryRequestNotificationStatusFiring   CreateNotificationQueryRequestNotificationStatus = "firing"
	CreateNotificationQueryRequestNotificationStatusResolved CreateNotificationQueryRequestNotificationStatus = "resolved"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryRequestNotificationStatus.
func (CreateNotificationQueryRequestNotificationStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryRequestNotificationStatus"
}

type CreateNotificationQueryRequestNotificationOutcome string

const (
	CreateNotificationQueryRequestNotificationOutcomeSuccess CreateNotificationQueryRequestNotificationOutcome = "success"
	CreateNotificationQueryRequestNotificationOutcomeError   CreateNotificationQueryRequestNotificationOutcome = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryRequestNotificationOutcome.
func (CreateNotificationQueryRequestNotificationOutcome) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryRequestNotificationOutcome"
}

type CreateNotificationQueryRequestMatchers []CreateNotificationQueryRequestMatcher

type CreateNotificationQueryRequestMatcher struct {
	Type  CreateNotificationQueryRequestMatcherType `json:"type"`
	Label string                                    `json:"label"`
	Value string                                    `json:"value"`
}

// NewCreateNotificationQueryRequestMatcher creates a new CreateNotificationQueryRequestMatcher object.
func NewCreateNotificationQueryRequestMatcher() *CreateNotificationQueryRequestMatcher {
	return &CreateNotificationQueryRequestMatcher{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryRequestMatcher.
func (CreateNotificationQueryRequestMatcher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryRequestMatcher"
}

type CreateNotificationQueryRequestBody struct {
	// From is the starting timestamp for the query.
	From *time.Time `json:"from,omitempty"`
	// To is the starting timestamp for the query.
	To *time.Time `json:"to,omitempty"`
	// Limit is the maximum number of entries to return.
	Limit *int64 `json:"limit,omitempty"`
	// Receiver optionally filters the entries by receiver title (contact point).
	Receiver *string `json:"receiver,omitempty"`
	// Status optionally filters the entries to only either firing or resolved.
	Status *CreateNotificationQueryRequestNotificationStatus `json:"status,omitempty"`
	// Outcome optionally filters the entries to only either successful or failed attempts.
	Outcome *CreateNotificationQueryRequestNotificationOutcome `json:"outcome,omitempty"`
	// RuleUID optionally filters the entries to a specific alert rule.
	RuleUID *string `json:"ruleUID,omitempty"`
	// GroupLabels optionally filters the entries by matching group labels.
	GroupLabels *CreateNotificationQueryRequestMatchers `json:"groupLabels,omitempty"`
	// Labels optionally filters the entries by matching alert labels.
	Labels *CreateNotificationQueryRequestMatchers `json:"labels,omitempty"`
}

// NewCreateNotificationQueryRequestBody creates a new CreateNotificationQueryRequestBody object.
func NewCreateNotificationQueryRequestBody() *CreateNotificationQueryRequestBody {
	return &CreateNotificationQueryRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryRequestBody.
func (CreateNotificationQueryRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryRequestBody"
}

type CreateNotificationQueryRequestMatcherType string

const (
	CreateNotificationQueryRequestMatcherTypeEqual         CreateNotificationQueryRequestMatcherType = "="
	CreateNotificationQueryRequestMatcherTypeNotEqual      CreateNotificationQueryRequestMatcherType = "!="
	CreateNotificationQueryRequestMatcherTypeEqualRegex    CreateNotificationQueryRequestMatcherType = "=~"
	CreateNotificationQueryRequestMatcherTypeNotEqualRegex CreateNotificationQueryRequestMatcherType = "!~"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationQueryRequestMatcherType.
func (CreateNotificationQueryRequestMatcherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationQueryRequestMatcherType"
}
