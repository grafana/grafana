package pulse

import (
	"encoding/json"
	"time"
)

// ResourceKind is the kind of resource a Pulse thread is attached to.
//
// v1 supports "dashboard". The schema is polymorphic from day one so that
// future kinds (folder, alert rule, datasource, etc.) can be added without
// migrating existing rows.
type ResourceKind string

const (
	ResourceKindDashboard ResourceKind = "dashboard"
)

func (k ResourceKind) Valid() bool {
	switch k {
	case ResourceKindDashboard:
		return true
	}
	return false
}

// MentionKind is the kind of entity a mention token in a pulse body refers to.
type MentionKind string

const (
	MentionKindUser  MentionKind = "user"
	MentionKindPanel MentionKind = "panel"
)

func (k MentionKind) Valid() bool {
	switch k {
	case MentionKindUser, MentionKindPanel:
		return true
	}
	return false
}

// AuthorKind distinguishes human authors from service accounts (agents, port
// tooling, automation). The frontend renders service-account pulses with a
// robot icon.
type AuthorKind string

const (
	AuthorKindUser           AuthorKind = "user"
	AuthorKindServiceAccount AuthorKind = "service_account"
)

// Body is the structured pulse body. The Markdown field carries the
// human-authored markdown source (rendered through the same
// renderMarkdown / sanitizer pipeline that other Grafana panels use, so
// it is XSS-safe to drop into dangerouslySetInnerHTML on the frontend).
// The Root AST is retained for two reasons: it is how the composer
// reports mention metadata back to the server (so notifications fan out
// without re-parsing markdown server-side), and bodies authored before
// markdown support was added still render via the AST walker.
//
// Allowed AST node types: paragraph, text, mention, link, code, quote,
// linebreak. The allowlist is enforced in ValidateBody so the AST is
// also safe to render directly via React data bindings.
type Body struct {
	Root     BodyNode `json:"root"`
	Markdown string   `json:"markdown,omitempty"`
}

// BodyNode is a single node in the body AST.
type BodyNode struct {
	Type     string     `json:"type"`
	Text     string     `json:"text,omitempty"`
	URL      string     `json:"url,omitempty"`
	Format   int        `json:"format,omitempty"`
	Mention  *Mention   `json:"mention,omitempty"`
	Children []BodyNode `json:"children,omitempty"`
}

// Mention is a structured reference to another Grafana entity inside a pulse
// body. It carries enough context for the frontend to render a chip without
// re-fetching, and for the backend to route notifications.
type Mention struct {
	Kind        MentionKind `json:"kind"`
	TargetID    string      `json:"targetId"`
	DisplayName string      `json:"displayName,omitempty"`
}

// Thread is a top-level conversation attached to a resource. Threads contain
// pulses (replies). Threads are scoped by org and resource; a single resource
// may have many threads.
//
// swagger:model
type Thread struct {
	ID           int64        `json:"-" xorm:"pk autoincr 'id'"`
	UID          string       `json:"uid" xorm:"uid"`
	OrgID        int64        `json:"orgId" xorm:"org_id"`
	ResourceKind ResourceKind `json:"resourceKind" xorm:"resource_kind"`
	ResourceUID  string       `json:"resourceUID" xorm:"resource_uid"`
	PanelID      *int64       `json:"panelId,omitempty" xorm:"panel_id"`
	Title        string       `json:"title,omitempty" xorm:"title"`
	CreatedBy    int64        `json:"createdBy" xorm:"created_by"`
	Created      time.Time    `json:"created" xorm:"created"`
	Updated      time.Time    `json:"updated" xorm:"updated"`
	LastPulseAt  time.Time    `json:"lastPulseAt" xorm:"last_pulse_at"`
	PulseCount   int64        `json:"pulseCount" xorm:"pulse_count"`
	Version      int64        `json:"version" xorm:"version"`
	// Closed flips when an author or admin closes the thread; replies are
	// rejected at the service layer when set. Reopening clears all three
	// columns and is gated to admins.
	Closed   bool       `json:"closed" xorm:"'closed'"`
	ClosedAt *time.Time `json:"closedAt,omitempty" xorm:"closed_at"`
	ClosedBy *int64     `json:"closedBy,omitempty" xorm:"closed_by"`
	// PreviewBody is the body AST of the first pulse, populated by the
	// API handler so the thread list can render the same mention chips
	// + formatting it would inside the thread itself. xorm:"-" keeps
	// this out of the table — it's a denormalized read-side projection.
	PreviewBody json.RawMessage `json:"previewBody,omitempty" xorm:"-"`
	// AuthorName / AuthorLogin / AuthorAvatarURL are populated alongside
	// PreviewBody so the thread card renders the starter's avatar and
	// display name without an N+1 user lookup on the frontend.
	AuthorName      string `json:"authorName,omitempty" xorm:"-"`
	AuthorLogin     string `json:"authorLogin,omitempty" xorm:"-"`
	AuthorAvatarURL string `json:"authorAvatarUrl,omitempty" xorm:"-"`
	// ResourceTitle is populated on the global Pulse overview only —
	// it's the human-readable title of the resource the thread is
	// attached to (e.g. the dashboard title), resolved at API time so
	// the frontend can render a rich link without N+1 lookups.
	ResourceTitle string `json:"resourceTitle,omitempty" xorm:"-"`
}

