package dashboard

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

func TestNewHomeDashboardSupport_EmptyPath(t *testing.T) {
	h := newHomeDashboardSupport("")
	assert.Nil(t, h)
}

func TestNewHomeDashboardSupport_NonEmptyPath(t *testing.T) {
	h := newHomeDashboardSupport("/some/path.json")
	require.NotNil(t, h)
	assert.Equal(t, "/some/path.json", h.fpath)
	assert.NotNil(t, h.versions)
}

func TestHomeDashboard_Load(t *testing.T) {
	fixture := `{"title":"Test Home","panels":[],"schemaVersion":30}`
	dir := t.TempDir()
	fpath := filepath.Join(dir, "home.json")
	require.NoError(t, os.WriteFile(fpath, []byte(fixture), 0644))

	h := newHomeDashboardSupport(fpath)
	require.NotNil(t, h)

	require.NoError(t, h.load())
	require.NotNil(t, h.source)

	dash, ok := h.source.(*dashv0.Dashboard)
	require.True(t, ok)
	assert.Equal(t, HOME_DASHBOARD_NAME, dash.Name)
	assert.Equal(t, "Test Home", dash.Spec.Object["title"])
	assert.Equal(t, float64(30), dash.Spec.Object["schemaVersion"])
}

func TestHomeDashboard_Load_MissingFile(t *testing.T) {
	h := newHomeDashboardSupport("/nonexistent/path.json")
	require.NotNil(t, h)

	err := h.load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "reading home dashboard")
}

func TestHomeDashboard_Load_InvalidJSON(t *testing.T) {
	dir := t.TempDir()
	fpath := filepath.Join(dir, "bad.json")
	require.NoError(t, os.WriteFile(fpath, []byte("{not json"), 0644))

	h := newHomeDashboardSupport(fpath)
	require.NotNil(t, h)

	err := h.load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parsing home dashboard JSON")
}

func TestHomeDashboard_Get_V0(t *testing.T) {
	fixture := `{"title":"Home","panels":[]}`
	dir := t.TempDir()
	fpath := filepath.Join(dir, "home.json")
	require.NoError(t, os.WriteFile(fpath, []byte(fixture), 0644))

	h := newHomeDashboardSupport(fpath)
	require.NotNil(t, h)

	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	h.scheme = scheme

	obj, err := h.Get(dashv0.VERSION)
	require.NoError(t, err)
	require.NotNil(t, obj)

	dash, ok := obj.(*dashv0.Dashboard)
	require.True(t, ok)
	assert.Equal(t, "Home", dash.Spec.Object["title"])
}

func TestHomeDashboard_Get_CachesConversion(t *testing.T) {
	fixture := `{"title":"Cached"}`
	dir := t.TempDir()
	fpath := filepath.Join(dir, "home.json")
	require.NoError(t, os.WriteFile(fpath, []byte(fixture), 0644))

	h := newHomeDashboardSupport(fpath)
	require.NotNil(t, h)

	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	h.scheme = scheme

	obj1, err := h.Get(dashv0.VERSION)
	require.NoError(t, err)

	obj2, err := h.Get(dashv0.VERSION)
	require.NoError(t, err)

	// Same cached getter returns the same object.
	assert.Equal(t, obj1, obj2)
}

func TestHomeDashboard_Get_NoScheme(t *testing.T) {
	h := newHomeDashboardSupport("/irrelevant")
	require.NotNil(t, h)

	_, err := h.Get(dashv0.VERSION)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "scheme was not registered")
}

func TestHomeDashboard_Load_ClearsCache(t *testing.T) {
	fixture := `{"title":"v1"}`
	dir := t.TempDir()
	fpath := filepath.Join(dir, "home.json")
	require.NoError(t, os.WriteFile(fpath, []byte(fixture), 0644))

	h := newHomeDashboardSupport(fpath)
	require.NotNil(t, h)

	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	h.scheme = scheme

	// Load and populate cache.
	_, err := h.Get(dashv0.VERSION)
	require.NoError(t, err)
	assert.Len(t, h.versions, 1)

	// Overwrite file and reload.
	require.NoError(t, os.WriteFile(fpath, []byte(`{"title":"v2"}`), 0644))

	h.versionsMu.Lock()
	require.NoError(t, h.load())
	h.versionsMu.Unlock()

	assert.Len(t, h.versions, 0)

	obj, err := h.Get(dashv0.VERSION)
	require.NoError(t, err)
	dash := obj.(*dashv0.Dashboard)
	assert.Equal(t, "v2", dash.Spec.Object["title"])
}
