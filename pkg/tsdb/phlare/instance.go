package phlare

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
	"github.com/grafana/phlare/api/gen/proto/go/querier/v1/querierv1connect"
	typesv1 "github.com/grafana/phlare/api/gen/proto/go/types/v1"
)

var (
	_ backend.QueryDataHandler    = (*PhlareDatasource)(nil)
	_ backend.CallResourceHandler = (*PhlareDatasource)(nil)
	_ backend.CheckHealthHandler  = (*PhlareDatasource)(nil)
	_ backend.StreamHandler       = (*PhlareDatasource)(nil)
)

// PhlareDatasource is a datasource for querying application performance profiles.
type PhlareDatasource struct {
	client querierv1connect.QuerierServiceClient
}

// NewPhlareDatasource creates a new datasource instance.
func NewPhlareDatasource(httpClientProvider httpclient.Provider, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opt, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}
	httpClient, err := httpClientProvider.New(opt)
	if err != nil {
		return nil, err
	}

	return &PhlareDatasource{
		client: querierv1connect.NewQuerierServiceClient(httpClient, settings.URL),
	}, nil
}

func (d *PhlareDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("CallResource", "Path", req.Path, "Method", req.Method, "Body", req.Body)
	if req.Path == "profileTypes" {
		return d.callProfileTypes(ctx, req, sender)
	}
	if req.Path == "labelNames" {
		return d.callLabelNames(ctx, req, sender)
	}
	if req.Path == "series" {
		return d.callSeries(ctx, req, sender)
	}
	return sender.Send(&backend.CallResourceResponse{
		Status: 404,
	})
}

func (d *PhlareDatasource) callProfileTypes(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	res, err := d.client.ProfileTypes(ctx, connect.NewRequest(&querierv1.ProfileTypesRequest{}))
	if err != nil {
		return err
	}
	data, err := json.Marshal(res.Msg.ProfileTypes)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

type SeriesRequestJson struct {
	Matchers []string `json:"matchers"`
}

func (d *PhlareDatasource) callSeries(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	parsedUrl, err := url.Parse(req.URL)
	if err != nil {
		return err
	}
	matchers, ok := parsedUrl.Query()["matchers"]
	if !ok {
		matchers = []string{"{}"}
	}

	res, err := d.client.Series(ctx, connect.NewRequest(&querierv1.SeriesRequest{Matchers: matchers}))
	if err != nil {
		return err
	}

	for _, val := range res.Msg.LabelsSet {
		withoutPrivate := withoutPrivateLabels(val.Labels)
		val.Labels = withoutPrivate
	}

	data, err := json.Marshal(res.Msg.LabelsSet)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

func (d *PhlareDatasource) callLabelNames(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	res, err := d.client.LabelNames(ctx, connect.NewRequest(&querierv1.LabelNamesRequest{}))
	if err != nil {
		return err
	}
	data, err := json.Marshal(res.Msg.Names)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *PhlareDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger.Debug("QueryData called", "Queries", req.Queries)

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
func (d *PhlareDatasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("CheckHealth called")

	status := backend.HealthStatusOk
	message := "Data source is working"

	if _, err := d.client.ProfileTypes(ctx, connect.NewRequest(&querierv1.ProfileTypesRequest{})); err != nil {
		status = backend.HealthStatusError
		message = err.Error()
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

// SubscribeStream is called when a client wants to connect to a stream. This callback
// allows sending the first message.
func (d *PhlareDatasource) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Debug("SubscribeStream called")

	status := backend.SubscribeStreamStatusPermissionDenied
	if req.Path == "stream" {
		// Allow subscribing only on expected path.
		status = backend.SubscribeStreamStatusOK
	}
	return &backend.SubscribeStreamResponse{
		Status: status,
	}, nil
}

// RunStream is called once for any open channel.  Results are shared with everyone
// subscribed to the same channel.
func (d *PhlareDatasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	logger.Debug("RunStream called")

	// Create the same data frame as for query data.
	frame := data.NewFrame("response")

	// Add fields (matching the same schema used in QueryData).
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, make([]time.Time, 1)),
		data.NewField("values", nil, make([]int64, 1)),
	)

	counter := 0

	// Stream data frames periodically till stream closed by Grafana.
	for {
		select {
		case <-ctx.Done():
			logger.Info("Context done, finish streaming", "path", req.Path)
			return nil
		case <-time.After(time.Second):
			// Send new data periodically.
			frame.Fields[0].Set(0, time.Now())
			frame.Fields[1].Set(0, int64(10*(counter%2+1)))

			counter++

			err := sender.SendFrame(frame, data.IncludeAll)
			if err != nil {
				logger.Error("Error sending frame", "error", err)
				continue
			}
		}
	}
}

// PublishStream is called when a client sends a message to the stream.
func (d *PhlareDatasource) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	logger.Debug("PublishStream called")

	// Do not allow publishing at all.
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}

func withoutPrivateLabels(labels []*typesv1.LabelPair) []*typesv1.LabelPair {
	res := make([]*typesv1.LabelPair, 0, len(labels))
	for _, l := range labels {
		if !strings.HasPrefix(l.Name, "__") {
			res = append(res, l)
		}
	}
	return res
}
