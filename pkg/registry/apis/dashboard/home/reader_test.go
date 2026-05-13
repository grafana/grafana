package home

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
)

func TestReadDashboard(t *testing.T) {
	t.Run("empty path returns nil object and no error", func(t *testing.T) {
		obj, err := readDashboard("")
		require.NoError(t, err)
		require.Nil(t, obj)
	})

	t.Run("missing file returns an error", func(t *testing.T) {
		_, err := readDashboard(filepath.Join(t.TempDir(), "does-not-exist.json"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "read home dashboard")
	})

	t.Run("malformed JSON returns an error", func(t *testing.T) {
		path := writeDashboardFile(t, "{not json")
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "parse home dashboard")
	})

	t.Run("no apiVersion is treated as a v0 spec", func(t *testing.T) {
		path := writeDashboardFile(t, `{"title":"my home","panels":[]}`)
		obj, err := readDashboard(path)
		require.NoError(t, err)
		dash, ok := obj.(*dashv0.Dashboard)
		require.True(t, ok, "expected v0 Dashboard for spec-only payload")
		require.Equal(t, "my home", dash.Spec.Object["title"])
		// The whole payload becomes the spec, including panels.
		require.Contains(t, dash.Spec.Object, "panels")
	})

	t.Run("apiVersion v0alpha1 decodes into v0 Dashboard", func(t *testing.T) {
		path := writeDashboardFile(t, `{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind": "Dashboard",
			"spec": {"title": "v0 home"}
		}`)
		obj, err := readDashboard(path)
		require.NoError(t, err)
		dash, ok := obj.(*dashv0.Dashboard)
		require.True(t, ok)
		require.Equal(t, "v0 home", dash.Spec.Object["title"])
	})

	t.Run("apiVersion v1 decodes into v1 Dashboard", func(t *testing.T) {
		path := writeDashboardFile(t, `{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind": "Dashboard",
			"spec": {"title": "v1 home", "schemaVersion": 41}
		}`)
		obj, err := readDashboard(path)
		require.NoError(t, err)
		_, ok := obj.(*dashv1.Dashboard)
		require.True(t, ok, "expected v1 Dashboard")
	})

	t.Run("unsupported apiVersion returns an error", func(t *testing.T) {
		path := writeDashboardFile(t, `{"apiVersion":"dashboard.grafana.app/v9","spec":{}}`)
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported home dashboard apiVersion")
	})

	t.Run("apiVersion present with invalid body returns a decode error", func(t *testing.T) {
		// Spec is supposed to be an object; passing a number trips json.Unmarshal
		// when decoding into the typed Dashboard.
		path := writeDashboardFile(t, `{"apiVersion":"dashboard.grafana.app/v1","spec":123}`)
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "decode home dashboard")
	})

	t.Run("header parses but spec body cannot unmarshal to map", func(t *testing.T) {
		// No apiVersion → second unmarshal targets map[string]any; an array fails.
		path := writeDashboardFile(t, `[1,2,3]`)
		_, err := readDashboard(path)
		require.Error(t, err)
		// Either the header unmarshal or the spec unmarshal fails on the array;
		// both error messages mention "home dashboard".
		require.Contains(t, err.Error(), "home dashboard")
	})
}

func TestDefaultHomeDashboard(t *testing.T) {
	obj, err := defaultHomeDashboard()
	require.NoError(t, err)
	dash, ok := obj.(*dashv0.Dashboard)
	require.True(t, ok, "default home dashboard should be a v0 Dashboard")
	require.Equal(t, "home", dash.Spec.Object["title"])
}
