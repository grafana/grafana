package kinds

import (
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginspec"
)

func TestSpecProvider(t *testing.T) {
	info := OpenAPISpec()
	require.NotNil(t, info)

	const dir = "../../../../public/app/plugins/datasource/grafana-testdata-datasource/"

	// Make sure the plugin folder is accurate
	data, err := os.ReadFile(path.Join(dir, "plugin.json"))
	require.NoError(t, err)
	require.NotEmpty(t, data, "expecting a plugin.json in the same directory")

	writeSpec := false
	fname := "spec.v0alpha1.openapi.yaml"
	provider := pluginspec.NewSpecProvider(os.DirFS(dir))
	snapshot, err := provider.GetOpenAPI("v0alpha1")
	require.NoError(t, err)
	if snapshot == nil {
		t.Errorf("schema does not exist")
		writeSpec = true
	} else if diff := info.Diff(snapshot); diff != "" {
		t.Errorf("schema changed (-want +got):\n%s", diff)
		writeSpec = true
	}

	if writeSpec {
		raw, err := info.ToYAML()
		require.NoError(t, err)
		err = os.WriteFile(path.Join(dir, fname), raw, 0600)
		require.NoError(t, err)
		require.FailNow(t, "spec did not exist")
	}
}
