package crdt

import (
	"encoding/json"
)

// OperationType represents the type of CRDT operation
type OperationType string

const (
	OpAddPanel            OperationType = "add-panel"
	OpRemovePanel         OperationType = "remove-panel"
	OpUpdatePanelPosition OperationType = "update-panel-position"
	OpUpdatePanelSize     OperationType = "update-panel-size"
	OpUpdatePanelZIndex   OperationType = "update-panel-zindex"
	OpUpdatePanelExplore  OperationType = "update-panel-explore-state"
	OpUpdateTitle         OperationType = "update-title"
	OpAddComment          OperationType = "add-comment"
	OpRemoveComment       OperationType = "remove-comment"
	OpBatch               OperationType = "batch"
)

// Operation represents a CRDT operation
type Operation struct {
	Type        OperationType   `json:"type"`
	MapUID      string          `json:"mapUid"`
	OperationID string          `json:"operationId"`
	Timestamp   HLCTimestamp    `json:"timestamp"`
	NodeID      string          `json:"nodeId"`
	Payload     json.RawMessage `json:"payload"`
}

// AddPanelPayload represents the payload for add-panel operation
type AddPanelPayload struct {
	PanelID   string        `json:"panelId"`
	ExploreID string        `json:"exploreId"`
	Position  PanelPosition `json:"position"`
}

// RemovePanelPayload represents the payload for remove-panel operation
type RemovePanelPayload struct {
	PanelID      string   `json:"panelId"`
	ObservedTags []string `json:"observedTags"`
}

// UpdatePanelPositionPayload represents the payload for update-panel-position operation
type UpdatePanelPositionPayload struct {
	PanelID string  `json:"panelId"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
}

// UpdatePanelSizePayload represents the payload for update-panel-size operation
type UpdatePanelSizePayload struct {
	PanelID string  `json:"panelId"`
	Width   float64 `json:"width"`
	Height  float64 `json:"height"`
}

// UpdatePanelZIndexPayload represents the payload for update-panel-zindex operation
type UpdatePanelZIndexPayload struct {
	PanelID string `json:"panelId"`
	ZIndex  int64  `json:"zIndex"`
}

// UpdatePanelExploreStatePayload represents the payload for update-panel-explore-state operation
type UpdatePanelExploreStatePayload struct {
	PanelID      string      `json:"panelId"`
	ExploreState interface{} `json:"exploreState"`
}

// UpdateTitlePayload represents the payload for update-title operation
type UpdateTitlePayload struct {
	Title string `json:"title"`
}

// CommentData represents a comment with text, username, and timestamp
type CommentData struct {
	Text      string `json:"text"`
	Username  string `json:"username"`
	Timestamp int64  `json:"timestamp"`
}

// AddCommentPayload represents the payload for add-comment operation
type AddCommentPayload struct {
	CommentID string      `json:"commentId"`
	Comment   CommentData `json:"comment"`
}

// RemoveCommentPayload represents the payload for remove-comment operation
type RemoveCommentPayload struct {
	CommentID    string   `json:"commentId"`
	ObservedTags []string `json:"observedTags"`
}

// BatchPayload represents the payload for batch operation
type BatchPayload struct {
	Operations []Operation `json:"operations"`
}

// PanelPosition represents the position and size of a panel
type PanelPosition struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// ParsePayload parses the operation payload into the appropriate type
func (op *Operation) ParsePayload() (interface{}, error) {
	switch op.Type {
	case OpAddPanel:
		var payload AddPanelPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpRemovePanel:
		var payload RemovePanelPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpUpdatePanelPosition:
		var payload UpdatePanelPositionPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpUpdatePanelSize:
		var payload UpdatePanelSizePayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpUpdatePanelZIndex:
		var payload UpdatePanelZIndexPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpUpdatePanelExplore:
		var payload UpdatePanelExploreStatePayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpUpdateTitle:
		var payload UpdateTitlePayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpAddComment:
		var payload AddCommentPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpRemoveComment:
		var payload RemoveCommentPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	case OpBatch:
		var payload BatchPayload
		err := json.Unmarshal(op.Payload, &payload)
		return payload, err

	default:
		return nil, nil
	}
}
