package intentapi

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kubectl/pkg/proxy"
)

// ApiserverProxyConfig is the config for ApiserverProxy.
type ApiserverProxyConfig struct {
	RestCfg          *rest.Config
	KeepaliveTimeout time.Duration
}

// NewApiserverProxyConfig parses and returns a new ApiserverProxyConfig.
func NewApiserverProxyConfig(cfg *setting.Cfg) (ApiserverProxyConfig, error) {
	sec := cfg.Raw.Section("intentapi.proxy")
	configPath := sec.Key("kubeconfig_path").MustString("")

	if configPath == "" {
		return ApiserverProxyConfig{}, errors.New("kubeconfig path cannot be empty when using Intent API")
	}

	configPath = filepath.Clean(configPath)

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return ApiserverProxyConfig{}, fmt.Errorf("cannot find kubeconfig file at '%s'", configPath)
	}

	config, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return ApiserverProxyConfig{}, err
	}

	return ApiserverProxyConfig{
		RestCfg:          config,
		KeepaliveTimeout: sec.Key("keepalive_timeout").MustDuration(1 * time.Minute),
	}, nil
}

// ApiserverProxy is a proxy for kube-apiserver.
type ApiserverProxy struct {
	config  ApiserverProxyConfig
	handler http.Handler
	logger  log.Logger
}

// ProvideApiserverProxy provides a new ApiserverProxy with given configuration.
func ProvideApiserverProxy(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*ApiserverProxy, error) {
	enabled := features.IsEnabled(featuremgmt.FlagIntentapi)
	if !enabled {
		return &ApiserverProxy{
			logger: log.New("intentapi.proxy"),
		}, nil
	}

	conf, err := NewApiserverProxyConfig(cfg)
	if err != nil {
		return nil, err
	}

	proxy, err := proxy.NewProxyHandler("/", nil, conf.RestCfg, conf.KeepaliveTimeout, false)
	if err != nil {
		return nil, err
	}

	return &ApiserverProxy{
		config:  conf,
		handler: proxy,
		logger:  log.New("intentapi.proxy"),
	}, nil
}

// ServeHTTP serves HTTP requests to the proxy by forwarding them to kube-apiserver.
func (p *ApiserverProxy) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// handler will be nil if IntentAPI feature is disabled,
	// in that case we can't serve anything.
	//
	// NB that this should not happen normally, because the HTTP server will be disabled as well,
	// but as a matter of precaution it's a good idea to handle it here as well.
	if p.handler == nil {
		w.WriteHeader(http.StatusNotImplemented)
		return
	}

	// TODO: add instrumentation (metrics, traces).
	p.handler.ServeHTTP(w, req)
}
