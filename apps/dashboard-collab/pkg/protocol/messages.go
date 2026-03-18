package protocol

import "encoding/json"

// ClientMessage is what clients send to the ops channel.
type ClientMessage struct {
	Kind string          `json:"kind"` // "op", "lock", "checkpoint"
	Op   json.RawMessage `json:"op"`
}

// CollabOperation wraps a DashboardMutationAPI request with collab metadata.
type CollabOperation struct {
	Mutation   MutationRequest `json:"mutation"`
	LockTarget string          `json:"lockTarget"`
}

// MutationRequest is the protocol's own representation of a dashboard mutation.
// The backend treats the payload as opaque — it does not import or depend on
// DashboardMutationAPI command definitions.
type MutationRequest struct {
	Type    string          `json:"type"`    // e.g., "UPDATE_PANEL"
	Payload json.RawMessage `json:"payload"` // Zod-validated on frontend
}

// LockOperation requests or releases a panel-level soft lock.
type LockOperation struct {
	Type   string `json:"type"`   // "lock" or "unlock"
	Target string `json:"target"` // panelId or "__dashboard__", "__variables__", "__layout__"
	UserID string `json:"userId"`
}

// CheckpointOperation requests a named version snapshot.
type CheckpointOperation struct {
	Type    string `json:"type"`              // "checkpoint"
	Message string `json:"message,omitempty"` // version name
}

// ServerMessage is what the server broadcasts to all clients.
type ServerMessage struct {
	Seq       int64           `json:"seq"`
	Kind      string          `json:"kind"` // "op", "lock", "checkpoint", "presence"
	Op        json.RawMessage `json:"op"`
	UserID    string          `json:"userId"`
	Timestamp int64           `json:"timestamp"`
}

// CursorUpdate is ephemeral — sent on the cursors channel only, never hits server logic.
type CursorUpdate struct {
	Type        string  `json:"type"` // "cursor"
	UserID      string  `json:"userId"`
	DisplayName string  `json:"displayName"`
	AvatarURL   string  `json:"avatarUrl"`
	Color       string  `json:"color"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	PanelID     string  `json:"panelId,omitempty"`
}
