package pulse

import (
	"encoding/json"
	"time"
)

// ResourceKind is the kind of resource a Pulse thread is attached to.
//
// v1 supports "dashboard". The schema is polymorphic from day one so that
// future kinds (alert rule, datasource, etc.) can be added without
// migrating existing rows. Folder is intentionally NOT a thread kind:
// the folder Pulse tab aggregates dashboard-scoped threads from
// dashboards under that folder rather than holding folder-scoped
// conversations of its own.
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

// MentionKind is the kind of entity a mention token in a pulse body
// refers to. Folder mentions were dropped together with folder-as-a-
// resource: the picker no longer surfaces them, and any legacy folder
// chips persisted in old bodies render through the chip's defensive
// fallback rather than as a real navigable link.
//
// `time` chips carry a frozen-at-insert epoch-ms range in their
// TargetID (`<fromMs>|<toMs>`) so a comment like "look at this spike
// at 14:32" can pin to the exact dashboard window the author was
// viewing. They are NOT fan-out targets (no user/panel/dashboard id
// to look up) and are intentionally skipped by the denormalized
// pulse_mention table — see store.insertMentions.
//
// `assistant` chips tag the Grafana Assistant. Their TargetID is the
// fixed sentinel AssistantMentionTarget. They are not user fan-out
// targets (no user id to notify); instead the frontend's Grafana
// Assistant generates a reply for the tagging pulse and posts it back
// into the thread via AddAssistantReply, authored by the assistant
// service account.
type MentionKind string

const (
	MentionKindUser      MentionKind = "user"
	MentionKindPanel     MentionKind = "panel"
	MentionKindDashboard MentionKind = "dashboard"
	MentionKindTime      MentionKind = "time"
	MentionKindAssistant MentionKind = "assistant"
	// MentionKindWebhook references a named Pulse hook (an outbound
	// integration configured under Administration). The TargetID is
	// the hook's UID. Unlike user/panel/dashboard mentions, a webhook
	// mention is an *action* trigger: when a pulse carrying one is
	// saved, the matching hook fires (see hooks_dispatcher.go). It is
	// denormalized into pulse_mention like other entity mentions so a
	// future "where is this hook used" query is a single index hit.
	MentionKindWebhook MentionKind = "webhook"
)

