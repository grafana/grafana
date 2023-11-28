package managedstream

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func testFrameCache(t *testing.T, c FrameCache) {
	// Create new frame and update cache.
	frame := data.NewFrame("hello")
	frameJsonCache, err := data.FrameToJSONCache(frame)
	require.NoError(t, err)

	updated, err := c.Update(context.Background(), 1, "test", frameJsonCache)
	require.NoError(t, err)
	require.True(t, updated)

	// Make sure channel is active.
	channels, err := c.GetActiveChannels(1)
	require.NoError(t, err)
	schema, ok := channels["test"]
	require.True(t, ok)
	require.NotZero(t, schema)

	// Make sure the same frame does not update schema.
	updated, err = c.Update(context.Background(), 1, "test", frameJsonCache)
	require.NoError(t, err)
	require.False(t, updated)

	// Now construct new frame with updated schema.
	newFrame := data.NewFrame("hello", data.NewField("new_field", nil, []int64{}))
	frameJsonCache, err = data.FrameToJSONCache(newFrame)
	require.NoError(t, err)

	// Make sure schema updated.
	updated, err = c.Update(context.Background(), 1, "test", frameJsonCache)
	require.NoError(t, err)
	require.True(t, updated)

	// Add the same with another orgID and make sure schema updated.
	updated, err = c.Update(context.Background(), 2, "test", frameJsonCache)
	require.NoError(t, err)
	require.True(t, updated)

	// Make sure that the last frame successfully saved in cache.
	frameJSON, ok, err := c.GetFrame(context.Background(), 1, "test")
	require.NoError(t, err)
	require.True(t, ok)

	var f data.Frame
	err = json.Unmarshal(frameJSON, &f)
	require.NoError(t, err)
	require.Equal(t, "new_field", f.Fields[0].Name)

	// Make sure channel has updated schema.
	channels, err = c.GetActiveChannels(1)
	require.NoError(t, err)
	require.NotEqual(t, string(channels["test"]), string(schema))
}

func TestMemoryFrameCache(t *testing.T) {
	c := NewMemoryFrameCache()
	require.NotNil(t, c)
	testFrameCache(t, c)
}
