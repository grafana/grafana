package notification

import (
	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
)

// Aliases to shorten names.
// In the future, we may have to make these distinct types from the API,
// to handle differences in API versions, but that's not necessary for now.

type Query = v0alpha1.CreateNotificationqueryRequestBody

type Matchers = v0alpha1.CreateNotificationqueryRequestMatchers

type QueryResult = v0alpha1.CreateNotificationqueryResponse

type Status = v0alpha1.CreateNotificationqueryNotificationStatus

type Outcome = v0alpha1.CreateNotificationqueryNotificationOutcome

const (
	OutcomeSuccess = v0alpha1.CreateNotificationqueryNotificationOutcomeSuccess
	OutcomeError   = v0alpha1.CreateNotificationqueryNotificationOutcomeError
)

type Entry = v0alpha1.CreateNotificationqueryNotificationEntry

type EntryAlert = v0alpha1.CreateNotificationqueryNotificationEntryAlert
