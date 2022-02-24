package intentapi

import (
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
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

	configPath := sec.Key("config_path").MustString("")
	targetUrl := sec.Key("target_url").MustString("https://127.0.0.1:6443")

	// use the current context in kubeconfig
	config, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return ApiserverProxyConfig{}, err
	}

	config.Host = targetUrl

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
func ProvideApiserverProxy(cfg *setting.Cfg) (*ApiserverProxy, error) {
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
	// TODO: add instrumentation (metrics, traces).
	p.handler.ServeHTTP(w, req)
}