func (k MentionKind) Valid() bool {
	switch k {
	case MentionKindUser, MentionKindPanel, MentionKindDashboard, MentionKindTime, MentionKindAssistant, MentionKindWebhook:
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
	Root          BodyNode              `json:"root"`
	Markdown      string                `json:"markdown,omitempty"`
	ServiceAuthor *ServiceAuthorDisplay `json:"serviceAuthor,omitempty"`
}

// ServiceAuthorDisplay is optional read-side display metadata for pulses
// authored by a synthetic service account. It lets hook replies render as the
// named hook without needing a user row or a schema migration.
type ServiceAuthorDisplay struct {
	Name  string `json:"name,omitempty"`
	Login string `json:"login,omitempty"`
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
	// FolderUID / FolderTitle are populated by the folder Pulse
	// rollup endpoint only. They identify the parent folder of the
	// thread's underlying dashboard so the rollup table can render a
	// "Folder" column with a navigable link to the dashboard's home.
	// Other surfaces leave these empty; the global overview already
	// has ResourceTitle for its single resource link.
	FolderUID   string `json:"folderUID,omitempty" xorm:"-"`
	FolderTitle string `json:"folderTitle,omitempty" xorm:"-"`
	// IsSubscribed is a per-viewer read-side projection: whether the
	// requesting user is subscribed to this thread. Populated only on
	// the single-thread read (GET /threads/{uid}) so the UI can render
	// the subscribe/unsubscribe toggle in the correct state. Pointer so
	// list endpoints (which don't compute it) marshal it as absent
	// rather than a misleading "false".
	IsSubscribed *bool `json:"isSubscribed,omitempty" xorm:"-"`
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

// AddAssistantReplyCommand persists a Grafana Assistant reply on a thread.
// The reply markdown is produced client-side by the Grafana Assistant; the
// backend stamps it under the assistant service account. OrgID and
// ThreadUID are set by the API handler from the request context / route.
//
// swagger:model
type AddAssistantReplyCommand struct {
	OrgID       int64  `json:"-"`
	ThreadUID   string `json:"-"`
	ParentUID   string `json:"parentUID,omitempty"`
	Markdown    string `json:"markdown"`
	AuthorName  string `json:"-"`
	AuthorLogin string `json:"-"`
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
//
// Filters are AND-combined and every filter rolls up across the
// thread's entire pulse fan-out, not just the root pulse — a match
// on any non-deleted child pulse lifts its parent into the result so
// the drawer behaves the way the user thinks of a "thread":
//
//   - PanelID matches if the thread is anchored to the panel OR any
//     pulse (root or reply) carries a `#panel:N` chip. The mention
//     fan-out is denormalized into pulse_mention with thread_uid, so
//     the sub-select picks up replies for free.
//   - AuthorUserID matches if the user started the thread OR
//     authored any non-deleted pulse on it. Repliers are surfaced via
//     the pulse table sub-select.
//   - Query is a case-insensitive substring match against the thread
//     title OR the body_text of any non-deleted pulse, so a child
//     reply that mentions "p99" lifts its root into a search for
//     "p99" even if the title and root pulse don't say so.
type ListThreadsQuery struct {
	OrgID        int64        `json:"-"`
	ResourceKind ResourceKind `json:"-"`
	ResourceUID  string       `json:"-"`
	PanelID      *int64       `json:"-"` // nil = no panel filter (matches anchored OR mentioned across child pulses)
	AuthorUserID *int64       `json:"-"` // nil = no participant filter (matches author OR replier across child pulses)
	Query        string       `json:"-"` // empty = no text filter (matches title OR body_text of any non-deleted pulse)
	// MineOnly + UserID mirror the ListAllThreadsQuery semantics so the
	// folder Pulse page (and any other per-resource surface that wants
	// a "Mine" scope toggle) can drop the caller's id into UserID and
	// flip MineOnly on. Subscriptions are included so a user who only
	// followed a thread without posting still sees it under "Mine".
	MineOnly bool  `json:"-"`
	UserID   int64 `json:"-"`
	// Status narrows the listing to open or closed threads. The zero
	// value (ThreadStatusAny) is "no filter" so callers that don't
	// care simply omit it.
	Status ThreadStatusFilter `json:"-"`
	// Page is 1-indexed. The drawer renders a numbered pager with the
	// current page highlighted, which means the UI needs the total
	// page count up-front; we offset-paginate here (rather than the
	// cursor model used by the global overview) so a click on
	// "Page 5" lands deterministically without the client having to
	// walk every prior page first.
	Page  int `json:"-"`
	Limit int `json:"-"`
}

// ParticipantSummary describes a user who has authored or replied on
// any open thread for a resource. Powers the "Users" filter dropdown
// in the per-resource Pulse drawer. Fields mirror what we already
// project for thread/pulse author rows so the frontend can render the
// dropdown row identically to a thread card avatar without a second
// fetch.
type ParticipantSummary struct {
	UserID    int64  `json:"userId"`
	Login     string `json:"login,omitempty"`
	Name      string `json:"name,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

// ListParticipantsQuery rolls up the unique non-deleted commenters on a
// resource. The result feeds the Users filter dropdown. Closed threads
// are intentionally included — a user who replied on a since-closed
// thread should still appear in the filter so they can find it.
type ListParticipantsQuery struct {
	OrgID        int64        `json:"-"`
	ResourceKind ResourceKind `json:"-"`
	ResourceUID  string       `json:"-"`
}

// ParticipantsResponse is the JSON envelope for the participants
// endpoint. Items are sorted by login ascending so the dropdown order
// is deterministic.
type ParticipantsResponse struct {
	ResourceKind ResourceKind         `json:"resourceKind"`
	ResourceUID  string               `json:"resourceUID"`
	Participants []ParticipantSummary `json:"participants"`
}

// ThreadStatusFilter narrows ListAllThreads to a subset of threads by
// their close state. Empty (the zero value) returns every thread; the
// non-empty variants are exhaustive and any other string is rejected
// at the API boundary so the SQL layer never sees an invalid status.
type ThreadStatusFilter string

const (
	ThreadStatusAny    ThreadStatusFilter = ""
	ThreadStatusOpen   ThreadStatusFilter = "open"
	ThreadStatusClosed ThreadStatusFilter = "closed"
)

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
	OrgID    int64              `json:"-"`
	UserID   int64              `json:"-"`
	Query    string             `json:"-"` // optional: matches thread title and pulse body_text
	MineOnly bool               `json:"-"` // optional: scope to threads the caller participates in
	Status   ThreadStatusFilter `json:"-"` // optional: open / closed / any (default)
	Page     int                `json:"-"`
	Limit    int                `json:"-"`
}

// ListFolderRolledUpThreadsQuery powers the folder Pulse tab. The
// folder itself is NOT a Pulse resource — this query rolls up the
// most-recently-active dashboard-scoped threads for every dashboard
// that lives anywhere under the given folder (its direct children
// plus every descendant subfolder), so a user can scan one tab and
// see every conversation happening "inside" that folder regardless
// of which specific dashboard hosts it.
//
// Permission is enforced at the dashboard search step (the same
// SignedInUser that the dashboard list page uses) so a viewer who
// can't see a dashboard never sees its threads here either.
//
// Filters mirror ListThreadsQuery semantics so the tab can offer the
// same Status / Mine / search / Users dropdown as the per-resource
// drawer. The store layer uses the resolved dashboard UID set from
// the service layer rather than re-walking the folder tree itself.
type ListFolderRolledUpThreadsQuery struct {
	OrgID         int64
	UserID        int64
	DashboardUIDs []string `json:"-"`
	AuthorUserID  *int64
	Query         string
	MineOnly      bool
	Status        ThreadStatusFilter
	Page          int
	Limit         int
}

// ListPulsesQuery returns pulses inside a thread, oldest first by default
// (Slack-style). Cursor is opaque.
type ListPulsesQuery struct {
	OrgID     int64  `json:"-"`
	ThreadUID string `json:"-"`
	Limit     int    `json:"-"`
	Cursor    string `json:"-"`
}

// ListPanelMentionsQuery rolls up panel-relevant pulse activity for a
// single resource (today always a dashboard). The result powers the
// per-panel Pulse indicator in the visualization title bar.
type ListPanelMentionsQuery struct {
	OrgID        int64        `json:"-"`
	ResourceKind ResourceKind `json:"-"`
	ResourceUID  string       `json:"-"`
}

// PanelMentionSummary aggregates the open threads that touch a single
// panel — either anchored to it via Thread.PanelID or referencing it
// via a #panel mention chip in any pulse on the resource. Closed
// threads are excluded so the indicator reflects live conversation.
//
// LatestThreadUID is the UID of the most-recently-active matching
// thread; the frontend opens straight to it when the count is one,
// and falls back to the panel-scoped drawer view when it's higher.
// LatestThreadTitle is included so a tooltip can render without a
// follow-up fetch.
type PanelMentionSummary struct {
	PanelID           int64  `json:"panelId"`
	ThreadCount       int    `json:"threadCount"`
	LatestThreadUID   string `json:"latestThreadUID"`
	LatestThreadTitle string `json:"latestThreadTitle,omitempty"`
}

// PanelMentionsResponse is the JSON envelope returned by the
// panel-mentions endpoint. Items are sorted by panel id ascending so
// the wire format is deterministic across calls.
type PanelMentionsResponse struct {
	ResourceKind ResourceKind          `json:"resourceKind"`
	ResourceUID  string                `json:"resourceUID"`
	Mentions     []PanelMentionSummary `json:"mentions"`
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

// ResourceUnreadCountResponse is the JSON envelope returned by the
// per-resource unread-count endpoint. The frontend renders a numeric
// badge over the dashboard sidebar's Pulse icon when UnreadCount > 0.
//
// "Unread" is defined as the union of two cases per (user, thread):
//   - the thread has no pulse_read_state row for the user, OR
//   - the thread's last_pulse_at is strictly newer than the user's
//     last_read_at on that thread.
//
// Threads the user authored or replied to are marked read for the
// author at write time (insertThreadAndPulse / insertPulse upsert a
// read-state row for the author), so this surface never tells a user
// they have unread activity that is entirely their own. Closed
// threads are intentionally still counted — silencing a closed
// thread the user has not yet seen would hide moderation/closure
// events the user should know about.
type ResourceUnreadCountResponse struct {
	ResourceKind ResourceKind `json:"resourceKind"`
	ResourceUID  string       `json:"resourceUID"`
	UnreadCount  int64        `json:"unreadCount"`
}

// FolderUnreadCountResponse is the JSON envelope returned by the
// folder unread-count endpoint. The folder isn't a Pulse resource;
// the count rolls up across every dashboard the caller can read
// under the folder hierarchy (same dashboard set as the rollup
// listing). The Pulse tab in the folder navmodel renders this value
// as a tabCounter so users see "where's the conversation happening"
// at a glance.
type FolderUnreadCountResponse struct {
	FolderUID   string `json:"folderUID"`
	UnreadCount int64  `json:"unreadCount"`
}
