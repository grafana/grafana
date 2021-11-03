package cloudmonitoring

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (s *Service) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/cloudmonitoring/", s.resourceHandler(cloudMonitor))
	mux.HandleFunc("/cloudresourcemanager/", s.resourceHandler(resourceManager))
}

func (s *Service) resourceHandler(subDataSource string) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		client, code, err := s.setRequestVariables(req, subDataSource)
		if err != nil {
			writeResponse(rw, code, fmt.Sprintf("unexpected error %v", err))
			return
		}
		doRequest(rw, req, client)
	}
}

func (s *Service) setRequestVariables(req *http.Request, subDataSource string) (*http.Client, int, error) {
	slog.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

	newPath, err := getTarget(req.URL.Path)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	dsInfo, err := s.getDataSourceFromHTTPReq(req)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	serviceURL, err := url.Parse(dsInfo.services[subDataSource].url)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	req.URL.Path = newPath
	req.URL.Host = serviceURL.Host
	req.URL.Scheme = serviceURL.Scheme

	return dsInfo.services[subDataSource].client, 0, nil
}

func doRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) http.ResponseWriter {
	res, err := cli.Do(req)
	if err != nil {
		rw.WriteHeader(http.StatusBadRequest)
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			slog.Error("Unable to write HTTP response", "error", err)
		}
		return nil
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			slog.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			slog.Error("Unable to write HTTP response", "error", err)
		}
		return nil
	}
	rw.WriteHeader(res.StatusCode)
	_, err = rw.Write(body)
	if err != nil {
		slog.Error("Unable to write HTTP response", "error", err)
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

func getTarget(original string) (target string, err error) {
	splittedPath := strings.SplitN(original, "/", 3)
	if len(splittedPath) < 3 {
		err = fmt.Errorf("the request should contain the service on its path")
		return
	}
	target = fmt.Sprintf("/%s", splittedPath[2])
	return
}

func writeResponse(rw http.ResponseWriter, code int, msg string) {
	rw.WriteHeader(code)
	_, err := rw.Write([]byte(msg))
	if err != nil {
		slog.Error("Unable to write HTTP response", "error", err)
	}
}

func (s *Service) getDataSourceFromHTTPReq(req *http.Request) (*datasourceInfo, error) {
	ctx := req.Context()
	pluginContext := httpadapter.PluginConfigFromContext(ctx)
	i, err := s.im.Get(pluginContext)
	if err != nil {
		return nil, nil
	}
	ds, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("unable to convert datasource from service instance")
	}
	return ds, nil
}
