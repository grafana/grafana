package protocol

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientMessageRoundTrip(t *testing.T) {
	original := ClientMessage{
		Kind: MessageKindOp,
		Op:   json.RawMessage(`{"mutation":{"type":"UPDATE_PANEL","payload":{"id":"panel-1"}},"lockTarget":"panel-1"}`),
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded ClientMessage
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original.Kind, decoded.Kind)
	require.JSONEq(t, string(original.Op), string(decoded.Op))
}

func TestCollabOperationRoundTrip(t *testing.T) {
	original := CollabOperation{
		Mutation: MutationRequest{
			Type:    "UPDATE_PANEL",
			Payload: json.RawMessage(`{"id":"panel-1","title":"New Title"}`),
		},
		LockTarget: "panel-1",
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded CollabOperation
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original.Mutation.Type, decoded.Mutation.Type)
	require.JSONEq(t, string(original.Mutation.Payload), string(decoded.Mutation.Payload))
	require.Equal(t, original.LockTarget, decoded.LockTarget)
}

func TestLockOperationRoundTrip(t *testing.T) {
	original := LockOperation{
		Type:   LockTypeLock,
		Target: "panel-1",
		UserID: "user-123",
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded LockOperation
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original, decoded)
}

func TestCheckpointOperationRoundTrip(t *testing.T) {
	original := CheckpointOperation{
		Type:    "checkpoint",
		Message: "Before deploy v2.1",
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded CheckpointOperation
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original, decoded)
}

func TestCheckpointOperationOmitsEmptyMessage(t *testing.T) {
	original := CheckpointOperation{
		Type: "checkpoint",
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)
	require.NotContains(t, string(data), "message")
}

func TestServerMessageRoundTrip(t *testing.T) {
	original := ServerMessage{
		Seq:       42,
		Kind:      MessageKindOp,
		Op:        json.RawMessage(`{"mutation":{"type":"UPDATE_PANEL","payload":{}},"lockTarget":"panel-1"}`),
		UserID:    "user-123",
		Timestamp: 1710700000000,
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded ServerMessage
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original.Seq, decoded.Seq)
	require.Equal(t, original.Kind, decoded.Kind)
	require.JSONEq(t, string(original.Op), string(decoded.Op))
	require.Equal(t, original.UserID, decoded.UserID)
	require.Equal(t, original.Timestamp, decoded.Timestamp)
}

func TestCursorUpdateRoundTrip(t *testing.T) {
	original := CursorUpdate{
		Type:        "cursor",
		UserID:      "user-123",
		DisplayName: "Alice",
		AvatarURL:   "https://example.com/alice.png",
		Color:       "#ff0000",
		X:           100.5,
		Y:           200.3,
		PanelID:     "panel-1",
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)

	var decoded CursorUpdate
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	require.Equal(t, original, decoded)
}

func TestCursorUpdateOmitsEmptyPanelID(t *testing.T) {
	original := CursorUpdate{
		Type:        "cursor",
		UserID:      "user-123",
		DisplayName: "Alice",
		AvatarURL:   "https://example.com/alice.png",
		Color:       "#ff0000",
		X:           100.5,
		Y:           200.3,
	}
	data, err := json.Marshal(original)
	require.NoError(t, err)
	require.NotContains(t, string(data), "panelId")
}
