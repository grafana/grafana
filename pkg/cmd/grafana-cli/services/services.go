package services

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

var (
	IoHelper         models.IoUtil = IoUtilImp{}
	HttpClient       http.Client
	GrafanaVersion   string
	ErrNotFoundError = errors.New("404 not found error")
	Logger           *logger.CLILogger
)

type BadRequestError struct {
	Message string
	Status  string
}

func (e *BadRequestError) Error() string {
	if len(e.Message) > 0 {
		return fmt.Sprintf("%s: %s", e.Status, e.Message)
	}
	return e.Status
}

func Init(version string, skipTLSVerify bool, debugMode bool) {
	GrafanaVersion = version
	HttpClient = makeHttpClient(skipTLSVerify, 10*time.Second)
	Logger = logger.New(debugMode)
}

func makeHttpClient(skipTLSVerify bool, timeout time.Duration) http.Client {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: skipTLSVerify,
		},
	}

	return http.Client{
		Timeout:   timeout,
		Transport: tr,
	}
}

func GetLocalPlugin(pluginDir, pluginID string) (plugins.FoundPlugin, error) {
	pluginPath := filepath.Join(pluginDir, pluginID)

	ps := GetLocalPlugins(pluginPath)
	if len(ps) == 0 {
		return plugins.FoundPlugin{}, errors.New("could not find plugin " + pluginID + " in " + pluginDir)
	}

	return ps[0].Primary, nil
}

func GetLocalPlugins(pluginDir string) []*plugins.FoundBundle {
	f := finder.NewLocalFinder(&config.Cfg{})

	res, err := f.Find(context.Background(), sources.NewLocalSource(plugins.ClassExternal, []string{pluginDir}))
	if err != nil {
		logger.Error("Could not get local plugins", err)
		return make([]*plugins.FoundBundle, 0)
	}

	return res
}
