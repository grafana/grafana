package annotationsapi

import (
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// ProxyHandler carries the k8s client for the standalone annotation API server.
// It is injected into HTTPServer; handlers use it alongside hs.annotationsRepo
// for legacy fallback. client is nil when api_migration_phase is "off".
type ProxyHandler struct {
	client client.K8sHandler
	phase  string
}

// ProvideProxyHandler is the Wire provider.
func ProvideProxyHandler(cfg *setting.Cfg, userSvc user.Service) (*ProxyHandler, error) {
	k8sClient, err := NewClient(cfg, userSvc)
	if err != nil {
		return nil, err
	}
	return &ProxyHandler{
		client: k8sClient,
		phase:  cfg.AnnotationAppPlatform.APIMigrationPhase,
	}, nil
}

// Enabled reports whether the proxy is active.
func (h *ProxyHandler) Enabled() bool {
	return h.client != nil && (h.phase == "proxy-writes" || h.phase == "proxy-all")
}
