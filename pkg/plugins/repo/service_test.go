package repo

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/log"
)

const (
	dummyPluginJSON = `{ "id": "grafana-test-datasource" }`
)

func TestGetPluginArchive(t *testing.T) {
	tcs := []struct {
		name     string
		sha      string
		apiOpSys string
		apiArch  string
		apiUrl   string
		err      error
	}{
		{
			name: "Happy path",
			sha:  "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1",
		},
		{
			name: "Incorrect SHA returns error",
			sha:  "1a2b3c",
			err:  ErrChecksumMismatchBase,
		},
		{
			name:     "Core plugin",
			sha:      "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1",
			apiOpSys: "any",
			apiUrl:   "https://github.com/grafana/grafana/tree/main/public/app/plugins/test",
			err:      ErrCorePluginBase,
		},
		{
			name:   "Decoupled core plugin",
			sha:    "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1",
			apiUrl: "https://github.com/grafana/grafana/tree/main/public/app/plugins/test",
		},
	}

	pluginZip := createPluginArchive(t)
	d, err := os.ReadFile(pluginZip.Name())
	require.NoError(t, err)

	t.Cleanup(func() {
		err = pluginZip.Close()
		require.NoError(t, err)
		err = os.RemoveAll(pluginZip.Name())
		require.NoError(t, err)
	})

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			const (
				pluginID       = "grafana-test-datasource"
				version        = "1.0.2"
				opSys          = "darwin"
				arch           = "amd64"
				grafanaVersion = "10.0.0"
			)

			srvd := srvData{
				pluginID:       pluginID,
				version:        version,
				opSys:          tc.apiOpSys,
				arch:           tc.apiArch,
				url:            tc.apiUrl,
				grafanaVersion: grafanaVersion,
				sha:            tc.sha,
				archive:        d,
			}
			if srvd.opSys == "" {
				srvd.opSys = opSys
			}
			if srvd.arch == "" && srvd.opSys != "any" {
				srvd.arch = arch
			}
			srv := mockPluginVersionsAPI(t, srvd)
			t.Cleanup(srv.Close)

			m := NewManager(ManagerCfg{
				SkipTLSVerify: false,
				BaseURL:       srv.URL,
				Logger:        log.NewTestPrettyLogger(),
			})
			co := NewCompatOpts(grafanaVersion, opSys, arch)
			archive, err := m.GetPluginArchive(context.Background(), pluginID, version, co)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
				return
			}
			require.NoError(t, err)
			verifyArchive(t, archive)
		})
	}
}

