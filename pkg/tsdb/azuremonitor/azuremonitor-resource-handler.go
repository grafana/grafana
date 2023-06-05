package azuremonitor

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func getTarget(original string) (target string, err error) {
	splittedPath := strings.Split(original, "/")
	if len(splittedPath) < 3 {
		err = fmt.Errorf("the request should contain the service on its path")
		return
	}
	target = fmt.Sprintf("/%s", strings.Join(splittedPath[2:], "/"))
	return
}

type httpServiceProxy struct {
}

func (s *httpServiceProxy) Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) http.ResponseWriter {
	res, err := cli.Do(req)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			logger.Error("Unable to write HTTP response", "error", err)
		}
		return nil
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			logger.Error("Unable to write HTTP response", "error", err)
		}
		return nil
	}
	rw.WriteHeader(res.StatusCode)
	_, err = rw.Write(body)
	if err != nil {
		logger.Error("Unable to write HTTP response", "error", err)
	}

	for k, v := range res.Header {
		rw.Header().Set(k, v[0])
		for _, v := range v[1:] {
			rw.Header().Add(k, v)
		}
	}
	// Returning the response write for testing purposes
	return rw
}

func (s *Service) getDataSourceFromHTTPReq(req *http.Request) (types.DatasourceInfo, error) {
	ctx := req.Context()
	pluginContext := httpadapter.PluginConfigFromContext(ctx)
	i, err := s.im.Get(pluginContext)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	ds, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("unable to convert datasource from service instance")
	}
	return ds, nil
}

func writeResponse(rw http.ResponseWriter, code int, msg string) {
	rw.WriteHeader(http.StatusBadRequest)
	_, err := rw.Write([]byte(msg))
	if err != nil {
		logger.Error("Unable to write HTTP response", "error", err)
	}
}

func (s *Service) handleResourceReq(subDataSource string) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		newPath, err := getTarget(req.URL.Path)
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, err.Error())
			return
		}

		dsInfo, err := s.getDataSourceFromHTTPReq(req)
		if err != nil {
			writeResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		service := dsInfo.Services[subDataSource]
		serviceURL, err := url.Parse(service.URL)
		if err != nil {
			writeResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}
		req.URL.Path = newPath
		req.URL.Host = serviceURL.Host
		req.URL.Scheme = serviceURL.Scheme

		s.executors[subDataSource].ResourceRequest(rw, req, service.HTTPClient)
	}
}

// newResourceMux provides route definitions shared with the frontend.
// Check: /public/app/plugins/datasource/azuremonitor/utils/common.ts <routeNames>
func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/azuremonitor/", s.handleResourceReq(azureMonitor))
	mux.HandleFunc("/loganalytics/", s.handleResourceReq(azureLogAnalytics))
	mux.HandleFunc("/resourcegraph/", s.handleResourceReq(azureResourceGraph))
	return mux
}
