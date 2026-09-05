package registry

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

const (
	buildHashA = "aaaa1111"
	buildHashB = "bbbb2222"
	buildHashC = "cccc3333"
)

// TestInMemory_RetainedBuilds covers the retained-build registry behaviour
// introduced by F1-T2: multiple builds per plugin keyed by (pluginID, buildHash),
// resolvable concurrently, while the legacy active-build lookup is preserved.
func TestInMemory_RetainedBuilds(t *testing.T) {
	ctx := context.Background()

	t.Run("A plugin can have multiple concurrently resolvable builds", func(t *testing.T) {
		i := NewInMemory()

		active := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.Add(ctx, active))
		require.NoError(t, i.AddBuild(ctx, buildHashA, active))

		retained := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		require.NoError(t, i.AddBuild(ctx, buildHashB, retained))

		// Both builds resolve by (pluginID, buildHash).
		gotActive, ok := i.Build(ctx, pluginID, buildHashA)
		require.True(t, ok)
		require.Same(t, active, gotActive)

		gotRetained, ok := i.Build(ctx, pluginID, buildHashB)
		require.True(t, ok)
		require.Same(t, retained, gotRetained)

		// The two resolvable builds are distinct.
		require.NotSame(t, gotActive, gotRetained)
	})

	t.Run("Lookup by (pluginID, buildHash) returns the right build", func(t *testing.T) {
		i := NewInMemory()

		b1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		b2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.AddBuild(ctx, buildHashA, b1))
		require.NoError(t, i.AddBuild(ctx, buildHashB, b2))

		got1, ok := i.Build(ctx, pluginID, buildHashA)
		require.True(t, ok)
		require.Same(t, b1, got1)

		got2, ok := i.Build(ctx, pluginID, buildHashB)
		require.True(t, ok)
		require.Same(t, b2, got2)
	})

	t.Run("Unknown buildHash does not resolve", func(t *testing.T) {
		i := NewInMemory()

		b1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		require.NoError(t, i.AddBuild(ctx, buildHashA, b1))

		p, ok := i.Build(ctx, pluginID, "does-not-exist")
		require.False(t, ok)
		require.Nil(t, p)

		p, ok = i.Build(ctx, "unknown-plugin", buildHashA)
		require.False(t, ok)
		require.Nil(t, p)
	})

	t.Run("Empty buildHash falls back to the active build", func(t *testing.T) {
		i := NewInMemory()

		active := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.Add(ctx, active))

		got, ok := i.Build(ctx, pluginID, "")
		require.True(t, ok)
		require.Same(t, active, got)
	})

	t.Run("Legacy Plugin(ctx, id, \"\") still returns the active build", func(t *testing.T) {
		i := NewInMemory()

		active := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.Add(ctx, active))

		// Retain an older build alongside the active one.
		retained := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		require.NoError(t, i.AddBuild(ctx, buildHashB, retained))

		got, ok := i.Plugin(ctx, pluginID, "")
		require.True(t, ok)
		require.Same(t, active, got)
	})

	t.Run("Builds lists all retained builds for a plugin", func(t *testing.T) {
		i := NewInMemory()

		b1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		b2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.AddBuild(ctx, buildHashA, b1))
		require.NoError(t, i.AddBuild(ctx, buildHashB, b2))

		got := i.Builds(ctx, pluginID)
		require.Len(t, got, 2)

		none := i.Builds(ctx, "unknown-plugin")
		require.Empty(t, none)
	})

	t.Run("Re-registering the same buildHash replaces the build", func(t *testing.T) {
		i := NewInMemory()

		first := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		second := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		require.NoError(t, i.AddBuild(ctx, buildHashA, first))
		require.NoError(t, i.AddBuild(ctx, buildHashA, second))

		got, ok := i.Build(ctx, pluginID, buildHashA)
		require.True(t, ok)
		require.Same(t, second, got)
		require.Len(t, i.Builds(ctx, pluginID), 1)
	})

	t.Run("Capacity retains at most maxRetainedBuilds per plugin, evicting the oldest", func(t *testing.T) {
		i := NewInMemory()

		hashes := []string{buildHashA, buildHashB, buildHashC}
		builds := make([]*plugins.Plugin, len(hashes))
		for idx, h := range hashes {
			p := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: h}}}
			builds[idx] = p
			require.NoError(t, i.AddBuild(ctx, h, p))
			require.NoError(t, i.SetMaxRetainedBuilds(2))
		}

		// Only maxRetainedBuilds (2) most-recent builds are retained.
		require.Len(t, i.Builds(ctx, pluginID), 2)

		// Oldest (buildHashA) evicted.
		_, ok := i.Build(ctx, pluginID, buildHashA)
		require.False(t, ok)

		// Two most-recent still resolvable.
		_, ok = i.Build(ctx, pluginID, buildHashB)
		require.True(t, ok)
		_, ok = i.Build(ctx, pluginID, buildHashC)
		require.True(t, ok)
	})

	t.Run("Capacity eviction never removes the active build", func(t *testing.T) {
		i := NewInMemory()

		// The active build is registered first (Add + AddBuild), so it has the
		// lowest sequence number and would be the first eviction victim without the
		// active-build pin.
		active := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.Add(ctx, active))
		require.NoError(t, i.AddBuild(ctx, "active000", active))

		// Seed enough other builds to push the plugin over the default cap.
		for _, h := range []string{"seed0001", "seed0002", "seed0003"} {
			seed := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID}}
			require.NoError(t, i.AddBuild(ctx, h, seed))
		}

		// The cap is enforced...
		require.Len(t, i.Builds(ctx, pluginID), defaultMaxRetainedBuilds)

		// ...but the active build survives and still resolves; a build-addressed
		// request for the live build must not miss.
		got, ok := i.Build(ctx, pluginID, "active000")
		require.True(t, ok)
		require.Same(t, active, got)

		// The oldest seeded build was evicted in its place.
		_, ok = i.Build(ctx, pluginID, "seed0001")
		require.False(t, ok)
	})

	t.Run("Removing (uninstalling) a plugin drops all its retained builds", func(t *testing.T) {
		i := NewInMemory()

		active := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.Add(ctx, active))
		require.NoError(t, i.AddBuild(ctx, "active000", active))
		retained := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		require.NoError(t, i.AddBuild(ctx, buildHashB, retained))

		require.NoError(t, i.Remove(ctx, pluginID, ""))

		// No build resolves anymore, so the build-addressed route stops serving the
		// removed plugin's files and the retained build objects are released.
		_, ok := i.Build(ctx, pluginID, "active000")
		require.False(t, ok)
		_, ok = i.Build(ctx, pluginID, buildHashB)
		require.False(t, ok)
		require.Empty(t, i.Builds(ctx, pluginID))
	})

	t.Run("RemoveBuild drops a single retained build", func(t *testing.T) {
		i := NewInMemory()

		b1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v1}}}
		b2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID, Info: plugins.Info{Version: v2}}}
		require.NoError(t, i.AddBuild(ctx, buildHashA, b1))
		require.NoError(t, i.AddBuild(ctx, buildHashB, b2))

		require.NoError(t, i.RemoveBuild(ctx, pluginID, buildHashA))

		_, ok := i.Build(ctx, pluginID, buildHashA)
		require.False(t, ok)
		_, ok = i.Build(ctx, pluginID, buildHashB)
		require.True(t, ok)

		// Removing an unknown build is an error.
		require.Error(t, i.RemoveBuild(ctx, pluginID, "nope"))
	})
}
