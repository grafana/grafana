package k8saccess

import (
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type clientWrapper struct {
	err        error
	baseURL    *url.URL
	client     *kubernetes.Clientset
	config     *rest.Config
	httpClient *http.Client
}

func newClientWrapper(config *rest.Config) *clientWrapper {
	if config.UserAgent == "" {
		config.UserAgent = rest.DefaultKubernetesUserAgent()
	}

	url, _, err := defaultServerUrlFor(config)
	wrapper := &clientWrapper{
		config:  config,
		baseURL: url,
		err:     err,
	}

	if err == nil && config != nil {
		// share the transport between all clients
		wrapper.httpClient, wrapper.err = rest.HTTPClientFor(config)
		if wrapper.err == nil {
			wrapper.client, wrapper.err = kubernetes.NewForConfigAndClient(config, wrapper.httpClient)
		}
	}

	return wrapper
}

func (s *clientWrapper) getInfo() map[string]interface{} {
	info := make(map[string]interface{}, 0)

	if s.err != nil {
		info["error"] = s.err.Error()
	}

	if s.baseURL != nil {
		info["baseURL"] = s.baseURL.String()
	}

	if s.client != nil {
		v, err := s.client.ServerVersion()
		if err != nil {
			info["version_error"] = err.Error()
		}
		if v != nil {
			info["k8s.version"] = v
		}
	}
	return info
}

// defaultServerUrlFor is shared between IsConfigTransportTLS and RESTClientFor. It
// requires Host and Version to be set prior to being called.
func defaultServerUrlFor(config *rest.Config) (*url.URL, string, error) {
	// TODO: move the default to secure when the apiserver supports TLS by default
	// config.Insecure is taken to mean "I want HTTPS but don't bother checking the certs against a CA."
	hasCA := len(config.CAFile) != 0 || len(config.CAData) != 0
	hasCert := len(config.CertFile) != 0 || len(config.CertData) != 0
	defaultTLS := hasCA || hasCert || config.Insecure
	host := config.Host
	if host == "" {
		host = "localhost"
	}

	if config.GroupVersion != nil {
		return rest.DefaultServerURL(host, config.APIPath, *config.GroupVersion, defaultTLS)
	}
	return rest.DefaultServerURL(host, config.APIPath, schema.GroupVersion{}, defaultTLS)
}

func (s *clientWrapper) doProxy(c *models.ReqContext) {
	if s.baseURL == nil {
		c.Resp.WriteHeader(500)
		return
	}

	params := web.Params(c.Req)
	path := params["*"]

	url := s.baseURL.JoinPath(path)

	_, _ = c.Resp.Write([]byte("TODO, proxy: " + url.String()))
}
