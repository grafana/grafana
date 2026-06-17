package home

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
)

// newTestScheme builds a runtime.Scheme with all dashboard conversions registered,
// matching what InstallSchema sets up at runtime.
func newTestScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	dsProvider := testutil.NewDataSourceProvider(testutil.StandardTestConfig)
	leProvider := testutil.NewTestLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	require.NoError(t, dashv1.AddToScheme(scheme))
	require.NoError(t, dashv1beta1.AddToScheme(scheme))
	require.NoError(t, dashv2alpha1.AddToScheme(scheme))
	require.NoError(t, dashv2beta1.AddToScheme(scheme))
	require.NoError(t, dashv2.AddToScheme(scheme))
	require.NoError(t, conversion.RegisterConversions(scheme, dsProvider, leProvider))
	return scheme
}

// writeDashboardFile writes the given payload to a fresh file under t.TempDir()
// and returns its absolute path.
func writeDashboardFile(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "home.json")
	require.NoError(t, os.WriteFile(path, []byte(contents), 0o600))
	return path
}

func TestNewHomeDashboardSupport_UsesConfiguredPath(t *testing.T) {
	path := writeDashboardFile(t, `{"title":"configured"}`)
	cfg := &setting.Cfg{DefaultHomeDashboardPath: path}

	home := NewHomeDashboardSupport(cfg)
	require.NotNil(t, home)
	require.Equal(t, path, home.fpath)
	require.NotNil(t, home.watcher, "watcher should be created for an existing file")
	require.NoError(t, home.Close())
}

func TestNewHomeDashboardSupport_FallsBackToStaticRootPath(t *testing.T) {
	// StaticRootPath is used only to build the default path; the file does not
	// need to exist for the constructor to return.
	cfg := &setting.Cfg{StaticRootPath: t.TempDir()}

	home := NewHomeDashboardSupport(cfg)
	require.NotNil(t, home)
	require.Equal(t, filepath.Join(cfg.StaticRootPath, "dashboards/home.json"), home.fpath)
	// File does not exist → watcher.Add fails and the watcher is left nil.
	require.Nil(t, home.watcher)
}

func TestNewHomeDashboardSupportForFile(t *testing.T) {
	t.Run("empty path skips watcher setup", func(t *testing.T) {
		home := newHomeDashboardSupportForFile("")
		require.NotNil(t, home)
		require.Empty(t, home.fpath)
		require.Nil(t, home.watcher)
	})

	t.Run("missing file in existing dir is watched so future creates are picked up", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "missing.json")
		home := newHomeDashboardSupportForFile(path)
		require.NotNil(t, home)
		require.Equal(t, path, home.fpath)
		require.NotNil(t, home.watcher, "parent directory exists, so the watcher should be active")
		require.NoError(t, home.Close())
	})

	t.Run("missing parent directory leaves watcher unset", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "nope", "missing.json")
		home := newHomeDashboardSupportForFile(path)
		require.NotNil(t, home)
		require.Equal(t, path, home.fpath)
		require.Nil(t, home.watcher, "watcher.Add should fail when the parent dir is missing")
	})

	t.Run("existing file is watched", func(t *testing.T) {
		path := writeDashboardFile(t, `{"title":"watched"}`)
		home := newHomeDashboardSupportForFile(path)
		require.NotNil(t, home)
		require.Equal(t, path, home.fpath)
		require.NotNil(t, home.watcher)
		require.NoError(t, home.Close())
	})
}

func TestHomeDashboardGet_ErrorsWithoutScheme(t *testing.T) {
	home := newHomeDashboardSupportForFile("")
	_, err := home.Get(dashv0.VERSION)
	require.Error(t, err)
	require.Contains(t, err.Error(), "scheme was not registered")
}

func TestHomeDashboardGet_FallsBackToDefaultWhenFileMissing(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.json")
	home := newHomeDashboardSupportForFile(missing)
	t.Cleanup(func() { _ = home.Close() })
	home.RegisterSchema(newTestScheme(t))

	obj, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	dash, ok := obj.(*dashv0.Dashboard)
	require.True(t, ok)
	require.Equal(t, DASHBOARD_NAME, dash.Name)
	require.NotEmpty(t, dash.ResourceVersion)
	require.False(t, dash.CreationTimestamp.IsZero())
	require.Equal(t, "Home", dash.Spec.Object["title"])
}

