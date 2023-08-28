package phlare

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	_ backend.QueryDataHandler    = (*PhlareDatasource)(nil)
	_ backend.CallResourceHandler = (*PhlareDatasource)(nil)
	_ backend.CheckHealthHandler  = (*PhlareDatasource)(nil)
	_ backend.StreamHandler       = (*PhlareDatasource)(nil)
)

// PhlareDatasource is a datasource for querying application performance profiles.
type PhlareDatasource struct {
	httpClient *http.Client
	client     ProfilingClient
	settings   backend.DataSourceInstanceSettings
	ac         accesscontrol.AccessControl
}

type JsonData struct {
	BackendType string `json:"backendType"`
}

// NewPhlareDatasource creates a new datasource instance.
func NewPhlareDatasource(httpClientProvider httpclient.Provider, settings backend.DataSourceInstanceSettings, ac accesscontrol.AccessControl) (instancemgmt.Instance, error) {
	opt, err := settings.HTTPClientOptions()
	if err != nil {
		return nil, err
	}
	httpClient, err := httpClientProvider.New(opt)
	if err != nil {
		return nil, err
	}

	var jsonData *JsonData
	err = json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return nil, err
	}

	return &PhlareDatasource{
		httpClient: httpClient,
		client:     getClient(jsonData.BackendType, httpClient, settings.URL),
		settings:   settings,
		ac:         ac,
	}, nil
}

func (d *PhlareDatasource) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("CallResource", "Path", req.Path, "Method", req.Method, "Body", req.Body)
	if req.Path == "profileTypes" {
		return d.profileTypes(ctx, req, sender)
	}
	if req.Path == "labelNames" {
		return d.labelNames(ctx, req, sender)
	}
	if req.Path == "labelValues" {
		return d.labelValues(ctx, req, sender)
	}
	if req.Path == "backendType" {
		return d.backendType(ctx, req, sender)
	}
	return sender.Send(&backend.CallResourceResponse{
		Status: 404,
	})
}

func (d *PhlareDatasource) profileTypes(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	types, err := d.client.ProfileTypes(ctx)
	if err != nil {
		return err
	}
	bodyData, err := json.Marshal(types)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: bodyData, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

func (d *PhlareDatasource) labelNames(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	u, err := url.Parse(req.URL)
	if err != nil {
		return err
	}
	query := u.Query()
	start, err := strconv.ParseInt(query["start"][0], 10, 64)
	if err != nil {
		return err
	}
	end, err := strconv.ParseInt(query["end"][0], 10, 64)
	if err != nil {
		return err
	}

	res, err := d.client.LabelNames(ctx, query["query"][0], start, end)
	if err != nil {
		return fmt.Errorf("error calling LabelNames: %v", err)
	}
	data, err := json.Marshal(res)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
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

func (d *PhlareDatasource) labelValues(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	u, err := url.Parse(req.URL)
	if err != nil {
		return err
	}
	query := u.Query()
	start, err := strconv.ParseInt(query["start"][0], 10, 64)
	if err != nil {
		return err
	}
	end, err := strconv.ParseInt(query["end"][0], 10, 64)
	if err != nil {
		return err
	}

	res, err := d.client.LabelValues(ctx, query["query"][0], query["label"][0], start, end)
	if err != nil {
		return fmt.Errorf("error calling LabelValues: %v", err)
	}
	data, err := json.Marshal(res)
	if err != nil {
		return err
	}
	err = sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
	if err != nil {
		return err
	}
	return nil
}

type BackendTypeRespBody struct {
	BackendType string `json:"backendType"` // "phlare" or "pyroscope"
}

// backendType is a simplistic test to figure out if we are speaking to phlare or pyroscope backend
func (d *PhlareDatasource) backendType(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	// To prevent any user sending arbitrary URL for us to test with we allow this only for users who can edit the datasource
	// as config page is where this is meant to be used.
	ok, err := d.isUserAllowedToEditDatasource(ctx)
	if err != nil {
		return err
	}

	if !ok {
		return sender.Send(&backend.CallResourceResponse{Headers: req.Headers, Status: 401})
	}

	u, err := url.Parse(req.URL)
	if err != nil {
		return err
	}
	query := u.Query()
	body := &BackendTypeRespBody{BackendType: "unknown"}

	// We take the url from the request query because the data source may not yet be saved in DB with the URL we want
	// to test with (like when filling in the confgi page for the first time)
	url := query["url"][0]

	pyroClient := getClient("pyroscope", d.httpClient, url)
	_, err = pyroClient.ProfileTypes(ctx)

	if err == nil {
		body.BackendType = "pyroscope"
	} else {
		phlareClient := getClient("phlare", d.httpClient, url)
		_, err := phlareClient.ProfileTypes(ctx)
		if err == nil {
			body.BackendType = "phlare"
		}
	}

	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	return sender.Send(&backend.CallResourceResponse{Body: data, Headers: req.Headers, Status: 200})
}

func (d *PhlareDatasource) isUserAllowedToEditDatasource(ctx context.Context) (bool, error) {
	reqCtx := contexthandler.FromContext(ctx)
	uidScope := datasources.ScopeProvider.GetResourceScopeUID(accesscontrol.Parameter(":uid"))

	if reqCtx == nil || reqCtx.SignedInUser == nil {
		return false, nil
	}

	ok, err := d.ac.Evaluate(ctx, reqCtx.SignedInUser, accesscontrol.EvalPermission(datasources.ActionWrite, uidScope))
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}

	return true, nil
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

	if _, err := d.client.ProfileTypes(ctx); err != nil {
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
