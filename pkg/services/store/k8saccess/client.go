package k8saccess

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

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

func (s *clientWrapper) doProxy(c *models.ReqContext) {
	params := web.Params(c.Req)
	path := params["*"]

	req := c.Req
	req.RequestURI = "" // clear the request URL

	// add the request path to the base path
	req.URL = s.baseURL.JoinPath(path)
	req.Host = req.URL.Host
	log.Println(req.RemoteAddr, " ", req.URL)

	wr := c.Resp
	resp, err := s.httpClient.Do(req)
	if err != nil {
		http.Error(wr, "Server Error", http.StatusInternalServerError)
		log.Println("ServeHTTP:", err)
		return
	}
	defer resp.Body.Close()

	log.Println(req.RemoteAddr, " ", resp.Status)

	delHopHeaders(resp.Header)

	copyHeader(wr.Header(), resp.Header)
	wr.WriteHeader(resp.StatusCode)
	io.Copy(wr, resp.Body)
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

// Hop-by-hop headers. These are removed when sent to the backend.
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html
var hopHeaders = []string{
	"Connection",
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"Te", // canonicalized version of "TE"
	"Trailers",
	"Transfer-Encoding",
	"Upgrade",
}

func copyHeader(dst, src http.Header) {
	for k, vv := range src {
		for _, v := range vv {
			dst.Add(k, v)
		}
	}
}

func delHopHeaders(header http.Header) {
	for _, h := range hopHeaders {
		header.Del(h)
	}
}

func appendHostToXForwardHeader(header http.Header, host string) {
	// If we aren't the first proxy retain prior
	// X-Forwarded-For information as a comma+space
	// separated list and fold multiple headers into one.
	if prior, ok := header["X-Forwarded-For"]; ok {
		host = strings.Join(prior, ", ") + ", " + host
	}
	header.Set("X-Forwarded-For", host)
}
