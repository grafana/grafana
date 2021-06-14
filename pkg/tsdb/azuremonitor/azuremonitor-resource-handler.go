package azuremonitor

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func parseResourcePath(original string) (dsName string, target string, err error) {
	splittedPath := strings.Split(original, "/")
	if len(splittedPath) < 4 {
		err = fmt.Errorf("the request should contain the service on its path")
		return
	}
	// TODO: Verify if this can vary
	dsName = azureMonitor
	target = fmt.Sprintf("/%s", strings.Join(splittedPath[2:], "/"))
	return
}

type httpServiceProxy struct{}

func (s *httpServiceProxy) Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) http.ResponseWriter {
	res, err := cli.Do(req)
	if err != nil {
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			azlog.Error("Unable to write HTTP response", "error", err)
		}
		rw.WriteHeader(http.StatusInternalServerError)
		return nil
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			azlog.Error("Unable to write HTTP response", "error", err)
		}
		rw.WriteHeader(http.StatusInternalServerError)
		return nil
	}
	_, err = rw.Write(body)
	if err != nil {
		azlog.Error("Unable to write HTTP response", "error", err)
	}

	for k, v := range res.Header {
		rw.Header().Set(k, v[0])
		for _, v := range v[1:] {
			rw.Header().Add(k, v)
		}
	}
	rw.WriteHeader(res.StatusCode)
	// Returning the response write for testing purposes
	return rw
}

func (s *Service) getDataSourceFromHTTPReq(req *http.Request) (datasourceInfo, error) {
	ctx := req.Context()
	pluginContext := httpadapter.PluginConfigFromContext(ctx)
	i, err := s.im.Get(pluginContext)
	if err != nil {
		return datasourceInfo{}, nil
	}
	return i.(datasourceInfo), nil
}

func (s *Service) getDSAssetsFromHTTPReq(req *http.Request, dsName string) (datasourceInfo, datasourceService, error) {
	dsInfo, err := s.getDataSourceFromHTTPReq(req)
	if err != nil {
		return datasourceInfo{}, datasourceService{}, err
	}
	service, err := s.getDatasourceService(req.Context(), dsInfo, dsName)
	if err != nil {
		return datasourceInfo{}, datasourceService{}, err
	}
	return dsInfo, service, nil
}

func (s *Service) resourceHandler(rw http.ResponseWriter, req *http.Request) {
	azlog.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	dsName, newPath, err := parseResourcePath(req.URL.Path)
	if err != nil {
		_, err := rw.Write([]byte(err.Error()))
		if err != nil {
			azlog.Error("Unable to write HTTP response", "error", err)
		}
		rw.WriteHeader(http.StatusBadRequest)
		return
	}

	_, service, err := s.getDSAssetsFromHTTPReq(req, dsName)
	if err != nil {
		_, err := rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			azlog.Error("Unable to write HTTP response", "error", err)
		}
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}

	serviceURL, err := url.Parse(service.URL)
	if err != nil {
		_, err := rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			azlog.Error("Unable to write HTTP response", "error", err)
		}
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}
	req.URL.Path = newPath
	req.URL.Host = serviceURL.Host
	req.URL.Scheme = serviceURL.Scheme

	s.proxy.Do(rw, req, service.HTTPClient)
}

func (s *Service) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/", s.resourceHandler)
}