// Pulse is a single message inside a thread. The first pulse in a thread is
// the parent. Replies set ParentUID to the parent pulse's UID.
//
// swagger:model
type Pulse struct {
	ID           int64           `json:"-" xorm:"pk autoincr 'id'"`
	UID          string          `json:"uid" xorm:"uid"`
	ThreadUID    string          `json:"threadUID" xorm:"thread_uid"`
	ParentUID    string          `json:"parentUID,omitempty" xorm:"parent_uid"`
	OrgID        int64           `json:"orgId" xorm:"org_id"`
	AuthorUserID int64           `json:"authorUserId" xorm:"author_user_id"`
	AuthorKind   AuthorKind      `json:"authorKind" xorm:"author_kind"`
	BodyText     string          `json:"bodyText" xorm:"body_text"`
	BodyJSON     json.RawMessage `json:"body" xorm:"body_json"`
	Created      time.Time       `json:"created" xorm:"created"`
	Updated      time.Time       `json:"updated" xorm:"updated"`
	// xorm treats a bare "deleted" tag as a soft-delete sentinel and
	// auto-filters rows where deleted = true on every Get/Find. We want
	// the soft-delete flag to be visible to the application layer (so it
	// can render "this message was deleted" tombstones) and so we
	// quote-escape the column name to bypass xorm's magic.
	Edited  bool `json:"edited" xorm:"'edited'"`
	Deleted bool `json:"deleted" xorm:"'deleted'"`
	// AuthorName / AuthorLogin / AuthorAvatarURL are populated by the API
	// handler from the user service so the frontend doesn't need a
	// separate user lookup per pulse. The xorm:"-" tag keeps these out
	// of the table.
	AuthorName      string `json:"authorName,omitempty" xorm:"-"`
	AuthorLogin     string `json:"authorLogin,omitempty" xorm:"-"`
	AuthorAvatarURL string `json:"authorAvatarUrl,omitempty" xorm:"-"`
}

// Subscription marks that a user wants to be notified about new pulses on a
// thread.
type Subscription struct {
	OrgID        int64      `json:"orgId" xorm:"org_id"`
	ThreadUID    string     `json:"threadUID" xorm:"thread_uid"`
	UserID       int64      `json:"userId" xorm:"user_id"`
	SubscribedAt time.Time  `json:"subscribedAt" xorm:"subscribed_at"`
	MuteUntil    *time.Time `json:"muteUntil,omitempty" xorm:"mute_until"`
}

// ReadState tracks the last pulse a user has read on a thread, used to
// compute the unread badge.
type ReadState struct {
	OrgID            int64     `json:"orgId" xorm:"org_id"`
	ThreadUID        string    `json:"threadUID" xorm:"thread_uid"`
	UserID           int64     `json:"userId" xorm:"user_id"`
	LastReadPulseUID string    `json:"lastReadPulseUID" xorm:"last_read_pulse_uid"`
	LastReadAt       time.Time `json:"lastReadAt" xorm:"last_read_at"`
}

// MentionRow is the denormalized row used to fan out notifications and to
// answer "where am I mentioned" queries.
type MentionRow struct {
	PulseUID  string      `json:"pulseUID" xorm:"pulse_uid"`
	ThreadUID string      `json:"threadUID" xorm:"thread_uid"`
	OrgID     int64       `json:"orgId" xorm:"org_id"`
	Kind      MentionKind `json:"kind" xorm:"kind"`
	TargetID  string      `json:"targetId" xorm:"target_id"`
	Created   time.Time   `json:"created" xorm:"created"`
}

// TableName overrides keep xorm pointed at the migration table names rather
// than at xorm's snake_case-of-the-Go-type derivation. We declare these
// explicitly so renaming a Go type cannot silently rebind to a different
// table.
func (Thread) TableName() string       { return "pulse_thread" }
func (Pulse) TableName() string        { return "pulse" }
func (Subscription) TableName() string { return "pulse_subscription" }
func (ReadState) TableName() string    { return "pulse_read_state" }
func (MentionRow) TableName() string   { return "pulse_mention" }

// CreateThreadCommand creates a new thread on a resource. The thread is
// created together with its first pulse to avoid empty threads in the UI.
//
// swagger:model
type CreateThreadCommand struct {
	OrgID        int64           `json:"-"`
	AuthorUserID int64           `json:"-"`
	AuthorKind   AuthorKind      `json:"-"`
	ResourceKind ResourceKind    `json:"resourceKind"`
	ResourceUID  string          `json:"resourceUID"`
	PanelID      *int64          `json:"panelId,omitempty"`
	Title        string          `json:"title,omitempty"`
	Body         json.RawMessage `json:"body"`
}

// CreateThreadResult is what CreateThread returns.
type CreateThreadResult struct {
	Thread Thread `json:"thread"`
	Pulse  Pulse  `json:"pulse"`
}

