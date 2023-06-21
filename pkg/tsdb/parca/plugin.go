package parca

import (
	"context"

	"buf.build/gen/go/parca-dev/parca/bufbuild/connect-go/parca/query/v1alpha1/queryv1alpha1connect"
	v1alpha1 "buf.build/gen/go/parca-dev/parca/protocolbuffers/go/parca/query/v1alpha1"
	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
)

// Make sure ParcaDatasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler, backend.StreamHandler interfaces. Plugin should not
// implement all these interfaces - only those which are required for a particular task.
// For example if plugin does not need streaming functionality then you are free to remove
// methods that implement backend.StreamHandler. Implementing instancemgmt.InstanceDisposer
// is useful to clean up resources used by previous datasource instance when a new datasource
// instance created upon datasource settings changed.
var (
	_ backend.QueryDataHandler    = (*ParcaDatasource)(nil)
	_ backend.CallResourceHandler = (*ParcaDatasource)(nil)
	_ backend.CheckHealthHandler  = (*ParcaDatasource)(nil)
)

// ParcaDatasource is a datasource for querying application performance profiles.
type ParcaDatasource struct {
	client queryv1alpha1connect.QueryServiceClient
}

// NewParcaDatasource creates a new datasource instance.
func NewParcaDatasource(httpClientProvider httpclient.Provider, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opt, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}
	httpClient, err := httpClientProvider.New(opt)
	if err != nil {
		return nil, err
	}

	return &ParcaDatasource{
		client: queryv1alpha1connect.NewQueryServiceClient(httpClient, settings.URL, connect.WithGRPCWeb()),
	}, nil
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *ParcaDatasource) Dispose() {
	// Clean up datasource instance resources.
}

func (d *ParcaDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("CallResource", "Path", req.Path, "Method", req.Method, "Body", req.Body)
	if req.Path == "profileTypes" {
		return d.callProfileTypes(ctx, req, sender)
	}
	if req.Path == "labelNames" {
		return d.callLabelNames(ctx, req, sender)
	}
	if req.Path == "labelValues" {
		return d.callLabelValues(ctx, req, sender)
	}
	return sender.Send(&backend.CallResourceResponse{
		Status: 404,
	})
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *ParcaDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger.Debug("QueryData called", "queries", req.Queries)

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *ParcaDatasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("CheckHealth called")

	status := backend.HealthStatusOk
	message := "Data source is working"

	if _, err := d.client.ProfileTypes(ctx, connect.NewRequest(&v1alpha1.ProfileTypesRequest{})); err != nil {
		status = backend.HealthStatusError
		message = err.Error()
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
