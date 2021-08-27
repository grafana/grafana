package models

type LiveNotice struct {
	Timestamp int64  `json:"time,omitempty"` // UI can dismiss notice by timestam as id
	Kind      string `json:"kind,omitempty"` // key that defines full behavior
	Title     string `json:"title,omitempty"`
	Body      string `json:"body,omitempty"`
	Severity  string `json:"severity,omitempty"`
}

type LiveNoticeAction string

const (
	LiveNoticeClear       LiveNoticeAction = "clear"
	LiveNoticeAdd         LiveNoticeAction = "add"
	LiveNoticeRemove      LiveNoticeAction = "remove"
	LiveNoticeIncludeKind LiveNoticeAction = "includeKind"
	LiveNoticeExcludeKind LiveNoticeAction = "excludeKind"
)

// Will be sent over a notice channel
type LiveNoticeRequest struct {
	Action LiveNoticeAction `json:"action"`
	Notice *LiveNotice      `json:"notice,omitempty"`
}
