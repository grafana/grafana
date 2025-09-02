package pyroscope

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var (
	_ backend.QueryDataHandler    = (*PyroscopeDatasource)(nil)
	_ backend.CallResourceHandler = (*PyroscopeDatasource)(nil)
	_ backend.CheckHealthHandler  = (*PyroscopeDatasource)(nil)
	_ backend.StreamHandler       = (*PyroscopeDatasource)(nil)
)

type ProfilingClient interface {
	ProfileTypes(ctx context.Context, start int64, end int64) ([]*ProfileType, error)
	LabelNames(ctx context.Context, labelSelector string, start int64, end int64) ([]string, error)
	LabelValues(ctx context.Context, label string, labelSelector string, start int64, end int64) ([]string, error)
	GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, limit *int64, step float64) (*SeriesResponse, error)
	GetProfile(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, maxNodes *int64) (*ProfileResponse, error)
	GetSpanProfile(ctx context.Context, profileTypeID string, labelSelector string, spanSelector []string, start int64, end int64, maxNodes *int64) (*ProfileResponse, error)
}

// PyroscopeDatasource is a datasource for querying application performance profiles.
type PyroscopeDatasource struct {
	httpClient *http.Client
	client     ProfilingClient
	settings   backend.DataSourceInstanceSettings
}

// NewPyroscopeDatasource creates a new datasource instance.
func NewPyroscopeDatasource(ctx context.Context, httpClientProvider httpclient.Provider, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	ctxLogger := logger.FromContext(ctx)
	opt, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		ctxLogger.Error("Failed to get HTTP client options", "error", err, "function", logEntrypoint())
		return nil, err
	}
	httpClient, err := httpClientProvider.New(opt)
	if err != nil {
		ctxLogger.Error("Failed to create HTTP client", "error", err, "function", logEntrypoint())
		return nil, err
	}

	return &PyroscopeDatasource{
		httpClient: httpClient,
		client:     NewPyroscopeClient(httpClient, settings.URL),
		settings:   settings,
	}, nil
}

func (d *PyroscopeDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.CallResource", trace.WithAttributes(attribute.String("path", req.Path), attribute.String("method", req.Method)))
	defer span.End()
	ctxLogger.Debug("CallResource", "Path", req.Path, "Method", req.Method, "Body", req.Body, "function", logEntrypoint())
	if req.Path == "profileTypes" {
		return d.profileTypes(ctx, req, sender)
	}
	if req.Path == "labelNames" {
		return d.labelNames(ctx, req, sender)
	}
	if req.Path == "labelValues" {
		return d.labelValues(ctx, req, sender)
	}
	if req.Path == "profileMetadata" {
		return d.profileMetadata(ctx, req, sender)
	}
	return sender.Send(&backend.CallResourceResponse{
		Status: 404,
	})
}

func (d *PyroscopeDatasource) profileTypes(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)

	u, err := url.Parse(req.URL)
	if err != nil {
		ctxLogger.Error("Failed to parse URL", "error", err, "function", logEntrypoint())
		return err
	}
	query := u.Query()

	var start, end int64
	if query.Has("start") && query.Has("end") {
		start, err = strconv.ParseInt(query.Get("start"), 10, 64)
		if err != nil {
			ctxLogger.Error("Failed to parse start as int", "error", err, "function", logEntrypoint())
			return err
		}

		end, err = strconv.ParseInt(query.Get("end"), 10, 64)
		if err != nil {
			ctxLogger.Error("Failed to parse end as int", "error", err, "function", logEntrypoint())
			return err
		}
	} else {
		// Make sure to pass a valid time range to the client as v2 will not work without it.
		start = time.Now().Add(-time.Hour).UnixMilli()
		end = time.Now().Add(time.Hour).UnixMilli()
	}

	types, err := d.client.ProfileTypes(ctx, start, end)
	if err != nil {
		ctxLogger.Error("Received error from client", "error", err, "function", logEntrypoint())
		return err
	}
	bodyData, err := json.Marshal(types)
	if err != nil {
		ctxLogger.Error("Failed to marshal response", "error", err, "function", logEntrypoint())
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: bodyData, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send response", "error", err, "function", logEntrypoint())
		return err
	}
	return nil
}

