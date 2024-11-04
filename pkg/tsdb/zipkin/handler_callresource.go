package zipkin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	a := httpadapter.New(s.getRouter())
	return a.CallResource(ctx, req, sender)
}

func (s *Service) getRouter() *http.ServeMux {
	router := http.NewServeMux()
	router.HandleFunc("GET /services", s.withDatasourceHandlerFunc(getServicesHandler))
	router.HandleFunc("GET /spans", s.withDatasourceHandlerFunc(getSpansHandler))
	router.HandleFunc("GET /traces", s.withDatasourceHandlerFunc(getTracesHandler))
	router.HandleFunc("GET /trace/{traceId}", s.withDatasourceHandlerFunc(getTraceHandler))
	return router
}

func (s *Service) withDatasourceHandlerFunc(getHandler func(d *datasourceInfo) http.HandlerFunc) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		client, err := s.getDSInfo(r.Context(), backend.PluginConfigFromContext(r.Context()))
		if err != nil {
			writeResponse(nil, errors.New("error getting data source information from context"), rw, http.StatusInternalServerError)
			return
		}
		h := getHandler(client)
		h.ServeHTTP(rw, r)
	}
}

// https://zipkin.io/zipkin-api/#/default/get_services
func getServicesHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v2/services", ds.URL), nil)
		if err != nil {
			writeResponse(nil, err, rw, http.StatusInternalServerError)
			return
		}
		handleRequest(ds.HTTPClient, rw, req)
	}
}

// https://zipkin.io/zipkin-api/#/default/get_spans
func getSpansHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		serviceName := strings.TrimSpace(r.URL.Query().Get("serviceName"))
		if serviceName == "" {
			writeResponse(nil, errors.New("invalid/empty serviceName"), rw, http.StatusNotFound)
			return
		}
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v2/spans?serviceName=%s", ds.URL, url.QueryEscape(serviceName)), nil)
		if err != nil {
			writeResponse(nil, err, rw, http.StatusInternalServerError)
			return
		}
		handleRequest(ds.HTTPClient, rw, req)
	}
}

// https://zipkin.io/zipkin-api/#/default/get_traces
func getTracesHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		serviceName := strings.TrimSpace(r.URL.Query().Get("serviceName"))
		if serviceName == "" {
			writeResponse(nil, errors.New("invalid/empty serviceName"), rw, http.StatusNotFound)
			return
		}
		spanName := strings.TrimSpace(r.URL.Query().Get("spanName"))
		if spanName == "" {
			writeResponse(nil, errors.New("invalid/empty spanName"), rw, http.StatusNotFound)
			return
		}
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v2/traces?serviceName=%s&spanName=%s", ds.URL, url.QueryEscape(serviceName), url.QueryEscape(spanName)), nil)
		if err != nil {
			writeResponse(nil, err, rw, http.StatusInternalServerError)
			return
		}
		handleRequest(ds.HTTPClient, rw, req)
	}
}

// https://zipkin.io/zipkin-api/#/default/get_trace__traceId_
func getTraceHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		traceId := r.PathValue("traceId")
		if traceId == "" {
			writeResponse(nil, errors.New("invalid/empty traceId"), rw, http.StatusNotFound)
			return
		}
		req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v2/trace/%s", ds.URL, url.QueryEscape(traceId)), nil)
		if err != nil {
			writeResponse(nil, err, rw, http.StatusInternalServerError)
			return
		}
		handleRequest(ds.HTTPClient, rw, req)
	}
}

func handleRequest(hc *http.Client, rw http.ResponseWriter, r *http.Request) {
	res, err := hc.Do(r)
	if err != nil {
		if res != nil {
			writeResponse(nil, err, rw, res.StatusCode)
			return
		}
		writeResponse(nil, err, rw, http.StatusInternalServerError)
		return
	}
	defer res.Body.Close()
	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		writeResponse(nil, err, rw, http.StatusInternalServerError)
		return
	}
	writeResponse(string(bodyBytes), nil, rw, res.StatusCode)
}

func writeResponse(res interface{}, err error, rw http.ResponseWriter, statusCode int) {
	rw.WriteHeader(statusCode)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	if str, ok := res.(string); ok {
		rw.Header().Set("Content-Type", "text/plain")
		_, _ = rw.Write([]byte(str))
		return
	}
	b, err := json.Marshal(res)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	rw.Header().Set("Content-Type", "application/json")
	_, _ = rw.Write(b)
}
