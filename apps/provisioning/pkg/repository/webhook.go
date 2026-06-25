package repository

// WebhookEventType classifies a normalized inbound webhook delivery.
type WebhookEventType int

const (
	WebhookEventUnsupported WebhookEventType = iota
	WebhookEventPing
	WebhookEventReplay
	WebhookEventPush
	WebhookEventPullRequest
)

type PullRequestAction string

const (
	PullRequestActionOpened   PullRequestAction = "opened"
	PullRequestActionReopened PullRequestAction = "reopened"
	PullRequestActionUpdated  PullRequestAction = "updated"
)

// WebhookEvent is the provider-agnostic form of an inbound webhook delivery.
// A provider's ProcessRequest normalizes its native event into this shape.
type WebhookEvent struct {
	Type         WebhookEventType
	RepoSlug     string
	Branch       string
	DeletedPaths []string
	TotalChanges int
	Action       PullRequestAction
	PRNumber     int
	PRURL        string
	SourceRef    string
	Hash         string
	Message      string
}