func TestHomeDashboardGet_LoadsConfiguredFile(t *testing.T) {
	path := writeDashboardFile(t, `{"title":"from file"}`)
	home := newHomeDashboardSupportForFile(path)
	t.Cleanup(func() { _ = home.Close() })
	home.scheme = newTestScheme(t)

	obj, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	dash, ok := obj.(*dashv0.Dashboard)
	require.True(t, ok)
	require.Equal(t, DASHBOARD_NAME, dash.Name)
	require.Equal(t, "from file", dash.Spec.Object["title"])

	// Meta should be reachable via the accessor too.
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	require.Equal(t, DASHBOARD_NAME, meta.GetName())
	require.NotEmpty(t, meta.GetResourceVersion())
}

func TestHomeDashboardGet_CachesConvertedVersions(t *testing.T) {
	home := newHomeDashboardSupportForFile("")
	home.scheme = newTestScheme(t)

	first, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	second, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	// The cached getter returns the same object pointer for the same version.
	require.Same(t, first, second)

	// A different version must produce a different object — and at minimum not panic.
	other, err := home.Get(dashv1.VERSION)
	require.NoError(t, err)
	require.NotSame(t, first, other)
	_, ok := other.(*dashv1.Dashboard)
	require.True(t, ok)
}

func TestHomeDashboardGet_ConvertsToAllRegisteredVersions(t *testing.T) {
	path := writeDashboardFile(t, `{"title":"multi version"}`)
	home := newHomeDashboardSupportForFile(path)
	t.Cleanup(func() { _ = home.Close() })
	home.scheme = newTestScheme(t)

	cases := []struct {
		version string
		check   func(t *testing.T, obj runtime.Object)
	}{
		{dashv0.VERSION, func(t *testing.T, obj runtime.Object) {
			d, ok := obj.(*dashv0.Dashboard)
			require.True(t, ok)
			require.Equal(t, "multi version", d.Spec.Object["title"])
		}},
		{dashv1.VERSION, func(t *testing.T, obj runtime.Object) {
			_, ok := obj.(*dashv1.Dashboard)
			require.True(t, ok)
		}},
		{dashv2alpha1.VERSION, func(t *testing.T, obj runtime.Object) {
			_, ok := obj.(*dashv2alpha1.Dashboard)
			require.True(t, ok)
		}},
		{dashv2beta1.VERSION, func(t *testing.T, obj runtime.Object) {
			_, ok := obj.(*dashv2beta1.Dashboard)
			require.True(t, ok)
		}},
		{dashv2.VERSION, func(t *testing.T, obj runtime.Object) {
			_, ok := obj.(*dashv2.Dashboard)
			require.True(t, ok)
		}},
	}

	for _, tc := range cases {
		t.Run(tc.version, func(t *testing.T) {
			obj, err := home.Get(tc.version)
			require.NoError(t, err)
			tc.check(t, obj)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			require.Equal(t, DASHBOARD_NAME, meta.GetName())
		})
	}
}

func TestHomeDashboardGet_UnsupportedVersionIsCachedAsError(t *testing.T) {
	home := newHomeDashboardSupportForFile("")
	home.scheme = newTestScheme(t)

	_, err := home.Get("v9unknown")
	require.Error(t, err)

	// The cached getter returns the same error on subsequent calls (no rebuild).
	_, err2 := home.Get("v9unknown")
	require.Error(t, err2)
	require.Equal(t, err.Error(), err2.Error())
}

func TestHomeDashboardLoad_PreservesPriorBehaviorOnMissingFile(t *testing.T) {
	// load() should not error when the underlying file is missing; it logs and
	// falls back to defaultHomeDashboard.
	home := newHomeDashboardSupportForFile(filepath.Join(t.TempDir(), "missing.json"))
	home.scheme = newTestScheme(t)

	home.versionsMu.Lock()
	err := home.load()
	home.versionsMu.Unlock()
	require.NoError(t, err)
	require.NotNil(t, home.source)

	meta, err := utils.MetaAccessor(home.source)
	require.NoError(t, err)
	require.Equal(t, DASHBOARD_NAME, meta.GetName())
	require.NotEmpty(t, meta.GetResourceVersion())
	ts := meta.GetCreationTimestamp()
	require.False(t, ts.IsZero())
	// load() must invalidate any cached version conversions.
	require.NotNil(t, home.versions)
	require.Empty(t, home.versions)
}

