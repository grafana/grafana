package home

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/setting"
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
		// The header itself should not bleed into the spec.
		require.NotContains(t, dash.Spec.Object, "apiVersion")
	})

	t.Run("apiVersion v1 decodes into v1 Dashboard", func(t *testing.T) {
		path := writeDashboardFile(t, `{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind": "Dashboard",
			"spec": {"title": "v1 home", "schemaVersion": 41}
		}`)
		obj, err := readDashboard(path)
		require.NoError(t, err)
		dash, ok := obj.(*dashv1.Dashboard)
		require.True(t, ok, "expected v1 Dashboard")
		require.Equal(t, "v1 home", dash.Spec.Object["title"])
		require.EqualValues(t, 41, dash.Spec.Object["schemaVersion"])
	})

	t.Run("bare apiVersion without group is accepted", func(t *testing.T) {
		// NewDashboardObject strips the group prefix, but accepts a bare version too.
		path := writeDashboardFile(t, `{
			"apiVersion": "v1",
			"spec": {"title": "bare v1"}
		}`)
		obj, err := readDashboard(path)
		require.NoError(t, err)
		_, ok := obj.(*dashv1.Dashboard)
		require.True(t, ok)
	})

	t.Run("unsupported version returns an error", func(t *testing.T) {
		path := writeDashboardFile(t, `{"apiVersion":"dashboard.grafana.app/v9","spec":{}}`)
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported home dashboard apiVersion")
		// Underlying error from conversion.NewDashboardObject.
		require.Contains(t, err.Error(), "invalid version")
	})

	t.Run("wrong group returns an error", func(t *testing.T) {
		path := writeDashboardFile(t, `{"apiVersion":"wrong.group/v1","spec":{}}`)
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported home dashboard apiVersion")
		require.Contains(t, err.Error(), "expected group")
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

	t.Run("non-string apiVersion fails header parsing", func(t *testing.T) {
		path := writeDashboardFile(t, `{"apiVersion": 123}`)
		_, err := readDashboard(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "parse home dashboard")
	})
}

func TestDefaultHomeDashboard(t *testing.T) {
	// The embedded home.json has no apiVersion, so it must decode as a v0 Dashboard
	// whose entire payload becomes the spec.
	obj, err := defaultHomeDashboard()
	require.NoError(t, err)
	require.NotNil(t, obj)

	dash, ok := obj.(*dashv0.Dashboard)
	require.True(t, ok, "default home dashboard should be a v0 Dashboard")
	require.Equal(t, "Home", dash.Spec.Object["title"])

	// Sanity check the embedded file still contains the structural pieces the
	// frontend expects so a bad edit to home.json fails this test loudly.
	require.Contains(t, dash.Spec.Object, "panels")
	panels, ok := dash.Spec.Object["panels"].([]any)
	require.True(t, ok, "panels should decode as a JSON array")
	require.NotEmpty(t, panels)
}

func TestHasCustomHome(t *testing.T) {
	t.Run("returns true when DefaultHomeDashboardPath is set", func(t *testing.T) {
		// An explicit override is always treated as custom — even if the file
		// is missing — because the operator's intent is clear.
		cfg := &setting.Cfg{DefaultHomeDashboardPath: filepath.Join(t.TempDir(), "missing.json")}
		require.True(t, HasCustomHome(cfg))
	})

	t.Run("returns false when the static home.json is missing", func(t *testing.T) {
		cfg := &setting.Cfg{StaticRootPath: t.TempDir()}
		require.False(t, HasCustomHome(cfg))
	})

	t.Run("returns false when the static home.json matches the embedded default", func(t *testing.T) {
		root := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(root, "dashboards"), 0750))
		require.NoError(t, os.WriteFile(
			filepath.Join(root, "dashboards/home.json"),
			defaultHomeDashboardJSON,
			0o600,
		))

		cfg := &setting.Cfg{StaticRootPath: root}
		require.False(t, HasCustomHome(cfg))
	})

	t.Run("returns true when the static home.json differs from the embedded default", func(t *testing.T) {
		root := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(root, "dashboards"), 0750))
		require.NoError(t, os.WriteFile(
			filepath.Join(root, "dashboards/home.json"),
			[]byte(`{"title":"custom"}`),
			0o600,
		))

		cfg := &setting.Cfg{StaticRootPath: root}
		require.True(t, HasCustomHome(cfg))
	})

	t.Run("explicit path takes precedence over StaticRootPath comparison", func(t *testing.T) {
		// Even when the static file matches the embedded default, an explicit
		// override flips the answer to true.
		root := t.TempDir()
		require.NoError(t, os.MkdirAll(filepath.Join(root, "dashboards"), 0750))
		require.NoError(t, os.WriteFile(
			filepath.Join(root, "dashboards/home.json"),
			defaultHomeDashboardJSON,
			0o600,
		))

		cfg := &setting.Cfg{
			StaticRootPath:           root,
			DefaultHomeDashboardPath: filepath.Join(t.TempDir(), "override.json"),
		}
		require.True(t, HasCustomHome(cfg))
	})
}
