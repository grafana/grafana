package server

import (
	"io/ioutil"
	"net"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func createGrafDir(t *testing.T) (string, string) {
	t.Helper()

	tmpDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		os.RemoveAll(tmpDir)
	})

	rootDir := filepath.Join("..", "..")

	cfgDir := filepath.Join(tmpDir, "conf")
	err = os.MkdirAll(cfgDir, 0755)
	require.NoError(t, err)
	dataDir := filepath.Join(tmpDir, "data")
	logsDir := filepath.Join(tmpDir, "logs")
	pluginsDir := filepath.Join(tmpDir, "plugins")
	publicDir := filepath.Join(tmpDir, "public")
	err = os.MkdirAll(publicDir, 0755)
	require.NoError(t, err)
	emailsDir := filepath.Join(publicDir, "emails")
	err = fs.CopyRecursive(filepath.Join(rootDir, "public", "emails"), emailsDir)
	require.NoError(t, err)
	provDir := filepath.Join(cfgDir, "provisioning")
	provDSDir := filepath.Join(provDir, "datasources")
	err = os.MkdirAll(provDSDir, 0755)
	require.NoError(t, err)
	provNotifiersDir := filepath.Join(provDir, "notifiers")
	err = os.MkdirAll(provNotifiersDir, 0755)
	require.NoError(t, err)
	provPluginsDir := filepath.Join(provDir, "plugins")
	err = os.MkdirAll(provPluginsDir, 0755)
	require.NoError(t, err)

	cfg := ini.Empty()
	dfltSect := cfg.Section("")
	_, err = dfltSect.NewKey("app_mode", "development")
	require.NoError(t, err)

	pathsSect, err := cfg.NewSection("paths")
	require.NoError(t, err)
	_, err = pathsSect.NewKey("data", dataDir)
	require.NoError(t, err)
	_, err = pathsSect.NewKey("logs", logsDir)
	require.NoError(t, err)
	_, err = pathsSect.NewKey("plugins", pluginsDir)
	require.NoError(t, err)

	serverSect, err := cfg.NewSection("server")
	require.NoError(t, err)
	_, err = serverSect.NewKey("port", "0")
	require.NoError(t, err)

	cfgPath := filepath.Join(cfgDir, "test.ini")
	err = cfg.SaveTo(cfgPath)
	require.NoError(t, err)

	err = fs.CopyFile(filepath.Join(rootDir, "conf", "defaults.ini"), filepath.Join(cfgDir, "defaults.ini"))
	require.NoError(t, err)

	return tmpDir, cfgPath
}

func TestQueryMetrics(t *testing.T) {
	tmpDir, cfgPath := createGrafDir(t)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	_, err = New(Config{
		ConfigFile: cfgPath,
		HomePath:   tmpDir,
		Listener:   listener,
	})
	require.NoError(t, err)

	// TODO: Run Grafana server in goroutine, listening on random port

	// TODO: Make POST request to /api/ds/query
	// TODO: Verify results
}
