// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

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

type CreateNotificationqueryRequestBody struct {
	// RFC3339Nano
	From *int64 `json:"from,omitempty"`
	// RFC3339Nano
	To       *int64                                             `json:"to,omitempty"`
	Limit    *int64                                             `json:"limit,omitempty"`
	Receiver *string                                            `json:"receiver,omitempty"`
	Status   *CreateNotificationqueryRequestNotificationStatus  `json:"status,omitempty"`
	Outcome  *CreateNotificationqueryRequestNotificationOutcome `json:"outcome,omitempty"`
	RuleUID  *string                                            `json:"ruleUID,omitempty"`
}

// NewCreateNotificationqueryRequestBody creates a new CreateNotificationqueryRequestBody object.
func NewCreateNotificationqueryRequestBody() *CreateNotificationqueryRequestBody {
	return &CreateNotificationqueryRequestBody{}
}
