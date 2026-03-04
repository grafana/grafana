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
	// Type of query to perform (default: entries)
	Type *CreateNotificationqueryRequestBodyType `json:"type,omitempty"`
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
	// GroupBy specifies how to aggregate counts queries.
	GroupBy *CreateNotificationqueryRequestV0alpha1BodyGroupBy `json:"groupBy,omitempty"`
}

// NewCreateNotificationqueryRequestBody creates a new CreateNotificationqueryRequestBody object.
func NewCreateNotificationqueryRequestBody() *CreateNotificationqueryRequestBody {
	return &CreateNotificationqueryRequestBody{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestBody.
func (CreateNotificationqueryRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestBody"
}

type CreateNotificationqueryRequestV0alpha1BodyGroupBy struct {
	Receiver         bool `json:"receiver"`
	Integration      bool `json:"integration"`
	IntegrationIndex bool `json:"integrationIndex"`
	Status           bool `json:"status"`
	Outcome          bool `json:"outcome"`
	Error            bool `json:"error"`
}

// NewCreateNotificationqueryRequestV0alpha1BodyGroupBy creates a new CreateNotificationqueryRequestV0alpha1BodyGroupBy object.
func NewCreateNotificationqueryRequestV0alpha1BodyGroupBy() *CreateNotificationqueryRequestV0alpha1BodyGroupBy {
	return &CreateNotificationqueryRequestV0alpha1BodyGroupBy{}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestV0alpha1BodyGroupBy.
func (CreateNotificationqueryRequestV0alpha1BodyGroupBy) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestV0alpha1BodyGroupBy"
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

type CreateNotificationqueryRequestBodyType string

const (
	CreateNotificationqueryRequestBodyTypeEntries CreateNotificationqueryRequestBodyType = "entries"
	CreateNotificationqueryRequestBodyTypeCounts  CreateNotificationqueryRequestBodyType = "counts"
)

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationqueryRequestBodyType.
func (CreateNotificationqueryRequestBodyType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationqueryRequestBodyType"
}
