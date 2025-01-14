package azuremonitor

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/hashicorp/go-hclog"

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
	logger log.Logger
}

func (s *httpServiceProxy) writeErrorResponse(rw http.ResponseWriter, statusCode int, message string) error {
	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(statusCode)

	// Attempt to locate JSON portion in error message
	re := regexp.MustCompile(`\{.*?\}`)
	jsonPart := re.FindString(message)

	var jsonData map[string]interface{}
	if unmarshalErr := json.Unmarshal([]byte(jsonPart), &jsonData); unmarshalErr != nil {
		errorMsg, _ := json.Marshal(map[string]string{"error": "Invalid JSON format in error message"})
		_, err := rw.Write(errorMsg)
		if err != nil {
			return fmt.Errorf("unable to write HTTP response: %v", err)
		}
		return unmarshalErr
	}

	// Extract relevant fields for a formatted error message
	errorType, _ := jsonData["error"].(string)
	errorDescription, _ := jsonData["error_description"].(string)
	if errorType == "" {
		errorType = "UnknownError"
	}
	formattedError := fmt.Sprintf("%s: %s", errorType, errorDescription)

	errorMsg, _ := json.Marshal(map[string]string{"error": formattedError})
	_, err := rw.Write(errorMsg)
	if err != nil {
		return fmt.Errorf("unable to write HTTP response: %v", err)
	}
	return nil
}

func (s *httpServiceProxy) Do(rw http.ResponseWriter, req *http.Request, cli *http.Client) (http.ResponseWriter, error) {
	res, err := cli.Do(req)
	if err != nil {
		return nil, s.writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error: %v", err))
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			s.logger.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		_, err = rw.Write([]byte(fmt.Sprintf("unexpected error %v", err)))
		if err != nil {
			return nil, fmt.Errorf("unable to write HTTP response: %v", err)
		}
		return nil, err
	}

	rw.WriteHeader(res.StatusCode)
	_, err = rw.Write(body)
	if err != nil {
		return nil, fmt.Errorf("unable to write HTTP response: %v", err)
	}

	for k, v := range res.Header {
		rw.Header().Set(k, v[0])
		for _, v := range v[1:] {
			rw.Header().Add(k, v)
		}
	}

	// Return the ResponseWriter for testing purposes
	return rw, nil
}

func (s *Service) getDataSourceFromHTTPReq(req *http.Request) (types.DatasourceInfo, error) {
	ctx := req.Context()
	pluginContext := backend.PluginConfigFromContext(ctx)
	i, err := s.im.Get(ctx, pluginContext)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	ds, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("unable to convert datasource from service instance")
	}
	return ds, nil
}

func writeErrorResponse(rw http.ResponseWriter, code int, msg string, logger log.Logger) {
	logger.Debug("Writing error response", "code", code, "msg", msg, "rw", hclog.Fmt("%v", rw))
	rw.WriteHeader(http.StatusBadRequest)
	errorBody := map[string]string{
		"error": msg,
	}
	jsonRes, _ := json.Marshal(errorBody)
	_, err := rw.Write(jsonRes)
	if err != nil {
		backend.Logger.Error("Unable to write HTTP response", "error", err)
	}
}

func (s *Service) handleResourceReq(subDataSource string) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method, "subDataSource", subDataSource, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req))

		newPath, err := getTarget(req.URL.Path)
		if err != nil {
			s.logger.Debug("Resource call errored (getTarget)", "err", err, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req))
			writeErrorResponse(rw, http.StatusBadRequest, err.Error(), s.logger)
			return
		}
		s.logger.Debug("Resource call path", "newPath", newPath, "err", err)

		dsInfo, err := s.getDataSourceFromHTTPReq(req)
		if err != nil {
			s.logger.Debug("Resource call errored (dsInfo)", "err", err, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req))
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err), s.logger)
			return
		}
		s.logger.Debug("dsInfo", "dsInfo", hclog.Fmt("%v", dsInfo), "err", err)

		service := dsInfo.Services[subDataSource]
		serviceURL, err := url.Parse(service.URL)
		s.logger.Debug("Resource call service", "serviceURL", serviceURL, "service", hclog.Fmt("%v", service), "err", err)
		if err != nil {
			s.logger.Debug("Resource call errored (service)", "err", err, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req))
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err), s.logger)
			return
		}
		req.URL.Path = newPath
		req.URL.Host = serviceURL.Host
		req.URL.Scheme = serviceURL.Scheme
		s.logger.Debug("Resource call reqUpdates", "req", hclog.Fmt("%v", req))

		rw, err = s.executors[subDataSource].ResourceRequest(rw, req, service.HTTPClient)
		s.logger.Debug("Resource call", "err", err, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req), "service", hclog.Fmt("%v", service), "executors", hclog.Fmt("%v", s.executors))
		if err != nil {
			s.logger.Debug("Resource call errored", "err", err, "rw", hclog.Fmt("%v", rw), "req", hclog.Fmt("%v", req))
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err), s.logger)
			return
		}
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
