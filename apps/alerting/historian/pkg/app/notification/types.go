package notification

import (
	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
)

// Aliases to shorten names.
// In the future, we may have to make these distinct types from the API,
// to handle differences in API versions, but that's not necessary for now.

type Query = v0alpha1.CreateNotificationqueryRequestBody

type Matchers = v0alpha1.CreateNotificationqueryRequestMatchers

type QueryResult = v0alpha1.CreateNotificationquery

type Status = v0alpha1.NotificationStatus

type Outcome = v0alpha1.NotificationOutcome

const (
	OutcomeSuccess = v0alpha1.NotificationOutcomeSuccess
	OutcomeError   = v0alpha1.NotificationOutcomeError
)

type Entry = v0alpha1.NotificationEntry

type EntryAlert = v0alpha1.NotificationEntryAlert
