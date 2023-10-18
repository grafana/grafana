package grafanaapiserver

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewConfig(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Env = setting.Dev
	cfg.DataPath = "/tmp/grafana"
	cfg.HTTPAddr = "test"
	cfg.HTTPPort = "4000"
	cfg.IsFeatureToggleEnabled = func(_ string) bool { return true }
	cfg.AppURL = "http://test:4000"

	section := cfg.Raw.Section("grafana-apiserver")
	section.Key("log_level").SetValue("5")
	section.Key("etcd_servers").SetValue("http://localhost:2379")

	actual := newConfig(cfg)

	expected := &config{
		enabled:     true,
		devMode:     true,
		etcdServers: []string{"http://localhost:2379"},
		appURL:      "http://test:4000",
		host:        "test:4000",
		dataPath:    "/tmp/grafana/grafana-apiserver",
		logLevel:    5,
	}
	require.Equal(t, expected, actual)
}
