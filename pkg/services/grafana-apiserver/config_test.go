package grafanaapiserver

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNewConfig(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Env = setting.Prod
	cfg.DataPath = "/tmp/grafana"
	cfg.HTTPAddr = "10.0.0.1"
	cfg.HTTPPort = "4000"
	cfg.AppURL = "http://test:4000"

	section := cfg.Raw.Section("grafana-apiserver")
	section.Key("log_level").SetValue("5")
	section.Key("etcd_servers").SetValue("http://localhost:2379")

	actual := newConfig(cfg, featuremgmt.WithFeatures())

	expected := &config{
		enabled:     true,
		devMode:     false,
		storageType: StorageTypeLegacy,
		etcdServers: []string{"http://localhost:2379"},
		apiURL:      "http://test:4000",
		ip:          net.ParseIP("10.0.0.1"),
		port:        4000,
		host:        "10.0.0.1:4000",
		dataPath:    "/tmp/grafana/grafana-apiserver",
		logLevel:    5,
	}
	require.Equal(t, expected, actual)
}
