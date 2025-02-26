package jaeger

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
	router.HandleFunc("GET /services/{service}/operations", s.withDatasourceHandlerFunc(getOperationsHandler))
	return router
}

func (s *Service) withDatasourceHandlerFunc(getHandler func(d *datasourceInfo) http.HandlerFunc) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		client, err := s.getDSInfo(r.Context(), backend.PluginConfigFromContext(r.Context()))
		if err != nil {
			writeResponse(nil, errors.New("error getting data source information from context"), rw, client.JaegerClient.logger)
			return
		}
		h := getHandler(client)
		h.ServeHTTP(rw, r)
	}
}

func getServicesHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		services, err := ds.JaegerClient.Services()
		writeResponse(services, err, rw, ds.JaegerClient.logger)
	}
}

func getOperationsHandler(ds *datasourceInfo) http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		service := strings.TrimSpace(r.PathValue("service"))
		operations, err := ds.JaegerClient.Operations(service)
		writeResponse(operations, err, rw, ds.JaegerClient.logger)
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
