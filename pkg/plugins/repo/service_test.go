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

func TestPluginInfo(t *testing.T) {
	const (
		pluginID = "grafana-test-datasource"
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, fmt.Sprintf("/%s", pluginID), r.URL.Path)
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{ "id": 1, "slug": "%s", "status": "active" }`, pluginID)
	}))
	t.Cleanup(srv.Close)

	m := NewManager(ManagerCfg{
		SkipTLSVerify: false,
		BaseURL:       srv.URL,
		Logger:        log.NewTestPrettyLogger(),
	})
	pi, err := m.PluginInfo(context.Background(), pluginID)
	require.NoError(t, err)
	require.Equal(t, 1, pi.ID)
	require.Equal(t, pluginID, pi.Slug)
	require.Equal(t, "active", pi.Status)
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