func TestPluginVersionWithExplicitVersion(t *testing.T) {
	const (
		pluginID       = "grafana-test-datasource"
		grafanaVersion = "10.0.0"
		opSys          = "darwin"
		arch           = "amd64"
	)
	compatOpts := NewCompatOpts(grafanaVersion, opSys, arch)

	type hits struct {
		single int
		list   int
	}

	// newManager serves /versions/1.0.0 with the given status code and body,
	// and /versions with the given listing, counting requests to each.
	newManager := func(t *testing.T, singleStatus int, singleBody, listBody string, count *hits) *Manager {
		t.Helper()
		mux := http.NewServeMux()
		mux.HandleFunc(fmt.Sprintf("/%s/versions/1.0.0", pluginID), func(w http.ResponseWriter, r *http.Request) {
			count.single++
			require.Equal(t, grafanaVersion, r.Header.Get("grafana-version"))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(singleStatus)
			_, _ = w.Write([]byte(singleBody))
		})
		mux.HandleFunc(fmt.Sprintf("/%s/versions", pluginID), func(w http.ResponseWriter, r *http.Request) {
			count.list++
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(listBody))
		})
		srv := httptest.NewServer(mux)
		t.Cleanup(srv.Close)
		return NewManager(ManagerCfg{
			SkipTLSVerify: false,
			BaseURL:       srv.URL,
			Logger:        log.NewTestPrettyLogger(),
		})
	}

	activeSingle := `{"version": "1.0.0", "status": "active", "packages": {"darwin-amd64": {"sha256": "abc"}}, "url": "https://github.com/grafana/test", "isCompatible": true}`
	listWithV100 := `{"items": [{"version": "1.0.0", "packages": {"darwin-amd64": {"sha256": "abc"}}, "url": "https://github.com/grafana/test", "isCompatible": true}]}`
	listWithoutV100 := `{"items": [{"version": "2.0.0", "packages": {"darwin-amd64": {"sha256": "def"}}, "isCompatible": true}]}`

	t.Run("active version is fetched directly without the listing", func(t *testing.T) {
		count := &hits{}
		m := newManager(t, http.StatusOK, activeSingle, listWithV100, count)

		v, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.NoError(t, err)
		require.Equal(t, "1.0.0", v.Version)
		require.Equal(t, "abc", v.Checksum)
		require.Equal(t, hits{single: 1, list: 0}, *count)
	})

	t.Run("version prefix is normalized before the direct fetch", func(t *testing.T) {
		count := &hits{}
		m := newManager(t, http.StatusOK, activeSingle, listWithV100, count)

		v, err := m.PluginVersion(context.Background(), pluginID, "v1.0.0", compatOpts)
		require.NoError(t, err)
		require.Equal(t, "1.0.0", v.Version)
		require.Equal(t, hits{single: 1, list: 0}, *count)
	})

	t.Run("no explicit version uses the listing only", func(t *testing.T) {
		count := &hits{}
		m := newManager(t, http.StatusOK, activeSingle, listWithV100, count)

		v, err := m.PluginVersion(context.Background(), pluginID, "", compatOpts)
		require.NoError(t, err)
		require.Equal(t, "1.0.0", v.Version)
		require.Equal(t, hits{single: 0, list: 1}, *count)
	})

	t.Run("missing version falls back and keeps the not found error", func(t *testing.T) {
		count := &hits{}
		m := newManager(t, http.StatusNotFound, `{"code": "NotFound"}`, listWithoutV100, count)

		_, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.ErrorIs(t, err, ErrVersionNotFoundBase)
		require.Equal(t, hits{single: 1, list: 1}, *count)
	})

	t.Run("non-active version stays uninstallable", func(t *testing.T) {
		// the listing only contains active versions, so a pending version is
		// not found today; the direct fetch returns it and must reject it
		pendingSingle := `{"version": "1.0.0", "status": "pending", "packages": {"darwin-amd64": {"sha256": "abc"}}, "isCompatible": true}`
		count := &hits{}
		m := newManager(t, http.StatusOK, pendingSingle, listWithoutV100, count)

		_, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.ErrorIs(t, err, ErrVersionNotFoundBase)
		require.Equal(t, hits{single: 1, list: 1}, *count)
	})

	t.Run("incompatible version keeps the not compatible error", func(t *testing.T) {
		incompatibleSingle := `{"version": "1.0.0", "status": "active", "packages": {"darwin-amd64": {"sha256": "abc"}}, "isCompatible": false}`
		listV100Incompatible := `{"items": [
			{"version": "2.0.0", "packages": {"darwin-amd64": {"sha256": "def"}}, "isCompatible": true},
			{"version": "1.0.0", "packages": {"darwin-amd64": {"sha256": "abc"}}, "isCompatible": false}
		]}`
		count := &hits{}
		m := newManager(t, http.StatusOK, incompatibleSingle, listV100Incompatible, count)

		_, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.ErrorIs(t, err, ErrVersionNotCompatibleBase)
		require.Equal(t, hits{single: 1, list: 1}, *count)
	})

	t.Run("unsupported arch keeps the unsupported error", func(t *testing.T) {
		linuxOnlySingle := `{"version": "1.0.0", "status": "active", "packages": {"linux-amd64": {"sha256": "abc"}}, "isCompatible": true}`
		listV100LinuxOnly := `{"items": [
			{"version": "2.0.0", "packages": {"darwin-amd64": {"sha256": "def"}}, "isCompatible": true},
			{"version": "1.0.0", "packages": {"linux-amd64": {"sha256": "abc"}}, "isCompatible": true}
		]}`
		count := &hits{}
		m := newManager(t, http.StatusOK, linuxOnlySingle, listV100LinuxOnly, count)

		_, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.ErrorIs(t, err, ErrVersionUnsupportedBase)
		require.Equal(t, hits{single: 1, list: 1}, *count)
	})

	t.Run("direct fetch failure falls back to the listing", func(t *testing.T) {
		count := &hits{}
		m := newManager(t, http.StatusInternalServerError, `oops`, listWithV100, count)

		v, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.NoError(t, err)
		require.Equal(t, "1.0.0", v.Version)
		require.Equal(t, "abc", v.Checksum)
		require.Equal(t, hits{single: 1, list: 1}, *count)
	})

	t.Run("core plugin is rejected on the direct fetch", func(t *testing.T) {
		coreSingle := `{"version": "1.0.0", "status": "active", "packages": {"any": {"sha256": "abc"}}, "url": "https://github.com/grafana/grafana/tree/main/public/app/plugins/test", "isCompatible": true}`
		count := &hits{}
		m := newManager(t, http.StatusOK, coreSingle, listWithV100, count)

		_, err := m.PluginVersion(context.Background(), pluginID, "1.0.0", compatOpts)
		require.ErrorIs(t, err, ErrCorePluginBase)
		require.Equal(t, hits{single: 1, list: 0}, *count)
	})
}

