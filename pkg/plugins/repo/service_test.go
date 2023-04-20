package repo

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

const (
	dummyPluginJSON = `{ "id": "grafana-test-datasource" }`
)

func TestGetPluginArchive(t *testing.T) {
	tcs := []struct {
		name string
		sha  string
		err  error
	}{
		{
			name: "Happy path",
			sha:  "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1",
		},
		{
			name: "Incorrect SHA returns error",
			sha:  "1a2b3c",
			err:  errors.New("failed to download plugin archive: expected SHA256 checksum does not match the downloaded archive - please contact security@grafana.com"),
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

			srv := mockPluginRepoAPI(t,
				srvData{
					pluginID:       pluginID,
					version:        version,
					opSys:          opSys,
					arch:           arch,
					grafanaVersion: grafanaVersion,
					sha:            tc.sha,
					archive:        d,
				},
			)

			m := New(Cfg{BaseURL: srv.URL}, &fakeLogger{})
			archive, err := m.GetPluginArchive(context.Background(), pluginID, version, CompatOpts{
				GrafanaVersion: grafanaVersion,
				OS:             opSys,
				Arch:           arch,
			})
			if tc.err != nil {
				require.EqualError(t, err, tc.err.Error())
				return
			}
			require.NoError(t, err)
			verifyArchive(t, archive)
		})
	}

	t.Run("Wildcard Grafana version without specific requested plugin version", func(t *testing.T) {
		const (
			pluginID       = "grafana-test-datasource"
			version        = ""
			opSys          = "custom-os"
			arch           = "amd64"
			grafanaVersion = "*"
			sha            = "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1"
		)

		srv := mockLatestVersionAPI(t,
			srvData{
				pluginID:       pluginID,
				opSys:          opSys,
				arch:           arch,
				sha:            sha,
				grafanaVersion: grafanaVersion,
				version:        "1.4.3", // mock latest version
				archive:        d,
			},
		)

		m := New(Cfg{BaseURL: srv.URL}, &fakeLogger{})
		archive, err := m.GetPluginArchive(context.Background(), pluginID, version, CompatOpts{
			GrafanaVersion: grafanaVersion,
			OS:             opSys,
			Arch:           arch,
		})

		require.NoError(t, err)
		verifyArchive(t, archive)
	})

	t.Run("Wildcard Grafana version with specific requested plugin version", func(t *testing.T) {
		const (
			pluginID       = "grafana-test-datasource"
			version        = "1.3.0"
			opSys          = "windows"
			arch           = "amd64"
			grafanaVersion = "*"
			sha            = "69f698961b6ea651211a187874434821c4727cc22de022e3a7059116d21c75b1"
		)

		srv := mockSinglePluginVersionAPI(t,
			srvData{
				pluginID:       pluginID,
				version:        version,
				opSys:          opSys,
				arch:           arch,
				sha:            sha,
				grafanaVersion: grafanaVersion,
				archive:        d,
			},
		)

		m := New(Cfg{BaseURL: srv.URL}, &fakeLogger{})
		archive, err := m.GetPluginArchive(context.Background(), pluginID, version, CompatOpts{
			GrafanaVersion: grafanaVersion,
			OS:             opSys,
			Arch:           arch,
		})

		require.NoError(t, err)
		require.NotNil(t, archive)
		verifyArchive(t, archive)
	})
}

