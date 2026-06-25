package pulse

import (
	"encoding/json"
	"time"
)

// HookType is the transport a Pulse hook delivers over. The column +
// allowlist exist from day one so future transports (Slack, Microsoft
// Teams, etc.) can be added without a schema migration — exactly the
// contact-points pattern.
type HookType string

const (
	HookTypeWebhook HookType = "webhook"
	HookTypeMCP     HookType = "mcp"
	HookTypeAgent   HookType = "agent"
)

func (t HookType) Valid() bool {
	switch t {
	case HookTypeWebhook, HookTypeMCP, HookTypeAgent:
		return true
	}
	return false
}

// Hook is a named, org-scoped outbound integration that fires when a
// pulse mentions it. The canonical use case: a service-account-backed
// web service that receives a standardized JSON payload and posts an
// automated reply back onto the thread.
//
// Name is unique per org (case-insensitive) so it can be surfaced in
// the @-mention picker as a stable handle. Secret, when set, is used
// to HMAC-sign the outbound payload so the receiver can verify
// authenticity; it is never returned to clients.
//
// swagger:model
type Hook struct {
	ID        int64     `json:"-" xorm:"pk autoincr 'id'"`
	UID       string    `json:"uid" xorm:"uid"`
	OrgID     int64     `json:"orgId" xorm:"org_id"`
	Name      string    `json:"name" xorm:"name"`
	Type      HookType  `json:"type" xorm:"type"`
	URL       string    `json:"url" xorm:"url"`
	Disabled  bool      `json:"disabled" xorm:"'disabled'"`
	CreatedBy int64     `json:"createdBy" xorm:"created_by"`
	Created   time.Time `json:"created" xorm:"created"`
	Updated   time.Time `json:"updated" xorm:"updated"`
	// Secret is write-only over the API: it round-trips on create/update
	// but is stripped from every read response (see Hook.Sanitized). The
	// xorm tag persists it; the json tag keeps it out of marshalled
	// reads because handlers call Sanitized() before encoding.
	Secret string `json:"secret,omitempty" xorm:"secret"`
	// HasSecret is a read-side projection so the edit form can show
	// "a secret is configured" without ever shipping the secret value.
	HasSecret bool `json:"hasSecret" xorm:"-"`
}

func (Hook) TableName() string { return "pulse_hook" }

// Sanitized returns a copy safe to serialize to clients: the secret is
// cleared and HasSecret reflects whether one was set. Always call this
// at the API boundary before encoding a Hook.
func (h Hook) Sanitized() Hook {
	out := h
	out.HasSecret = h.Secret != ""
	out.Secret = ""
	return out
}

// CreateHookCommand creates a new named hook. OrgID + CreatedBy are
// populated from the request context, never the body.
//
// swagger:model
type CreateHookCommand struct {
	OrgID     int64    `json:"-"`
	CreatedBy int64    `json:"-"`
	Name      string   `json:"name"`
	Type      HookType `json:"type"`
	URL       string   `json:"url"`
	Secret    string   `json:"secret,omitempty"`
	Disabled  bool     `json:"disabled,omitempty"`
}

// UpdateHookCommand updates an existing hook in place. A nil Secret
// means "leave the stored secret unchanged"; an empty-string Secret
// means "clear it". Pointer semantics keep the edit form from having
// to re-send a secret it never received in the first place.
//
// swagger:model
type UpdateHookCommand struct {
	OrgID    int64    `json:"-"`
	UID      string   `json:"-"`
	Name     string   `json:"name"`
	Type     HookType `json:"type"`
	URL      string   `json:"url"`
	Secret   *string  `json:"secret,omitempty"`
	Disabled bool     `json:"disabled,omitempty"`
}

// DeleteHookCommand removes a hook. Existing pulse bodies that mention
// the hook keep their chip (it renders through the defensive fallback),
// but the hook no longer fires.
type DeleteHookCommand struct {
	OrgID int64  `json:"-"`
	UID   string `json:"-"`
}

// ListHooksQuery lists all hooks in an org, ordered by name.
type ListHooksQuery struct {
	OrgID int64 `json:"-"`
}

// MentionableHooksQuery powers the @-mention picker. Query is a
// case-insensitive prefix/substring match against the hook name; Limit
// caps the dropdown so a hundred configured hooks can't drown out user
// suggestions. Disabled hooks are excluded — you can't mention a hook
// that won't fire.
type MentionableHooksQuery struct {
	OrgID int64  `json:"-"`
	Query string `json:"-"`
	Limit int    `json:"-"`
}

// HookMentionHit is one row in the mention-picker response. Minimal by
// design (uid / name / type); no URL, no secret, nothing the picker
// doesn't render.
type HookMentionHit struct {
	UID  string   `json:"uid"`
	Name string   `json:"name"`
	Type HookType `json:"type"`
}

// HooksResponse is the JSON envelope for the list endpoint.
//
// swagger:model
type HooksResponse struct {
	Hooks []Hook `json:"hooks"`
}

// HookMentionsResponse is the JSON envelope for the mention-picker
// endpoint.
type HookMentionsResponse struct {
	Hooks []HookMentionHit `json:"hooks"`
}

// WebhookPayloadVersion is bumped if the outbound JSON shape changes in
// a backwards-incompatible way, so receivers can branch on it.
const WebhookPayloadVersion = "v1alpha1"

// WebhookPayload is the standardized JSON body POSTed to a hook URL
// when a pulse mentioning it is saved. It carries enough context for a
// receiving service (with a Grafana service account) to act — most
// commonly to post an automated reply back onto the same thread via
// POST /api/pulse/threads/{threadUID}/pulses.
//
// The shape is intentionally flat-ish and self-describing so an
// integration author can map it without reading Grafana internals.
type WebhookPayload struct {
	Version     string             `json:"version"`
	Event       EventAction        `json:"event"`
	TriggeredAt time.Time          `json:"triggeredAt"`
	OrgID       int64              `json:"orgId"`
	Hook        WebhookPayloadHook `json:"hook"`
	Resource    WebhookPayloadRes  `json:"resource"`
	Thread      WebhookPayloadThr  `json:"thread"`
	Pulse       WebhookPayloadPul  `json:"pulse"`
}

type WebhookPayloadHook struct {
	UID  string   `json:"uid"`
	Name string   `json:"name"`
	Type HookType `json:"type"`
}

type WebhookPayloadRes struct {
	Kind    ResourceKind `json:"kind"`
	UID     string       `json:"uid"`
	PanelID *int64       `json:"panelId,omitempty"`
	// URL is an absolute deeplink to the resource with the thread
	// auto-expanded, built from cfg.AppURL.
	URL string `json:"url,omitempty"`
}

type WebhookPayloadThr struct {
	UID   string `json:"uid"`
	Title string `json:"title,omitempty"`
}

type WebhookPayloadPul struct {
	UID          string          `json:"uid"`
	ParentUID    string          `json:"parentUid,omitempty"`
	AuthorUserID int64           `json:"authorUserId"`
	AuthorKind   AuthorKind      `json:"authorKind"`
	BodyText     string          `json:"bodyText"`
	Body         json.RawMessage `json:"body,omitempty"`
	Created      time.Time       `json:"created"`
}
