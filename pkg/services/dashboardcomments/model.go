package dashboardcomments

import (
	"errors"
	"time"
)

var (
	ErrThreadNotFound     = errors.New("comment thread not found")
	ErrMessageNotFound    = errors.New("comment message not found")
	ErrForbidden          = errors.New("forbidden")
	ErrValidationFailed   = errors.New("command missing required fields")
	ErrEmptyBody          = errors.New("message body cannot be empty")
	ErrDashboardMismatch  = errors.New("thread does not belong to requested dashboard")
)

type Thread struct {
	ID                 int64     `xorm:"pk autoincr 'id'"`
	OrgID              int64     `xorm:"org_id"`
	DashboardUID       string    `xorm:"dashboard_uid"`
	AnchorPanelKey     string    `xorm:"anchor_panel_key"`
	AnchorXNorm        float64   `xorm:"anchor_x_norm"`
	AnchorYNorm        float64   `xorm:"anchor_y_norm"`
	ContextPanelTitle  string    `xorm:"context_panel_title"`
	ContextTimeFrom    string    `xorm:"context_time_from"`
	ContextTimeTo      string    `xorm:"context_time_to"`
	Resolved           bool      `xorm:"resolved"`
	ResolvedByUserID   int64     `xorm:"resolved_by_user_id"`
	ResolvedAt         time.Time `xorm:"resolved_at"`
	CreatedByUserID    int64     `xorm:"created_by_user_id"`
	CreatedAt          time.Time `xorm:"created_at"`
	UpdatedAt          time.Time `xorm:"updated_at"`

	Messages []Message `xorm:"-"`
}

type Message struct {
	ID             int64     `xorm:"pk autoincr 'id'"`
	ThreadID       int64     `xorm:"thread_id"`
	AuthorUserID   int64     `xorm:"author_user_id"`
	Body           string    `xorm:"body"`
	CreatedAt      time.Time `xorm:"created_at"`
	UpdatedAt      time.Time `xorm:"updated_at"`
}

func (Thread) TableName() string  { return "dashboard_comment_thread" }
func (Message) TableName() string { return "dashboard_comment_message" }

type CreateThreadCommand struct {
	OrgID             int64
	DashboardUID      string
	CreatedByUserID   int64
	AnchorPanelKey    string
	AnchorXNorm       float64
	AnchorYNorm       float64
	ContextPanelTitle string
	ContextTimeFrom   string
	ContextTimeTo     string
	InitialBody       string
}

func (c *CreateThreadCommand) Validate() error {
	if c.OrgID == 0 || c.DashboardUID == "" || c.CreatedByUserID == 0 || c.AnchorPanelKey == "" {
		return ErrValidationFailed
	}
	if c.InitialBody == "" {
		return ErrEmptyBody
	}
	return nil
}

type UpdateThreadCommand struct {
	OrgID         int64
	ThreadID      int64
	ActingUserID  int64
	IsDashEditor  bool
	Resolved      *bool
}

type DeleteThreadCommand struct {
	OrgID        int64
	ThreadID     int64
	ActingUserID int64
	IsDashEditor bool
}

type AddMessageCommand struct {
	OrgID        int64
	ThreadID     int64
	AuthorUserID int64
	Body         string
}

func (c *AddMessageCommand) Validate() error {
	if c.OrgID == 0 || c.ThreadID == 0 || c.AuthorUserID == 0 {
		return ErrValidationFailed
	}
	if c.Body == "" {
		return ErrEmptyBody
	}
	return nil
}

type DeleteMessageCommand struct {
	OrgID        int64
	MessageID    int64
	ActingUserID int64
	IsDashEditor bool
}

type ListThreadsQuery struct {
	OrgID        int64
	DashboardUID string
}