// AddPulseCommand adds a pulse (parent or reply) to an existing thread.
//
// swagger:model
type AddPulseCommand struct {
	OrgID        int64           `json:"-"`
	ThreadUID    string          `json:"-"`
	AuthorUserID int64           `json:"-"`
	AuthorKind   AuthorKind      `json:"-"`
	ParentUID    string          `json:"parentUID,omitempty"`
	Body         json.RawMessage `json:"body"`
}

// EditPulseCommand updates the body of an existing pulse. Only the original
// author may edit; admins may delete but not edit (preserves intent).
type EditPulseCommand struct {
	OrgID    int64           `json:"-"`
	UID      string          `json:"-"`
	UserID   int64           `json:"-"`
	NewBody  json.RawMessage `json:"body"`
	IsAdmin  bool            `json:"-"`
	IsAuthor bool            `json:"-"`
}

// DeletePulseCommand soft-deletes a pulse.
type DeletePulseCommand struct {
	OrgID    int64  `json:"-"`
	UID      string `json:"-"`
	UserID   int64  `json:"-"`
	IsAdmin  bool   `json:"-"`
	IsAuthor bool   `json:"-"`
}

// DeleteThreadCommand hard-deletes a thread plus all its pulses, mentions,
// subscriptions, and read-state rows. Either the thread author or an admin
// can delete; the API handler is responsible for setting IsAdmin.
type DeleteThreadCommand struct {
	OrgID   int64  `json:"-"`
	UID     string `json:"-"`
	UserID  int64  `json:"-"`
	IsAdmin bool   `json:"-"`
}

// CloseThreadCommand marks a thread as closed. Author or admin can close.
type CloseThreadCommand struct {
	OrgID   int64  `json:"-"`
	UID     string `json:"-"`
	UserID  int64  `json:"-"`
	IsAdmin bool   `json:"-"`
}

// ReopenThreadCommand clears the closed flag. Admin-only.
type ReopenThreadCommand struct {
	OrgID   int64  `json:"-"`
	UID     string `json:"-"`
	UserID  int64  `json:"-"`
	IsAdmin bool   `json:"-"`
}

// ListThreadsQuery returns threads attached to a resource, ordered by most
// recent activity.
type ListThreadsQuery struct {
	OrgID        int64        `json:"-"`
	ResourceKind ResourceKind `json:"-"`
	ResourceUID  string       `json:"-"`
	PanelID      *int64       `json:"-"` // nil = all threads on the resource (incl. panel-scoped)
	Limit        int          `json:"-"`
	Cursor       string       `json:"-"`
}

// ListAllThreadsQuery returns threads across every resource in an org,
// ordered by most recent activity. Powers the global Pulse overview page
// in the main nav. The caller's UserID is required when MineOnly is true
// — that filter narrows the result to threads where the caller is the
// thread starter, has posted any pulse, or is subscribed.
//
// Pagination is offset-based (Page is 1-indexed) rather than cursor-based:
// the overview page is a browsing surface, not a chronological replay
// stream, and the table allows arbitrary jumps between pages.
type ListAllThreadsQuery struct {
	OrgID    int64  `json:"-"`
	UserID   int64  `json:"-"`
	Query    string `json:"-"` // optional: matches thread title and pulse body_text
	MineOnly bool   `json:"-"` // optional: scope to threads the caller participates in
	Page     int    `json:"-"`
	Limit    int    `json:"-"`
}

// ListPulsesQuery returns pulses inside a thread, oldest first by default
// (Slack-style). Cursor is opaque.
type ListPulsesQuery struct {
	OrgID     int64  `json:"-"`
	ThreadUID string `json:"-"`
	Limit     int    `json:"-"`
	Cursor    string `json:"-"`
}

// PageResult is the generic page envelope used by list endpoints.
//
// Cursor-based listings (per-resource threads, per-thread pulses) populate
// NextCursor and HasMore; offset-based listings (global overview) populate
// Page and TotalCount instead. A response uses one paradigm or the other
// — clients decide based on the endpoint they're calling.
type PageResult[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"nextCursor,omitempty"`
	HasMore    bool   `json:"hasMore"`
	Page       int    `json:"page,omitempty"`
	TotalCount int64  `json:"totalCount,omitempty"`
}

// ResourceVersion is returned by the polling fallback endpoint. Clients that
// cannot use Grafana Live poll this every 10s and refetch when version
// changes.
type ResourceVersion struct {
	ResourceKind ResourceKind `json:"resourceKind"`
	ResourceUID  string       `json:"resourceUID"`
	Version      int64        `json:"version"`
	LastPulseAt  time.Time    `json:"lastPulseAt"`
}

// SubscribeCommand toggles thread subscription for a user.
type SubscribeCommand struct {
	OrgID     int64  `json:"-"`
	ThreadUID string `json:"-"`
	UserID    int64  `json:"-"`
}

// MarkReadCommand updates a user's last-read marker on a thread.
type MarkReadCommand struct {
	OrgID            int64  `json:"-"`
	ThreadUID        string `json:"-"`
	UserID           int64  `json:"-"`
	LastReadPulseUID string `json:"lastReadPulseUID"`
}
