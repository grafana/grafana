package jaeger

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

type JaegerClient struct {
	logger     log.Logger
	url        string
	httpClient *http.Client
	settings   backend.DataSourceInstanceSettings
}

type ServicesResponse struct {
	Data   []string    `json:"data"`
	Errors interface{} `json:"errors"`
	Limit  int         `json:"limit"`
	Offset int         `json:"offset"`
	Total  int         `json:"total"`
}

type SettingsJSONData struct {
	TraceIdTimeParams struct {
		Enabled bool `json:"enabled"`
	} `json:"traceIdTimeParams"`
}

type DependenciesResponse struct {
	Data   []ServiceDependency `json:"data"`
	Errors []struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	} `json:"errors"`
}

type ServiceDependency struct {
	Parent    string `json:"parent"`
	Child     string `json:"child"`
	CallCount int    `json:"callCount"`
}

// gRPC related types as defined in: https://github.com/jaegertracing/jaeger-idl/blob/main/swagger/api_v3/query_service.swagger.json
type GrpcServicesResponse struct {
	Services []string `json:"services"`
}

type GrpcOperationsResponse struct {
	Operations []GrpcOperation `json:"operations"`
}

type GrpcOperation struct {
	Name     string `json:"name"`
	SpanKind string `json:"spanKind"`
}
