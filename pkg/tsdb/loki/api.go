package loki

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/converter"
)

type LokiAPI struct {
	client *http.Client
	url    string
	log    log.Logger
	tracer tracing.Tracer
}

type RawLokiResponse struct {
	Body     []byte
	Status   int
	Encoding string
}

func newLokiAPI(client *http.Client, url string, log log.Logger, tracer tracing.Tracer) *LokiAPI {
	return &LokiAPI{client: client, url: url, log: log, tracer: tracer}
}

func makeDataRequest(ctx context.Context, lokiDsUrl string, query lokiQuery) (*http.Request, error) {
	qs := url.Values{}
	qs.Set("query", query.Expr)

	qs.Set("direction", string(query.Direction))

	// MaxLines defaults to zero when not received,
	// and Loki does not like limit=0, even when it is not needed
	// (for example for metric queries), so we
	// only send it when it's set
	if query.MaxLines > 0 {
		qs.Set("limit", fmt.Sprintf("%d", query.MaxLines))
	}

	lokiUrl, err := url.Parse(lokiDsUrl)
	if err != nil {
		return nil, err
	}

	switch query.QueryType {
	case QueryTypeRange:
		{
			qs.Set("start", strconv.FormatInt(query.Start.UnixNano(), 10))
			qs.Set("end", strconv.FormatInt(query.End.UnixNano(), 10))
			// NOTE: technically for streams-producing queries `step`
			// is ignored, so it would be nicer to not send it in such cases,
			// but we cannot detect that situation, so we always send it.
			// it should not break anything.
			// NOTE2: we do this at millisecond precision for two reasons:
			//  a. Loki cannot do steps with better precision anyway,
			//     so the microsecond & nanosecond part can be ignored.
			//  b. having it always be number+'ms' makes it more robust and
			//     precise, as Loki does not support step with float number
			//     and time-specifier, like "1.5s"
			qs.Set("step", fmt.Sprintf("%dms", query.Step.Milliseconds()))
			lokiUrl.Path = path.Join(lokiUrl.Path, "/loki/api/v1/query_range")
		}
	case QueryTypeInstant:
		{
			qs.Set("time", strconv.FormatInt(query.End.UnixNano(), 10))
			lokiUrl.Path = path.Join(lokiUrl.Path, "/loki/api/v1/query")
		}
	default:
		return nil, fmt.Errorf("invalid QueryType: %v", query.QueryType)
	}

	lokiUrl.RawQuery = qs.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", lokiUrl.String(), nil)
	if err != nil {
		return nil, err
	}

	if query.SupportingQueryType != SupportingQueryNone {
		value := getSupportingQueryHeaderValue(req, query.SupportingQueryType)
		if value != "" {
			req.Header.Set("X-Query-Tags", "Source="+value)
		}
	}

	return req, nil
}

type lokiResponseError struct {
	Message string `json:"message"`
	TraceID string `json:"traceID,omitempty"`
}

type lokiError struct {
	Message string
}

func makeLokiError(bytes []byte) error {
	var data lokiError
	err := json.Unmarshal(bytes, &data)
	if err != nil {
		// we were unable to convert the bytes to JSON, we return the whole text
		return fmt.Errorf("%v", string(bytes))
	}

	if data.Message == "" {
		// we got no usable error message, we return the whole text
		return fmt.Errorf("%v", string(bytes))
	}

	return fmt.Errorf("%v", data.Message)
}

// we know there is an error,
// based on the http-response-body
// we have to make an informative error-object
func readLokiError(body io.ReadCloser) error {
	var buf bytes.Buffer
	_, err := buf.ReadFrom(body)
	if err != nil {
		return err
	}

	bytes := buf.Bytes()

	// the error-message is probably a JSON structure,
	// with a string-field named "message". we want the
	// value of that field.
	// but, the response might be just a simple string,
	// this was used in older Loki versions.
	// so our approach is this:
	// - we try to convert the bytes to JSON
	// - we take the value of the field "message"
	// - if any of these steps fail, or if "message" is empty, we return the whole text

	return makeLokiError(bytes)
}

