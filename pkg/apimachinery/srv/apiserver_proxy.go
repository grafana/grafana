package srv

import (
	"net/http"
	"time"

	"k8s.io/kubectl/pkg/proxy"

	"github.com/grafana/grafana/pkg/apimachinery/bridge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// ApiserverProxy is a proxy for kube-apiserver.
type ApiserverProxy struct {
	handler http.Handler
	logger  log.Logger
}

// ProvideApiserverProxy provides a new ApiserverProxy with given configuration.
func ProvideApiserverProxy(cfg *setting.Cfg, kb *bridge.Service) (*ApiserverProxy, error) {
	if kb.IsDisabled() {
		return &ApiserverProxy{
			logger: log.New("apimachinery.apiserver_proxy"),
		}, nil
	}

	sec := cfg.Raw.Section("apiserver.proxy")
	proxy, err := proxy.NewProxyHandler(
		"/", nil, kb.RestConfig(), sec.Key("keepalive_timeout").MustDuration(1*time.Minute), false,
	)
	if err != nil {
		return nil, err
	}

	return &ApiserverProxy{
		handler: proxy,
		logger:  log.New("apimachinery.proxy"),
	}, nil
}

// ServeHTTP serves HTTP requests to the proxy by forwarding them to kube-apiserver.
func (p *ApiserverProxy) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// handler will be nil if Apiserver feature is disabled,
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
