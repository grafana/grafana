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

type CreateNotificationqueryRequestNotificationOutcome string

const (
	CreateNotificationqueryRequestNotificationOutcomeSuccess CreateNotificationqueryRequestNotificationOutcome = "success"
	CreateNotificationqueryRequestNotificationOutcomeError   CreateNotificationqueryRequestNotificationOutcome = "error"
)

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
}

// NewCreateNotificationqueryRequestBody creates a new CreateNotificationqueryRequestBody object.
func NewCreateNotificationqueryRequestBody() *CreateNotificationqueryRequestBody {
	return &CreateNotificationqueryRequestBody{}
}

type CreateNotificationqueryRequestMatcherType string

const (
	CreateNotificationqueryRequestMatcherTypeEqual         CreateNotificationqueryRequestMatcherType = "="
	CreateNotificationqueryRequestMatcherTypeNotEqual      CreateNotificationqueryRequestMatcherType = "!="
	CreateNotificationqueryRequestMatcherTypeEqualRegex    CreateNotificationqueryRequestMatcherType = "=~"
	CreateNotificationqueryRequestMatcherTypeNotEqualRegex CreateNotificationqueryRequestMatcherType = "!~"
)
