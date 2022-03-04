package intentapi

import (
	"net/http"
	"time"

	"k8s.io/kubectl/pkg/proxy"

	"github.com/grafana/grafana/internal/k8sbridge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// ApiserverProxy is a proxy for kube-apiserver.
type ApiserverProxy struct {
	handler http.Handler
	logger  log.Logger
}

// ProvideApiserverProxy provides a new ApiserverProxy with given configuration.
func ProvideApiserverProxy(cfg *setting.Cfg, bridge *k8sbridge.Service) (*ApiserverProxy, error) {
	if bridge.IsDisabled() {
		return &ApiserverProxy{
			logger: log.New("intentapi.apiserver_proxy"),
		}, nil
	}

	sec := cfg.Raw.Section("intentapi.proxy")
	proxy, err := proxy.NewProxyHandler(
		"/", nil, bridge.RestConfig(), sec.Key("keepalive_timeout").MustDuration(1*time.Minute), false,
	)
	if err != nil {
		return nil, err
	}

	return &ApiserverProxy{
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
