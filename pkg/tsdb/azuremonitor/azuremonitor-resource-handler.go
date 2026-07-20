package azuremonitor

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

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

	errorBody := map[string]string{"error": message}

	re := regexp.MustCompile(`\{.*?\}`)
	jsonPart := re.FindString(message)
	if jsonPart != "" {
		var jsonData map[string]interface{}
		if unmarshalErr := json.Unmarshal([]byte(jsonPart), &jsonData); unmarshalErr != nil {
			errorBody["error"] = fmt.Sprintf("Invalid JSON format in error message. Raw error: %s", message)
			s.logger.Error("failed to unmarshal JSON error message", "error", unmarshalErr)
		} else {
			errorType, _ := jsonData["error"].(string)
			errorDescription, ok := jsonData["error_description"].(string)
			if !ok {
				s.logger.Error("unable to convert error_description to string", "rawError", jsonData["error_description"])
				errorDescription = fmt.Sprintf("%v", jsonData["error_description"])
			}
			if errorType == "" {
				errorType = "UnknownError"
			}

			errorBody["error"] = fmt.Sprintf("%s: %s", errorType, errorDescription)
		}
	}

	jsonRes, _ := json.Marshal(errorBody)
	_, err := rw.Write(jsonRes)
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
		_, err = fmt.Fprintf(rw, "unexpected error %v", err)
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

func writeErrorResponse(rw http.ResponseWriter, code int, msg string) {
	rw.Header().Set("Content-Type", "application/json")
	rw.WriteHeader(code)
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
		s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

		newPath, err := getTarget(req.URL.Path)
		if err != nil {
			writeErrorResponse(rw, http.StatusBadRequest, err.Error())
			return
		}

		dsInfo, err := s.getDataSourceFromHTTPReq(req)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}

		service := dsInfo.Services[subDataSource]
		serviceURL, err := url.Parse(service.URL)
		if err != nil {
			writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
			return
		}
		req.URL.Path = newPath
		req.URL.Host = serviceURL.Host
		req.URL.Scheme = serviceURL.Scheme

		_, err = s.executors[subDataSource].ResourceRequest(rw, req, service.HTTPClient)
		if err != nil {
			s.logger.Error("error in resource request", "error", err)
			return
		}
	}
}

type armListEndpoint struct {
	service   string
	buildPath func(query url.Values) (path string, linkParams url.Values, err error)
}

func armListEndpoints() map[string]armListEndpoint {
	return map[string]armListEndpoint{
		"/subscriptions": {
			service: azureMonitor,
			buildPath: func(url.Values) (string, url.Values, error) {
				return "/subscriptions?api-version=2019-03-01", nil, nil
			},
		},
		"/workspaces": {
			service: azureMonitor,
			buildPath: func(query url.Values) (string, url.Values, error) {
				subscriptionID := query.Get("subscriptionId")
				if subscriptionID == "" {
					return "", nil, errors.New("subscriptionId is required")
				}
				path := fmt.Sprintf(
					"/subscriptions/%s/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview",
					url.PathEscape(subscriptionID),
				)
				return path, url.Values{"subscriptionId": {subscriptionID}}, nil
			},
		},
	}
}

func (s *Service) armListHandler(ep armListEndpoint) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		path, linkParams, err := ep.buildPath(req.URL.Query())
		if err != nil {
			writeErrorResponse(rw, http.StatusBadRequest, err.Error())
			return
		}
		s.listArmResource(rw, req, ep.service, path, linkParams)
	}
}

func (s *Service) listArmResource(rw http.ResponseWriter, req *http.Request, serviceName, armPath string, linkParams url.Values) {
	dsInfo, err := s.getDataSourceFromHTTPReq(req)
	if err != nil {
		writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("unexpected error %v", err))
		return
	}

	service, ok := dsInfo.Services[serviceName]
	if !ok {
		writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("%s service not configured", serviceName))
		return
	}

	query := req.URL.Query()
	listAll := query.Get("listAll") == "true"

	requestURL := service.URL + armPath
	if token := query.Get("nextToken"); token != "" {
		requestURL = appendSkipToken(requestURL, token)
	}

	value, nextToken, truncated, err := fetchArmPages(req.Context(), service.HTTPClient, requestURL, listAll, MaxArmPages)
	if err != nil {
		status := http.StatusInternalServerError
		var armErr *armHTTPError
		if errors.As(err, &armErr) {
			status = armErr.status
		}
		writeErrorResponse(rw, status, err.Error())
		return
	}
	if truncated {
		s.logger.Warn("Azure Monitor ARM listing stopped at page cap; some results may be omitted", "maxPages", MaxArmPages, "path", armPath)
	}

	if err := writePaginatedResponse(rw, value, nextToken, truncated, linkParams); err != nil {
		s.logger.Error("failed to write paginated response", "error", err)
	}
}

// newResourceMux provides route definitions shared with the frontend.
// Check: /public/app/plugins/datasource/azuremonitor/utils/common.ts <routeNames>
func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/azuremonitor/", s.handleResourceReq(azureMonitor))
	mux.HandleFunc("/loganalytics/", s.handleResourceReq(azureLogAnalytics))
	mux.HandleFunc("/resourcegraph/", s.handleResourceReq(azureResourceGraph))
	for route, ep := range armListEndpoints() {
		handler := s.armListHandler(ep)
		mux.HandleFunc(route, handler)
		mux.HandleFunc(route+"/{$}", handler)
	}
	return mux
}
