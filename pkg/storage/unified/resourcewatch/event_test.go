package resourcewatch

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventJSONRoundTrip(t *testing.T) {
	ev := Event{
		Type:            Modified,
		Group:           "provisioning.grafana.app",
		Resource:        "repositories",
		Namespace:       "default",
		Name:            "repo-1",
		ResourceVersion: 42,
		Folder:          "abc",
	}

	b, err := json.Marshal(ev)
	require.NoError(t, err)
	// The custom EventType serializes as its bare verb string.
	assert.JSONEq(t, `{
		"type": "MODIFIED",
		"group": "provisioning.grafana.app",
		"resource": "repositories",
		"namespace": "default",
		"name": "repo-1",
		"resourceVersion": 42,
		"folder": "abc"
	}`, string(b))

	var got Event
	require.NoError(t, json.Unmarshal(b, &got))
	assert.Equal(t, ev, got)
}

func TestEventFolderOmitted(t *testing.T) {
	b, err := json.Marshal(Event{Type: Added})
	require.NoError(t, err)
	assert.NotContains(t, string(b), "folder")
}
