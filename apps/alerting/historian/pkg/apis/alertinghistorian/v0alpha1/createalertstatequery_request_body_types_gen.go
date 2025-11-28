// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

type CreateAlertstatequeryRequestState string

const (
	CreateAlertstatequeryRequestStateNormal     CreateAlertstatequeryRequestState = "normal"
	CreateAlertstatequeryRequestStateAlerting   CreateAlertstatequeryRequestState = "alerting"
	CreateAlertstatequeryRequestStatePending    CreateAlertstatequeryRequestState = "pending"
	CreateAlertstatequeryRequestStateNoData     CreateAlertstatequeryRequestState = "nodata"
	CreateAlertstatequeryRequestStateError      CreateAlertstatequeryRequestState = "error"
	CreateAlertstatequeryRequestStateRecovering CreateAlertstatequeryRequestState = "recovering"
)

type CreateAlertstatequeryRequestMatcher struct {
	Type  CreateAlertstatequeryRequestMatcherType `json:"type"`
	Label string                                  `json:"label"`
	Value string                                  `json:"value"`
}

// NewCreateAlertstatequeryRequestMatcher creates a new CreateAlertstatequeryRequestMatcher object.
func NewCreateAlertstatequeryRequestMatcher() *CreateAlertstatequeryRequestMatcher {
	return &CreateAlertstatequeryRequestMatcher{}
}

type CreateAlertstatequeryRequestBody struct {
	From         *int64                               `json:"from,omitempty"`
	To           *int64                               `json:"to,omitempty"`
	Limit        *int64                               `json:"limit,omitempty"`
	RuleUID      *string                              `json:"ruleUID,omitempty"`
	DashboardUID *string                              `json:"dashboardUID,omitempty"`
	PanelID      *int64                               `json:"panelID,omitempty"`
	Previous     *CreateAlertstatequeryRequestState   `json:"previous,omitempty"`
	Current      *CreateAlertstatequeryRequestState   `json:"current,omitempty"`
	Labels       *CreateAlertstatequeryRequestMatcher `json:"labels,omitempty"`
}

// NewCreateAlertstatequeryRequestBody creates a new CreateAlertstatequeryRequestBody object.
func NewCreateAlertstatequeryRequestBody() *CreateAlertstatequeryRequestBody {
	return &CreateAlertstatequeryRequestBody{}
}

type CreateAlertstatequeryRequestMatcherType string

const (
	CreateAlertstatequeryRequestMatcherTypeEqual         CreateAlertstatequeryRequestMatcherType = "="
	CreateAlertstatequeryRequestMatcherTypeNotEqual      CreateAlertstatequeryRequestMatcherType = "!="
	CreateAlertstatequeryRequestMatcherTypeEqualRegex    CreateAlertstatequeryRequestMatcherType = "=~"
	CreateAlertstatequeryRequestMatcherTypeNotEqualRegex CreateAlertstatequeryRequestMatcherType = "!~"
)