func TestPluginIndex(t *testing.T) {
	const (
		pluginID = "grafana-test-datasource"
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "12.0.0", r.Header.Get("grafana-version"))
		require.Equal(t, "grafana 12.0.0", r.Header.Get("User-Agent"))
		require.Equal(t, "includeDeprecated=true&slugIn=grafana-test-datasource", r.URL.RawQuery)
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"items": [{ "id": 1, "slug": "%s", "status": "active" }]}`, pluginID)
	}))
	t.Cleanup(srv.Close)

	m := NewManager(ManagerCfg{
		SkipTLSVerify: false,
		BaseURL:       srv.URL,
		Logger:        log.NewTestPrettyLogger(),
	})
	pi, err := m.GetPluginsInfo(context.Background(), GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           []string{pluginID},
	}, CompatOpts{
		grafanaVersion: "12.0.0",
		system: SystemCompatOpts{
			os:   "darwin",
			arch: "amd64",
		},
	})
	require.NoError(t, err)
	require.Len(t, pi, 1)
	require.Equal(t, 1, pi[0].ID)
	require.Equal(t, pluginID, pi[0].Slug)
	require.Equal(t, "active", pi[0].Status)
}

func verifyArchive(t *testing.T, archive *PluginArchive) {
	t.Helper()
	require.NotNil(t, archive)

	pJSON, err := archive.File.Open("plugin.json")
	require.NoError(t, err)
	defer func() { require.NoError(t, pJSON.Close()) }()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(pJSON)
	require.NoError(t, err)
	require.Equal(t, dummyPluginJSON, buf.String())
}

func createPluginArchive(t *testing.T) *os.File {
	t.Helper()

	pluginZip, err := os.CreateTemp(".", "test-plugin.zip")
	require.NoError(t, err)

	zipWriter := zip.NewWriter(pluginZip)
	pJSON, err := zipWriter.Create("plugin.json")
	require.NoError(t, err)
	_, err = pJSON.Write([]byte(dummyPluginJSON))
	require.NoError(t, err)
	err = zipWriter.Close()
	require.NoError(t, err)

	return pluginZip
}

type srvData struct {
	pluginID       string
	version        string
	opSys          string
	arch           string
	sha            string
	grafanaVersion string
	archive        []byte
	url            string
}

func mockPluginVersionsAPI(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	// mock plugin version data
	mux.HandleFunc(fmt.Sprintf("/%s/versions", data.pluginID), func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, data.grafanaVersion, r.Header.Get("grafana-version"))
		require.NotNil(t, fmt.Sprintf("grafana %s", data.grafanaVersion), r.Header.Get("User-Agent"))

		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		platform := data.opSys
		if data.arch != "" {
			platform += "-" + data.arch
		}
		_, _ = fmt.Fprintf(w, `
				{
					"items": [{
						"version": "%s",
						"packages": {
							"%s": {
								"sha256": "%s"
							}
						},
						"url": "%s",
						"isCompatible": true
					}]
				}
			`, data.version, platform, data.sha, data.url)
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/versions/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

type versionArg struct {
	version      string
	arch         []string
	isCompatible *bool
}

func createPluginVersions(versions ...versionArg) []Version {
	vs := make([]Version, len(versions))
	for i, version := range versions {
		ver := Version{
			Version:      version.version,
			IsCompatible: version.isCompatible,
		}
		if version.arch != nil {
			ver.Arch = map[string]ArchMeta{}
			for _, arch := range version.arch {
				ver.Arch[arch] = ArchMeta{
					SHA256: fmt.Sprintf("sha256_%s", arch),
				}
			}
		}

		vs[i] = ver
	}

	return vs
}
