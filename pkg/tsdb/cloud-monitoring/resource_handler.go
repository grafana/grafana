package cloudmonitoring

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// nameExp matches the part after the last '/' symbol
var nameExp = regexp.MustCompile(`([^\/]*)\/*$`)

const resourceManagerPath = "/v1/projects"

type processResponse func(body []byte) ([]json.RawMessage, string, error)

func (s *Service) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/gceDefaultProject", s.getGCEDefaultProject)
	mux.HandleFunc("/metricDescriptors/", s.handleResourceReq(cloudMonitor, processMetricDescriptors))
	mux.HandleFunc("/services/", s.handleResourceReq(cloudMonitor, processServices))
	mux.HandleFunc("/slo-services/", s.handleResourceReq(cloudMonitor, processSLOs))
	mux.HandleFunc("/projects", s.handleResourceReq(resourceManager, processProjects))
	return mux
}

func (s *Service) getGCEDefaultProject(rw http.ResponseWriter, req *http.Request) {
	project, err := s.gceDefaultProjectGetter(req.Context(), resourceManagerScope)
	if err != nil {
		writeErrorResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		return
	}

	encoded, err := json.Marshal(project)
	if err != nil {
		writeErrorResponse(rw, http.StatusBadRequest, fmt.Sprintf("error retrieving default project %v", err))
		return
	}
	writeResponseBytes(rw, http.StatusOK, encoded)
}

func (s *Service) handleResourceReq(subDataSource string, responseFn processResponse) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		client, code, err := s.setRequestVariables(req, subDataSource)
		if err != nil {
			writeErrorResponse(rw, code, fmt.Sprintf("unexpected error %v", err))
			return
		}
		getResources(rw, req, client, responseFn)
	}
}

func getResources(rw http.ResponseWriter, req *http.Request, cli *http.Client, responseFn processResponse) http.ResponseWriter {
	if responseFn == nil {
		writeErrorResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
		return rw
	}

	responses, headers, encoding, code, err := getResponses(req, cli, responseFn)
	if err != nil {
		writeErrorResponse(rw, code, fmt.Sprintf("unexpected error %v", err))
		return rw
	}

	body, err := buildResponse(responses, encoding)
	if err != nil {
		writeErrorResponse(rw, http.StatusInternalServerError, fmt.Sprintf("error formatting responose %v", err))
		return rw
	}
	writeResponseBytes(rw, code, body)

	for k, v := range headers {
		rw.Header().Set(k, v[0])
		for _, v := range v[1:] {
			rw.Header().Add(k, v)
		}
	}
	return rw
}

func processMetricDescriptors(body []byte) ([]json.RawMessage, string, error) {
	resp := metricDescriptorResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, "", err
	}

	results := []json.RawMessage{}
	for i := range resp.Descriptors {
		resp.Descriptors[i].Service = strings.SplitN(resp.Descriptors[i].Type, "/", 2)[0]
		resp.Descriptors[i].ServiceShortName = strings.SplitN(resp.Descriptors[i].Service, ".", 2)[0]
		if resp.Descriptors[i].DisplayName == "" {
			resp.Descriptors[i].DisplayName = resp.Descriptors[i].Type
		}
		descriptor, err := json.Marshal(resp.Descriptors[i])
		if err != nil {
			return nil, "", err
		}
		results = append(results, descriptor)
	}
	return results, resp.Token, nil
}

func processServices(body []byte) ([]json.RawMessage, string, error) {
	resp := serviceResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, "", err
	}

	results := []json.RawMessage{}
	for _, service := range resp.Services {
		name := nameExp.FindString(service.Name)
		if name == "" {
			return nil, "", fmt.Errorf("unexpected service name: %v", service.Name)
		}
		label := service.DisplayName
		if label == "" {
			label = name
		}
		marshaledValue, err := json.Marshal(selectableValue{
			Value: name,
			Label: label,
		})
		if err != nil {
			return nil, "", err
		}
		results = append(results, marshaledValue)
	}
	return results, resp.Token, nil
}

func processSLOs(body []byte) ([]json.RawMessage, string, error) {
	resp := sloResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, "", err
	}

	results := []json.RawMessage{}
	for _, slo := range resp.SLOs {
		name := nameExp.FindString(slo.Name)
		if name == "" {
			return nil, "", fmt.Errorf("unexpected service name: %v", slo.Name)
		}
		marshaledValue, err := json.Marshal(selectableValue{
			Value: name,
			Label: slo.DisplayName,
			Goal:  slo.Goal,
		})
		if err != nil {
			return nil, "", err
		}
		results = append(results, marshaledValue)
	}
	return results, resp.Token, nil
}

func processProjects(body []byte) ([]json.RawMessage, string, error) {
	resp := projectResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, "", err
	}

	results := []json.RawMessage{}
	for _, project := range resp.Projects {
		marshaledValue, err := json.Marshal(selectableValue{
			Value: project.ProjectID,
			Label: project.Name,
		})
		if err != nil {
			return nil, "", err
		}
		results = append(results, marshaledValue)
	}
	return results, resp.Token, nil
}

