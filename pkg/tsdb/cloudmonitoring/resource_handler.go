package cloudmonitoring

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/grafana/grafana-google-sdk-go/pkg/utils"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

// nameExp matches the part after the last '/' symbol
var nameExp = regexp.MustCompile(`([^\/]*)\/*$`)

const resourceManagerPath = "/v1/projects"

type processResponse func(body []byte) ([]byte, error)

func (s *Service) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/gceDefaultProject", getGCEDefaultProject)

	mux.HandleFunc("/metricDescriptors/", s.resourceHandler(cloudMonitor, processMetricDescriptors))
	mux.HandleFunc("/services/", s.resourceHandler(cloudMonitor, processServices))
	mux.HandleFunc("/slo-services/", s.resourceHandler(cloudMonitor, processSLOs))
	mux.HandleFunc("/projects", s.resourceHandler(resourceManager, processProjects))
}

func getGCEDefaultProject(rw http.ResponseWriter, req *http.Request) {
	project, err := utils.GCEDefaultProject(req.Context())
	if err != nil {
		writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		return
	}
	writeResponse(rw, http.StatusOK, project)
}

func (s *Service) resourceHandler(subDataSource string, responseFn processResponse) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		client, code, err := s.setRequestVariables(req, subDataSource)
		if err != nil {
			writeResponse(rw, code, fmt.Sprintf("unexpected error %v", err))
			return
		}
		s.doRequest(rw, req, client, responseFn)
	}
}

func (s *Service) doRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client, responseFn processResponse) http.ResponseWriter {
	res, err := cli.Do(req)
	if err != nil {
		writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		return rw
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			slog.Warn("Failed to close response body", "err", err)
		}
	}()

	if responseFn == nil {
		writeResponse(rw, http.StatusInternalServerError, "responseFn should not be nil")
		return rw
	}

	body, code, err := processData(res, responseFn)
	if err != nil {
		writeResponse(rw, code, fmt.Sprintf("unexpected error %v", err))
		return rw
	}
	writeResponseBytes(rw, res.StatusCode, body)

	for k, v := range res.Header {
		rw.Header().Set(k, v[0])
		for _, v := range v[1:] {
			rw.Header().Add(k, v)
		}
	}
	return rw
}

func processMetricDescriptors(body []byte) ([]byte, error) {
	resp := metricDescriptorResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, err
	}

	for i := range resp.Descriptors {
		resp.Descriptors[i].Service = strings.SplitN(resp.Descriptors[i].Type, "/", 2)[0]
		resp.Descriptors[i].ServiceShortName = strings.SplitN(resp.Descriptors[i].Service, ".", 2)[0]
		if resp.Descriptors[i].DisplayName == "" {
			resp.Descriptors[i].DisplayName = resp.Descriptors[i].Type
		}
	}
	return json.Marshal(resp.Descriptors)
}

func processServices(body []byte) ([]byte, error) {
	resp := serviceResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, err
	}

	values := []selectableValue{}
	for _, service := range resp.Services {
		name := nameExp.FindString(service.Name)
		if name == "" {
			return nil, fmt.Errorf("unexpected service name: %v", service.Name)
		}
		label := service.DisplayName
		if label == "" {
			label = name
		}
		values = append(values, selectableValue{
			Value: name,
			Label: label,
		})
	}
	return json.Marshal(values)
}

func processSLOs(body []byte) ([]byte, error) {
	resp := sloResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, err
	}

	values := []selectableValue{}
	for _, slo := range resp.SLOs {
		name := nameExp.FindString(slo.Name)
		if name == "" {
			return nil, fmt.Errorf("unexpected service name: %v", slo.Name)
		}
		values = append(values, selectableValue{
			Value: name,
			Label: slo.DisplayName,
			Goal:  slo.Goal,
		})
	}
	return json.Marshal(values)
}

func processProjects(body []byte) ([]byte, error) {
	resp := projectResponse{}
	err := json.Unmarshal(body, &resp)
	if err != nil {
		return nil, err
	}

	values := []selectableValue{}
	for _, project := range resp.Projects {
		values = append(values, selectableValue{
			Value: project.ProjectID,
			Label: project.Name,
		})
	}
	return json.Marshal(values)
}

func processData(res *http.Response, responseFn processResponse) ([]byte, int, error) {
	encoding := res.Header.Get("Content-Encoding")

	var reader io.Reader
	var err error
	switch encoding {
	case "gzip":
		reader, err = gzip.NewReader(res.Body)
		if err != nil {
			return nil, http.StatusBadRequest, fmt.Errorf("unexpected error %v", err)
		}
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				slog.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "deflate":
		reader = flate.NewReader(res.Body)
		defer func() {
			if err := reader.(io.ReadCloser).Close(); err != nil {
				slog.Warn("Failed to close reader body", "err", err)
			}
		}()
	case "br":
		reader = brotli.NewReader(res.Body)
	case "":
		reader = res.Body
	default:
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected encoding type %v", err)
	}

	body, err := ioutil.ReadAll(reader)
	if err != nil {
		return nil, http.StatusBadRequest, fmt.Errorf("unexpected error %v", err)
	}

	body, err = responseFn(body)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("data processing error %v", err)
	}

	buf := new(bytes.Buffer)
	var writer io.Writer = buf
	switch encoding {
	case "gzip":
		writer = gzip.NewWriter(writer)
	case "deflate":
		writer, err = flate.NewWriter(writer, -1)
		if err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("unexpected error %v", err)
		}
	case "br":
		writer = brotli.NewWriter(writer)
	case "":
	default:
		return nil, http.StatusInternalServerError, fmt.Errorf("unexpected encoding type %v", encoding)
	}

	_, err = writer.Write(body)
	if writeCloser, ok := writer.(io.WriteCloser); ok {
		if err := writeCloser.Close(); err != nil {
			slog.Warn("Failed to close writer body", "err", err)
		}
	}
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("unable to encode response %v", err)
	}

	return buf.Bytes(), 0, nil
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
		slog.Error("Unable to write HTTP response", "error", err)
	}
}

func writeResponse(rw http.ResponseWriter, code int, msg string) {
	writeResponseBytes(rw, code, []byte(msg))
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
