package filestore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

const (
	testPluginID = "test-ds"
	buildHashOld = "oldbuildhash"
	assetName    = "module.js"
)

// TestService_File_RetainedBuild verifies that the filestore serves a retained
// build's asset (by buildHash) with byte-identical content to when it was active.
func TestService_File_RetainedBuild(t *testing.T) {
	ctx := context.Background()

	activeContent := []byte("active build module contents")
	retainedContent := []byte("retained build module contents — different bytes")

	reg := registry.NewInMemory()

	active := &plugins.Plugin{
		JSONData: plugins.JSONData{ID: testPluginID, Info: plugins.Info{Version: "2.0.0"}},
		FS:       plugins.NewInMemoryFS(map[string][]byte{assetName: activeContent}),
	}
	require.NoError(t, reg.Add(ctx, active))
	require.NoError(t, reg.AddBuild(ctx, "activebuildhash", active))

	retained := &plugins.Plugin{
		JSONData: plugins.JSONData{ID: testPluginID, Info: plugins.Info{Version: "1.0.0"}},
		FS:       plugins.NewInMemoryFS(map[string][]byte{assetName: retainedContent}),
	}
	require.NoError(t, reg.AddBuild(ctx, buildHashOld, retained))

	svc := ProvideService(reg)

	t.Run("BuildFile serves the retained build asset by buildHash", func(t *testing.T) {
		f, err := svc.BuildFile(ctx, testPluginID, buildHashOld, assetName)
		require.NoError(t, err)
		require.NotNil(t, f)
		require.Equal(t, retainedContent, f.Content)
		require.Len(t, f.Content, len(retainedContent))
	})

	t.Run("BuildFile serves the active build asset by its buildHash", func(t *testing.T) {
		f, err := svc.BuildFile(ctx, testPluginID, "activebuildhash", assetName)
		require.NoError(t, err)
		require.Equal(t, activeContent, f.Content)
	})

	t.Run("BuildFile with an unknown buildHash returns ErrPluginNotInstalled (no active fallback)", func(t *testing.T) {
		// Must NOT silently serve the active build — the route relies on this miss to
		// answer 410/404 for an evicted or never-seen build.
		_, err := svc.BuildFile(ctx, testPluginID, "neverexisted", assetName)
		require.ErrorIs(t, err, plugins.ErrPluginNotInstalled)
	})

	t.Run("File treats its argument as a version string and serves the active build", func(t *testing.T) {
		// Regression: legacy callers (plugin markdown, dashboards) pass plugin.Info.Version
		// (e.g. "1.0.0"), which is NOT a content buildHash. File must resolve the active
		// build and ignore the version rather than attempt a build-addressed lookup that
		// would miss and fail to load the README/dashboard.
		f, err := svc.File(ctx, testPluginID, "1.0.0", assetName)
		require.NoError(t, err)
		require.Equal(t, activeContent, f.Content)
	})

	t.Run("File with an empty version serves the active build (back-compat)", func(t *testing.T) {
		f, err := svc.File(ctx, testPluginID, "", assetName)
		require.NoError(t, err)
		require.Equal(t, activeContent, f.Content)
	})

	t.Run("Unknown plugin returns ErrPluginNotInstalled", func(t *testing.T) {
		_, err := svc.File(ctx, "unknown", "", assetName)
		require.ErrorIs(t, err, plugins.ErrPluginNotInstalled)
	})
}