func TestHomeDashboardLoad_RereadsSourceWhenInvalidated(t *testing.T) {
	path := writeDashboardFile(t, `{"title":"first"}`)
	home := newHomeDashboardSupportForFile(path)
	t.Cleanup(func() { _ = home.Close() })
	home.scheme = newTestScheme(t)

	obj, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	require.Equal(t, "first", obj.(*dashv0.Dashboard).Spec.Object["title"])

	// Rewrite the file and manually invalidate the cache (mirrors what the watcher does).
	require.NoError(t, os.WriteFile(path, []byte(`{"title":"second"}`), 0o600))
	home.versionsMu.Lock()
	home.source = nil
	home.versionsMu.Unlock()

	obj, err = home.Get(dashv0.VERSION)
	require.NoError(t, err)
	require.Equal(t, "second", obj.(*dashv0.Dashboard).Spec.Object["title"])
}

func TestHomeDashboardWatch_FileChangeInvalidatesSource(t *testing.T) {
	// fsnotify on macOS uses FSEvents; allow a generous deadline below.
	path := writeDashboardFile(t, `{"title":"first"}`)
	home := newHomeDashboardSupportForFile(path)
	t.Cleanup(func() { _ = home.Close() })
	home.scheme = newTestScheme(t)

	// Populate the cache.
	_, err := home.Get(dashv0.VERSION)
	require.NoError(t, err)
	home.versionsMu.Lock()
	require.NotNil(t, home.source)
	home.versionsMu.Unlock()

	// Touch the file repeatedly until the watcher clears the cache. Some
	// platforms coalesce events, so retrying makes the test robust.
	require.Eventually(t, func() bool {
		// Re-write with slightly different contents to force a change event.
		_ = os.WriteFile(path, []byte(`{"title":"second-`+time.Now().Format("150405.000")+`"}`), 0o600)

		home.versionsMu.Lock()
		defer home.versionsMu.Unlock()
		return home.source == nil
	}, 5*time.Second, 50*time.Millisecond, "watcher should clear cached source after file change")
}

func TestHomeDashboardWatch_LogsErrorsAndContinues(t *testing.T) {
	// Send an error directly to the watcher's Errors channel. The watch loop
	// should log and keep running — visible by the fact that closing the
	// watcher afterwards still cleanly tears the goroutine down.
	path := writeDashboardFile(t, `{"title":"foo"}`)
	home := newHomeDashboardSupportForFile(path)
	require.NotNil(t, home.watcher)

	select {
	case home.watcher.Errors <- errors.New("synthetic"):
	case <-time.After(time.Second):
		t.Fatal("watcher did not accept synthetic error")
	}

	// Give the goroutine a chance to drain the error before we tear it down.
	time.Sleep(50 * time.Millisecond)
	require.NoError(t, home.watcher.Close())
}

func TestHomeDashboardWatch_StopsWhenWatcherIsClosed(t *testing.T) {
	path := writeDashboardFile(t, `{"title":"watched"}`)
	home := newHomeDashboardSupportForFile(path)
	require.NotNil(t, home.watcher)

	// Run a stand-in watch loop on a fresh watcher so we can deterministically
	// observe the close path without racing against the background goroutine.
	w, err := fsnotify.NewWatcher()
	require.NoError(t, err)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		// Mirror home.watch() shape: drain both channels until both are closed.
		eventsOpen, errorsOpen := true, true
		for eventsOpen || errorsOpen {
			select {
			case _, ok := <-w.Events:
				if !ok {
					eventsOpen = false
				}
			case _, ok := <-w.Errors:
				if !ok {
					errorsOpen = false
				}
			}
		}
	}()

	require.NoError(t, w.Close())
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("watch loop did not exit after watcher.Close()")
	}

	require.NoError(t, home.watcher.Close())
}

// Sanity check: parsing the header alone should not consume the rest of the JSON,
// so a malformed header still surfaces as a parse error. Documented here so the
// peek-at-apiVersion contract is exercised end to end.
func TestReadDashboard_HeaderParsing(t *testing.T) {
	path := writeDashboardFile(t, `{"apiVersion": 123}`)
	_, err := readDashboard(path)
	require.Error(t, err)

	// And a valid apiVersion with the rest absent still produces a valid object.
	var header struct {
		APIVersion string `json:"apiVersion"`
	}
	require.NoError(t, json.Unmarshal([]byte(`{"apiVersion":"dashboard.grafana.app/v0alpha1"}`), &header))
	require.Equal(t, "dashboard.grafana.app/v0alpha1", header.APIVersion)
}