func (d *PyroscopeDatasource) labelNames(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)

	u, err := url.Parse(req.URL)
	if err != nil {
		ctxLogger.Error("Failed to parse URL", "error", err, "function", logEntrypoint())
		return err
	}
	query := u.Query()

	start, _ := strconv.ParseInt(query.Get("start"), 10, 64)
	end, _ := strconv.ParseInt(query.Get("end"), 10, 64)
	labelSelector := query.Get("query")
	matchers, err := parser.ParseMetricSelector(labelSelector)
	if err != nil {
		ctxLogger.Error("Could not parse label selector", "error", err, "function", logEntrypoint())
		return fmt.Errorf("failed parsing label selector: %v", err)
	}

	labelNames, err := d.client.LabelNames(ctx, labelSelector, start, end)
	if err != nil {
		ctxLogger.Error("Received error from client", "error", err, "function", logEntrypoint())
		return fmt.Errorf("error calling LabelNames: %v", err)
	}

	finalLabels := make([]string, 0)
	for _, label := range labelNames {
		if slices.ContainsFunc(matchers, func(m *labels.Matcher) bool {
			return m.Name == label
		}) {
			continue
		}
		finalLabels = append(finalLabels, label)
	}

	jsonResponse, err := json.Marshal(finalLabels)
	if err != nil {
		ctxLogger.Error("Failed to marshal response", "error", err, "function", logEntrypoint())
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: jsonResponse, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send response", "error", err, "function", logEntrypoint())
		return err
	}
	return nil
}

type LabelValuesPayload struct {
	Query string
	Label string
	Start int64
	End   int64
}

func (d *PyroscopeDatasource) labelValues(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)
	u, err := url.Parse(req.URL)
	if err != nil {
		ctxLogger.Error("Failed to parse URL", "error", err, "function", logEntrypoint())
		return err
	}
	query := u.Query()

	start, _ := strconv.ParseInt(query.Get("start"), 10, 64)
	end, _ := strconv.ParseInt(query.Get("end"), 10, 64)
	label := query.Get("label")

	res, err := d.client.LabelValues(ctx, label, query.Get("query"), start, end)
	if err != nil {
		ctxLogger.Error("Received error from client", "error", err, "function", logEntrypoint())
		return fmt.Errorf("error calling LabelValues: %v", err)
	}

	data, err := json.Marshal(res)
	if err != nil {
		ctxLogger.Error("Failed to marshal response", "error", err, "function", logEntrypoint())
		return err
	}

	err = sender.Send(&backend.CallResourceResponse{Body: data, Status: 200})
	if err != nil {
		ctxLogger.Error("Failed to send response", "error", err, "function", logEntrypoint())
		return err
	}

	return nil
}

// profileMetadata returns the embedded profile-metrics.json data containing metadata
// for all known profile types, including their aggregation type (cumulative/instant),
// units, descriptions, and grouping information.
func (d *PyroscopeDatasource) profileMetadata(ctx context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctxLogger := logger.FromContext(ctx)

	registry := GetProfileMetadataRegistry()

	jsonData, err := json.Marshal(registry.profiles)
	if err != nil {
		ctxLogger.Error("Failed to marshal profile metadata", "error", err, "function", logEntrypoint())
		return sender.Send(&backend.CallResourceResponse{
			Status: 500,
			Body:   []byte(`{"error": "Failed to marshal profile metadata"}`),
		})
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: 200,
		Body:   jsonData,
		Headers: map[string][]string{
			"Content-Type": {"application/json"},
		},
	})
}

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *PyroscopeDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctxLogger := logger.FromContext(ctx)
	ctxLogger.Debug("Processing queries", "queryLength", len(req.Queries), "function", logEntrypoint())

	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for i, q := range req.Queries {
		ctxLogger.Debug("Processing query", "counter", i, "function", logEntrypoint())
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	ctxLogger.Debug("All queries processed", "function", logEntrypoint())
	return response, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *PyroscopeDatasource) CheckHealth(ctx context.Context, _ *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.FromContext(ctx).Debug("CheckHealth called", "function", logEntrypoint())

	status := backend.HealthStatusOk
	message := "Data source is working"

	// Since this is a health check mechanism and we only care about whether the
	// request succeeded or failed, we set the window to be small.
	start := time.Unix(1, 0).UnixMilli()
	end := time.Unix(4, 0).UnixMilli()
	if _, err := d.client.ProfileTypes(ctx, start, end); err != nil {
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
func (d *PyroscopeDatasource) SubscribeStream(_ context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Debug("Subscribing stream called", "function", logEntrypoint())

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
func (d *PyroscopeDatasource) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctxLogger := logger.FromContext(ctx)
	ctxLogger.Debug("Running stream", "path", req.Path, "function", logEntrypoint())

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
			ctxLogger.Info("Context done, finish streaming", "path", req.Path, "function", logEntrypoint())
			return nil
		case <-time.After(time.Second):
			// Send new data periodically.
			frame.Fields[0].Set(0, time.Now())
			frame.Fields[1].Set(0, int64(10*(counter%2+1)))

			counter++

			err := sender.SendFrame(frame, data.IncludeAll)
			if err != nil {
				ctxLogger.Error("Error sending frame", "error", err, "function", logEntrypoint())
				continue
			}
		}
	}
}

// PublishStream is called when a client sends a message to the stream.
func (d *PyroscopeDatasource) PublishStream(ctx context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	logger.FromContext(ctx).Debug("Publishing stream", "function", logEntrypoint())

	// Do not allow publishing at all.
	return &backend.PublishStreamResponse{
		Status: backend.PublishStreamStatusPermissionDenied,
	}, nil
}
