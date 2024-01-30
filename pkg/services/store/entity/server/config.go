package server

import (
	"fmt"
	"net"
	"strconv"

	// "github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	enabled bool
	devMode bool

	ip     net.IP
	port   int
	host   string
	apiURL string

	logLevel int
}

func newConfig(cfg *setting.Cfg) *config {
	defaultLogLevel := 0
	// TODO
	ip := net.ParseIP(cfg.HTTPAddr)
	apiURL := cfg.AppURL
	port, err := strconv.Atoi(cfg.HTTPPort)
	if err != nil {
		port = 3001
	}

	if cfg.Env == setting.Dev {
		defaultLogLevel = 10
		port = 3001
		ip = net.ParseIP("127.0.0.1")
		apiURL = fmt.Sprintf("https://%s:%d", ip, port)
	}

	host := fmt.Sprintf("%s:%d", ip, port)

	return &config{
		enabled:  true,
		devMode:  cfg.Env == setting.Dev,
		ip:       ip,
		port:     port,
		host:     host,
		logLevel: cfg.SectionWithEnvOverrides("storage-server").Key("log_level").MustInt(defaultLogLevel),
		apiURL:   apiURL,
	}
}