func (api *LokiAPI) DataQuery(ctx context.Context, query lokiQuery, responseOpts ResponseOpts) (data.Frames, error) {
	req, err := makeDataRequest(ctx, api.url, query)
	if err != nil {
		return nil, err
	}

	queryAttrs := []any{"start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr, "queryType", query.QueryType, "direction", query.Direction, "maxLines", query.MaxLines, "supportingQueryType", query.SupportingQueryType, "lokiHost", req.URL.Host, "lokiPath", req.URL.Path}
	api.log.Debug("Sending query to loki", queryAttrs...)
	start := time.Now()
	resp, err := api.client.Do(req)
	if err != nil {
		status := "error"
		if errors.Is(err, context.Canceled) {
			status = "cancelled"
		}
		lp := []any{"error", err, "status", status, "duration", time.Since(start), "stage", stageDatabaseRequest}
		lp = append(lp, queryAttrs...)
		if resp != nil {
			lp = append(lp, "statusCode", resp.StatusCode)
		}
		api.log.Error("Error received from Loki", lp...)
		return nil, err
	}

	api.log.Info("Response received from loki", "duration", time.Since(start), "statusCode", resp.StatusCode, "contentLength", resp.Header.Get("Content-Length"), "stage", stageDatabaseRequest, "status", "ok", "query", query.Expr)

	defer func() {
		if err := resp.Body.Close(); err != nil {
			api.log.Warn("Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode/100 != 2 {
		err := readLokiError(resp.Body)
		api.log.Error("Error received from loki", "error", err, "status", resp.StatusCode)
		return nil, err
	}

	start = time.Now()
	_, span := api.tracer.Start(ctx, "datasource.loki.parseResponse")
	span.SetAttributes("metricDataplane", responseOpts.metricDataplane, attribute.Key("metricDataplane").Bool(responseOpts.metricDataplane))
	defer span.End()

	iter := jsoniter.Parse(jsoniter.ConfigDefault, resp.Body, 1024)
	res := converter.ReadPrometheusStyleResult(iter, converter.Options{Dataplane: responseOpts.metricDataplane})

	if res.Error != nil {
		span.RecordError(res.Error)
		span.SetStatus(codes.Error, err.Error())
		api.log.Error("Error parsing response from loki", "error", res.Error, "metricDataplane", responseOpts.metricDataplane, "duration", time.Since(start), "stage", stageParseResponse)
		return nil, res.Error
	}

	api.log.Info("Response parsed from loki", "duration", time.Since(start), "metricDataplane", responseOpts.metricDataplane, "framesLength", len(res.Frames), "stage", stageParseResponse)

	return res.Frames, nil
}

func makeRawRequest(ctx context.Context, lokiDsUrl string, resourcePath string) (*http.Request, error) {
	lokiUrl, err := url.Parse(lokiDsUrl)
	if err != nil {
		return nil, err
	}

	resourceUrl, err := url.Parse(resourcePath)
	if err != nil {
		return nil, err
	}

	// we take the path and the query-string only
	lokiUrl.RawQuery = resourceUrl.RawQuery
	lokiUrl.Path = path.Join(lokiUrl.Path, resourceUrl.Path)

	req, err := http.NewRequestWithContext(ctx, "GET", lokiUrl.String(), nil)

	if err != nil {
		return nil, err
	}

	return req, nil
}

func (api *LokiAPI) RawQuery(ctx context.Context, resourcePath string) (RawLokiResponse, error) {
	api.log.Debug("Sending raw query to loki", "resourcePath", resourcePath)
	req, err := makeRawRequest(ctx, api.url, resourcePath)
	if err != nil {
		api.log.Error("Failed to prepare request to loki", "error", err, "resourcePath", resourcePath)
		return RawLokiResponse{}, err
	}
	start := time.Now()
	resp, err := api.client.Do(req)
	if err != nil {
		status := "error"
		if errors.Is(err, context.Canceled) {
			status = "cancelled"
		}
		lp := []any{"error", err, "resourcePath", resourcePath, "status", status, "duration", time.Since(start), "stage", stageDatabaseRequest}
		if resp != nil {
			lp = append(lp, "statusCode", resp.StatusCode)
		}
		api.log.Error("Error received from Loki", lp...)
		return RawLokiResponse{}, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			api.log.Warn("Failed to close response body", "error", err)
		}
	}()

	api.log.Info("Response received from loki", "status", "ok", "statusCode", resp.StatusCode, "contentLength", resp.Header.Get("Content-Length"), "duration", time.Since(start), "contentEncoding", resp.Header.Get("Content-Encoding"), "stage", stageDatabaseRequest)

	// server errors are handled by the plugin-proxy to hide the error message
	if resp.StatusCode/100 == 5 {
		return RawLokiResponse{}, readLokiError(resp.Body)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		api.log.Error("Error reading response body bytes", "error", err)
		return RawLokiResponse{}, err
	}

	// client errors are passed as a json struct to the client
	if resp.StatusCode/100 != 2 {
		lokiResponseErr := lokiResponseError{Message: makeLokiError(body).Error()}
		api.log.Warn("Non 200 HTTP status received from loki", "error", lokiResponseErr.Message, "statusCode", resp.StatusCode, "resourcePath", resourcePath)
		traceID := tracing.TraceIDFromContext(ctx, false)
		if traceID != "" {
			lokiResponseErr.TraceID = traceID
		}
		body, err = json.Marshal(lokiResponseErr)
		if err != nil {
			return RawLokiResponse{}, err
		}
	}

	rawLokiResponse := RawLokiResponse{
		Body:     body,
		Status:   resp.StatusCode,
		Encoding: resp.Header.Get("Content-Encoding"),
	}

	return rawLokiResponse, nil
}

func getSupportingQueryHeaderValue(req *http.Request, supportingQueryType SupportingQueryType) string {
	value := ""
	switch supportingQueryType {
	case SupportingQueryLogsVolume:
		value = "logvolhist"
	case SupportingQueryLogsSample:
		value = "logsample"
	case SupportingQueryDataSample:
		value = "datasample"
	default: //ignore
	}

	return value
}
