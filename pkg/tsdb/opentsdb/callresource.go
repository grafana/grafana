package opentsdb

import (
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) HandleSuggestQuery(rw http.ResponseWriter, req *http.Request) {
	logger := logger.FromContext(req.Context())

	dsInfo, err := s.getDSInfo(req.Context(), backend.PluginConfigFromContext(req.Context()))
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to get datasource info: %v", err), http.StatusInternalServerError)
		return
	}

	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to parse datasource URL: %v", err), http.StatusInternalServerError)
		return
	}

	u.Path = path.Join(u.Path, "api/suggest")
	u.RawQuery = req.URL.RawQuery
	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to create request: %v", err), http.StatusInternalServerError)
		return
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to execute request: %v", err), http.StatusInternalServerError)
		return
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	responseBody, err := DecodeResponseBody(res, logger)
	if err != nil {
		http.Error(rw, fmt.Sprintf("failed to decode response: %v", err), http.StatusInternalServerError)
		return
	}

	for name, values := range res.Header {
		if name == "Content-Encoding" || name == "Content-Length" {
			continue
		}
		for _, value := range values {
			rw.Header().Add(name, value)
		}
	}

	rw.WriteHeader(res.StatusCode)
	if _, err := rw.Write(responseBody); err != nil {
		logger.Error("Failed to write response", "error", err)
		return
	}
}
