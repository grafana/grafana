package zipkin

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func (s *Service) registerResourceRoutes() *http.ServeMux {
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
			writeResponse(nil, errors.New("error getting data source information from context"), rw, client.ZipkinClient.logger)
			return
		}
		h := getHandler(client)
		h.ServeHTTP(rw, r)
	}
}

func getServicesHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		services, err := ds.ZipkinClient.Services()
		writeResponse(services, err, rw, ds.ZipkinClient.logger)
	}
}

func getSpansHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		serviceName := strings.TrimSpace(r.URL.Query().Get("serviceName"))
		spans, err := ds.ZipkinClient.Spans(serviceName)
		writeResponse(spans, err, rw, ds.ZipkinClient.logger)
	}
}

func getTracesHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		serviceName := strings.TrimSpace(r.URL.Query().Get("serviceName"))
		spanName := strings.TrimSpace(r.URL.Query().Get("spanName"))
		traces, err := ds.ZipkinClient.Traces(serviceName, spanName)
		writeResponse(traces, err, rw, ds.ZipkinClient.logger)
	}
}

func getTraceHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		traceId := strings.TrimSpace(r.PathValue("traceId"))
		trace, err := ds.ZipkinClient.Trace(traceId)
		writeResponse(trace, err, rw, ds.ZipkinClient.logger)
	}
}

func writeResponse(res interface{}, err error, rw http.ResponseWriter, logger log.Logger) {
	if err != nil {
		// This is used for resource calls, we don't need to add actual error message, but we should log it
		logger.Warn("An error occurred while doing a resource call", "error", err)
		http.Error(rw, "An error occurred within the plugin", http.StatusInternalServerError)
		return
	}
	// Response should not be string, but just in case, handle it
	if str, ok := res.(string); ok {
		rw.Header().Set("Content-Type", "text/plain")
		_, _ = rw.Write([]byte(str))
		return
	}
	b, err := json.Marshal(res)
	if err != nil {
		// This is used for resource calls, we don't need to add actual error message, but we should log it
		logger.Warn("An error occurred while processing response from resource call", "error", err)
		http.Error(rw, "An error occurred within the plugin", http.StatusInternalServerError)
		return
	}
	rw.Header().Set("Content-Type", "application/json")
	_, _ = rw.Write(b)
}
