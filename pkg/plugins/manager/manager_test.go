package manager

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestPluginManager_Init(t *testing.T) {
	t.Run("Plugin sources are added in order", func(t *testing.T) {
		var addedPaths []string
		inst := &fakes.FakeInstaller{
			AddFromSourceFunc: func(ctx context.Context, source plugins.PluginSource) error {
				addedPaths = append(addedPaths, source.Paths...)
				return nil
			},
		}
		pm := NewManager(inst, []plugins.PluginSource{
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.Core, Paths: []string{"path2"}},
			{Class: plugins.External, Paths: []string{"path3"}},
		})

		err := pm.Init(context.Background())
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, addedPaths)
	})
}