func TestSelectVersion(t *testing.T) {
	i := &Manager{log: &fakeLogger{}}

	t.Run("Should return error when requested version does not exist", func(t *testing.T) {
		_, err := i.selectSystemCompatibleVersion(createPluginVersions(versionArg{version: "version"}), "test", "1.1.1", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when no version supports current arch", func(t *testing.T) {
		_, err := i.selectSystemCompatibleVersion(createPluginVersions(versionArg{version: "version", arch: []string{"non-existent"}}), "test", "", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return error when requested version does not support current arch", func(t *testing.T) {
		_, err := i.selectSystemCompatibleVersion(createPluginVersions(
			versionArg{version: "2.0.0"},
			versionArg{version: "1.1.1", arch: []string{"non-existent"}},
		), "test", "1.1.1", CompatOpts{})
		require.Error(t, err)
	})

	t.Run("Should return latest available for arch when no version specified", func(t *testing.T) {
		ver, err := i.selectSystemCompatibleVersion(createPluginVersions(
			versionArg{version: "2.0.0", arch: []string{"non-existent"}},
			versionArg{version: "1.0.0"},
		), "test", "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})

	t.Run("Should return latest version when no version specified", func(t *testing.T) {
		ver, err := i.selectSystemCompatibleVersion(createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "2.0.0", ver.Version)
	})

	t.Run("Should return requested version", func(t *testing.T) {
		ver, err := i.selectSystemCompatibleVersion(createPluginVersions(versionArg{version: "2.0.0"}, versionArg{version: "1.0.0"}), "test", "1.0.0", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "1.0.0", ver.Version)
	})
}

func verifyArchive(t *testing.T, archive *PluginArchive) {
	t.Helper()
	require.NotNil(t, archive)

	res, err := archive.File.Open("plugin.json")
	require.NoError(t, err)
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(res)
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
}

func mockPluginRepoAPI(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	// mock plugin version data
	mux.HandleFunc(fmt.Sprintf("/repo/%s", data.pluginID), func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, data.grafanaVersion, r.Header.Get("grafana-version"))
		require.Equal(t, data.opSys, r.Header.Get("grafana-os"))
		require.Equal(t, data.arch, r.Header.Get("grafana-arch"))
		require.NotNil(t, fmt.Sprintf("grafana %s", data.grafanaVersion), r.Header.Get("User-Agent"))

		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"versions": [{
						"version": "%s",
						"arch": {
							"%s-%s": {
								"sha256": "%s"
							}
						}
					}]
				}
			`, data.version, data.opSys, data.arch, data.sha),
		))
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

func mockLatestVersionAPI(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	// mock plugin data
	mux.HandleFunc(fmt.Sprintf("/%s", data.pluginID), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		osArch := fmt.Sprintf("%s-%s", data.opSys, data.arch)
		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"status": "active",
					"version": "%s",
					"versionStatus": "active",
					"packages": {
						"linux-amd64": {
							"sha256": "08fa6bf89385515b0dab3b0e04dbd68e68486d47891f32a214ac6b55e1ac1097",
							"packageName": "linux-amd64"
						},
						"%s": {
							"sha256": "%s",
							"packageName": "%s"
						}
					}
				}
			`, data.version, osArch, data.sha, osArch),
		))
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

func mockSinglePluginVersionAPI(t *testing.T, data srvData) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	// mock plugin version data
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")

		osArch := fmt.Sprintf("%s-%s", data.opSys, data.arch)
		_, _ = w.Write([]byte(fmt.Sprintf(`
				{
					"packages": {
						"%s": {
							"sha256": "%s",
							"packageName": "%s"
						},
						"linux-arm": {
							"sha256": "c4ce6f36d769482d5c5e777efa4f33752ceee51f9ae3b4fe8c249ee94bfaca87",
							"packageName": "linux-arm"
						}
					}
				}
			`, osArch, data.sha, osArch),
		))
	})

	// mock plugin archive
	mux.HandleFunc(fmt.Sprintf("/%s/version/%s/download", data.pluginID, data.version), func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(data.archive)
	})

	return httptest.NewServer(mux)
}

type versionArg struct {
	version string
	arch    []string
}

func createPluginVersions(versions ...versionArg) []Version {
	var vs []Version

	for _, version := range versions {
		ver := Version{
			Version: version.version,
		}
		if version.arch != nil {
			ver.Arch = map[string]ArchMeta{}
			for _, arch := range version.arch {
				ver.Arch[arch] = ArchMeta{
					SHA256: fmt.Sprintf("sha256_%s", arch),
				}
			}
		}
		vs = append(vs, ver)
	}

	return vs
}

type fakeLogger struct{}

func (f *fakeLogger) Successf(_ string, _ ...interface{}) {}
func (f *fakeLogger) Failuref(_ string, _ ...interface{}) {}
func (f *fakeLogger) Info(_ ...interface{})               {}
func (f *fakeLogger) Infof(_ string, _ ...interface{})    {}
func (f *fakeLogger) Debug(_ ...interface{})              {}
func (f *fakeLogger) Debugf(_ string, _ ...interface{})   {}
func (f *fakeLogger) Warn(_ ...interface{})               {}
func (f *fakeLogger) Warnf(_ string, _ ...interface{})    {}
func (f *fakeLogger) Error(_ ...interface{})              {}
func (f *fakeLogger) Errorf(_ string, _ ...interface{})   {}
