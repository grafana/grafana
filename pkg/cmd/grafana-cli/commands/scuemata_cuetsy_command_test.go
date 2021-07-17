package commands

import (
	"testing"

	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/stretchr/testify/require"
)

func TestCuetsyBasics(t *testing.T) {
	t.Run("Testing generate ts with cue schemas", func(t *testing.T) {
		var baseLoadPaths = load.BaseLoadPaths{
			BaseCueFS:       defaultBaseLoadPaths.BaseCueFS,
			DistPluginCueFS: defaultBaseLoadPaths.DistPluginCueFS,
		}

		err := generateTypeScriptFromCUE("testdata/panelts", baseLoadPaths)
		require.NoError(t, err, "error while generating type script from panel scuemata")
	})
}
