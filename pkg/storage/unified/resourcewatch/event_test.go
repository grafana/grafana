package resourcewatch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestEventProtoRoundTrip(t *testing.T) {
	ev := Event{
		Type:            Modified,
		Group:           "provisioning.grafana.app",
		Resource:        "repositories",
		Namespace:       "default",
		Name:            "repo-1",
		ResourceVersion: 42,
		Folder:          "abc",
	}

	b, err := ev.Marshal()
	require.NoError(t, err)

	// The bytes are a valid resourcepb.WatchNotification, with the verb mapped
	// onto the proto enum.
	var n resourcepb.WatchNotification
	require.NoError(t, proto.Unmarshal(b, &n))
	assert.Equal(t, resourcepb.WatchNotification_MODIFIED, n.GetType())
	assert.Equal(t, "provisioning.grafana.app", n.GetGroup())
	assert.Equal(t, int64(42), n.GetResourceVersion())

	got, err := UnmarshalEvent(b)
	require.NoError(t, err)
	assert.Equal(t, ev, got)
}

// An unrecognized or unset verb round-trips through UNKNOWN rather than
// masquerading as a real change.
func TestEventUnknownType(t *testing.T) {
	b, err := Event{Type: "NONSENSE"}.Marshal()
	require.NoError(t, err)

	var n resourcepb.WatchNotification
	require.NoError(t, proto.Unmarshal(b, &n))
	assert.Equal(t, resourcepb.WatchNotification_UNKNOWN, n.GetType())

	got, err := UnmarshalEvent(b)
	require.NoError(t, err)
	assert.Equal(t, EventType(""), got.Type)
}

func TestUnmarshalEventInvalid(t *testing.T) {
	_, err := UnmarshalEvent([]byte("not a proto"))
	require.Error(t, err)
}
