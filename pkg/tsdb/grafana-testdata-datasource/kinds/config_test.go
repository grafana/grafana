package kinds

import (
	"os"
	"path"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
)

const pluginDirectory = "../../../../public/app/plugins/datasource/grafana-testdata-datasource/"

func TestSpecProvider(t *testing.T) {
	info := Settings()
	require.NotNil(t, info)

	// Make sure the plugin folder is accurate
	data, err := os.ReadFile(path.Join(pluginDirectory, "plugin.json"))
	require.NoError(t, err)
	require.NotEmpty(t, data, "expecting a plugin.json in the same directory")

	writeSpec := false
	fname := "v0alpha1/settings.yaml"
	provider := pluginschema.NewSchemaProvider(os.DirFS(pluginDirectory), "schema")
	snapshot, err := provider.GetSettings("v0alpha1")
	require.NoError(t, err)
	if snapshot == nil {
		t.Errorf("schema does not exist")
		writeSpec = true
	} else if diff := pluginschema.Diff(info, snapshot); diff != "" {
		t.Errorf("schema changed (-want +got):\n%s", diff)
		writeSpec = true
	}

	if writeSpec {
		raw, err := pluginschema.ToYAML(info)
		require.NoError(t, err)
		fpath := path.Join(pluginDirectory, fname)
		os.MkdirAll(filepath.Dir(fpath), 0750)
		err = os.WriteFile(fpath, raw, 0600)
		require.NoError(t, err)
		require.FailNow(t, "schema did not exist")
	}
}