func decode(encoding string, original io.ReadCloser) ([]byte, error) {
	var reader io.Reader
	var err error
	switch encoding {
	case "gzip":
		reader, err = gzip.NewReader(original)
		if err != nil {
			return nil, err
		}
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "deflate":
		reader = flate.NewReader(original)
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				backend.Logger.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "br":
		reader = brotli.NewReader(original)
	case "":
		reader = original
	default:
		return nil, fmt.Errorf("unexpected encoding type %v", err)
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func encode(encoding string, body []byte) ([]byte, error) {
	buf := new(bytes.Buffer)
	var writer io.Writer = buf
	var err error
	switch encoding {
	case "gzip":
		writer = gzip.NewWriter(writer)
	case "deflate":
		writer, err = flate.NewWriter(writer, -1)
		if err != nil {
			return nil, err
		}
	case "br":
		writer = brotli.NewWriter(writer)
	case "":
	default:
		return nil, fmt.Errorf("unexpected encoding type %v", encoding)
	}

	_, err = writer.Write(body)
	if writeCloser, ok := writer.(io.WriteCloser); ok {
		if err := writeCloser.Close(); err != nil {
			backend.Logger.Warn("Failed to close writer body", "err", err)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("unable to encode response %v", err)
	}
	return buf.Bytes(), nil
}

func processData(data io.ReadCloser, encoding string, responseFn processResponse) ([]json.RawMessage, string, int, error) {
	body, err := decode(encoding, data)
	if err != nil {
		return nil, "", http.StatusBadRequest, fmt.Errorf("unable to decode response %v", err)
	}

	response, token, err := responseFn(body)
	if err != nil {
		return nil, "", http.StatusInternalServerError, fmt.Errorf("data processing error %v", err)
	}
	return response, token, 0, nil
}

type apiResponse struct {
	encoding  string
	header    http.Header
	responses []json.RawMessage
	token     string
	code      int
	err       error
}

func doRequest(req *http.Request, cli *http.Client, responseFn processResponse) *apiResponse {
	res, err := cli.Do(req)
	if err != nil {
		return &apiResponse{code: http.StatusBadRequest, err: err}
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			backend.Logger.Warn("Failed to close response body", "err", err)
		}
	}()
	encoding := res.Header.Get("Content-Encoding")
	originalHeader := res.Header
	code := res.StatusCode

	responses, token, errcode, err := processData(res.Body, encoding, responseFn)
	if err != nil {
		code = errcode
	}
	return &apiResponse{
		encoding:  encoding,
		header:    originalHeader,
		responses: responses,
		token:     token,
		code:      code,
		err:       err,
	}
}

func getResponses(req *http.Request, cli *http.Client, responseFn processResponse) ([]json.RawMessage, http.Header, string, int, error) {
	timings := ""
	start := time.Now()
	result := doRequest(req, cli, responseFn)
	elapsed := time.Since(start)
	timings = timings + " " + strconv.FormatFloat(elapsed.Seconds(), 'f', 10, 64)
	if result.err != nil {
		return nil, nil, "", result.code, result.err
	}

	token := result.token
	responses := result.responses
	for token != "" {
		start = time.Now()
		query := req.URL.Query()
		query.Set("pageToken", token)
		req.URL.RawQuery = query.Encode()

		loopResult := doRequest(req, cli, responseFn)
		elapsed = time.Since(start)
		timings = timings + " " + strconv.FormatFloat(elapsed.Seconds(), 'f', 10, 64)
		if loopResult.err != nil {
			return nil, nil, "", loopResult.code, loopResult.err
		}
		responses = append(responses, loopResult.responses...)
		token = loopResult.token
	}
	result.header.Set("Server-Timing", fmt.Sprintf("doRequest;dur=%v", timings))
	return responses, result.header, result.encoding, result.code, nil
}

func buildResponse(responses []json.RawMessage, encoding string) ([]byte, error) {
	body, err := json.Marshal(responses)
	if err != nil {
		return nil, fmt.Errorf("response marshaling error %v", err)
	}

	return encode(encoding, body)
}

func (s *Service) setRequestVariables(req *http.Request, subDataSource string) (*http.Client, int, error) {
	s.logger.Debug("Received resource call", "url", req.URL.String(), "method", req.Method)

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

func getTarget(original string) (target string, err error) {
	if original == "/projects" {
		return resourceManagerPath, nil
	}
	splittedPath := strings.SplitN(original, "/", 3)
	if len(splittedPath) < 3 {
		err = fmt.Errorf("the request should contain the service on its path")
		return
	}
	target = fmt.Sprintf("/%s", splittedPath[2])
	return
}

func writeResponseBytes(rw http.ResponseWriter, code int, msg []byte) {
	rw.WriteHeader(code)
	_, err := rw.Write(msg)
	if err != nil {
		backend.Logger.Error("Unable to write HTTP response", "error", err, "statusSource", backend.ErrorSourceDownstream)
	}
}

func writeErrorResponse(rw http.ResponseWriter, code int, msg string) {
	errorBody := map[string]string{
		"error": msg,
	}
	json, _ := json.Marshal(errorBody)
	writeResponseBytes(rw, code, json)
}

func (s *Service) getDataSourceFromHTTPReq(req *http.Request) (*datasourceInfo, error) {
	ctx := req.Context()
	pluginContext := backend.PluginConfigFromContext(ctx)
	i, err := s.im.Get(ctx, pluginContext)
	if err != nil {
		return nil, nil
	}
	ds, ok := i.(*datasourceInfo)
	if !ok {
		return nil, fmt.Errorf("unable to convert datasource from service instance")
	}
	return ds, nil
}
