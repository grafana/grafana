package response

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"

	jsoniter "github.com/json-iterator/go"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

var errRequestCanceledBase = errutil.ClientClosedRequest("api.requestCanceled",
	errutil.WithPublicMessage("Request canceled"))

// Response is an HTTP response interface.
type Response interface {
	// WriteTo writes to a context.
	WriteTo(ctx *contextmodel.ReqContext)
	// Body gets the response's body.
	Body() []byte
	// Status gets the response's status.
	Status() int
}

func CreateNormalResponse(header http.Header, body []byte, status int) *NormalResponse {
	return &NormalResponse{
		header: header,
		body:   bytes.NewBuffer(body),
		status: status,
	}
}

type NormalResponse struct {
	status     int
	body       *bytes.Buffer
	header     http.Header
	errMessage string
	err        error
}

// Write implements http.ResponseWriter
func (r *NormalResponse) Write(b []byte) (int, error) {
	return r.body.Write(b)
}

// Header implements http.ResponseWriter
func (r *NormalResponse) Header() http.Header {
	return r.header
}

// WriteHeader implements http.ResponseWriter
func (r *NormalResponse) WriteHeader(statusCode int) {
	r.status = statusCode
}

// Status gets the response's status.
func (r *NormalResponse) Status() int {
	return r.status
}

// Body gets the response's body.
func (r *NormalResponse) Body() []byte {
	return r.body.Bytes()
}

// Err gets the response's err.
func (r *NormalResponse) Err() error {
	return r.err
}

// ErrMessage gets the response's errMessage.
func (r *NormalResponse) ErrMessage() string {
	return r.errMessage
}

func (r *NormalResponse) WriteTo(ctx *contextmodel.ReqContext) {
	if r.err != nil {
		grafanaErr := errutil.Error{}
		if errors.As(r.err, &grafanaErr) && grafanaErr.Source.IsDownstream() {
			requestmeta.WithDownstreamStatusSource(ctx.Req.Context())
		}

		if errutil.HasUnifiedLogging(ctx.Req.Context()) {
			ctx.Error = r.err
		} else {
			r.writeLogLine(ctx)
		}
	}

	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)
	if _, err := ctx.Resp.Write(r.body.Bytes()); err != nil {
		ctx.Logger.Error("Error writing to response", "err", err)
	}
}

func (r *NormalResponse) writeLogLine(c *contextmodel.ReqContext) {
	v := map[string]any{}
	traceID := tracing.TraceIDFromContext(c.Req.Context(), false)
	if err := json.Unmarshal(r.body.Bytes(), &v); err == nil {
		v["traceID"] = traceID
		if b, err := json.Marshal(v); err == nil {
			r.body = bytes.NewBuffer(b)
		}
	}

	logger := c.Logger.Error
	var gfErr errutil.Error
	if errors.As(r.err, &gfErr) {
		logger = gfErr.LogLevel.LogFunc(c.Logger)
	}
	logger(r.errMessage, "error", r.err, "remote_addr", c.RemoteAddr(), "traceID", traceID)
}

func (r *NormalResponse) SetHeader(key, value string) *NormalResponse {
	r.header.Set(key, value)
	return r
}

// StreamingResponse is a response that streams itself back to the client.
type StreamingResponse struct {
	body   any
	status int
	header http.Header
}

// Status gets the response's status.
// Required to implement api.Response.
func (r StreamingResponse) Status() int {
	return r.status
}

// Body gets the response's body.
// Required to implement api.Response.
func (r StreamingResponse) Body() []byte {
	return nil
}

// WriteTo writes the response to the provided context.
// Required to implement api.Response.
func (r StreamingResponse) WriteTo(ctx *contextmodel.ReqContext) {
	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)

	// Use a configuration that's compatible with the standard library
	// to minimize the risk of introducing bugs. This will make sure
	// that map keys is ordered.
	jsonCfg := jsoniter.ConfigCompatibleWithStandardLibrary
	enc := jsonCfg.NewEncoder(ctx.Resp)
	if err := enc.Encode(r.body); err != nil {
		ctx.Logger.Error("Error writing to response", "err", err)
	}
}

// RedirectResponse represents a redirect response.
type RedirectResponse struct {
	location string
}

// WriteTo writes to a response.
func (r *RedirectResponse) WriteTo(ctx *contextmodel.ReqContext) {
	ctx.Redirect(r.location)
}

// Status gets the response's status.
// Required to implement api.Response.
func (*RedirectResponse) Status() int {
	return http.StatusFound
}

// Body gets the response's body.
// Required to implement api.Response.
func (r *RedirectResponse) Body() []byte {
	return nil
}

// JSON creates a JSON response.
func JSON(status int, body any) *NormalResponse {
	return Respond(status, body).
		SetHeader("Content-Type", "application/json")
}

// JSONStreaming creates a streaming JSON response.
func JSONStreaming(status int, body any) StreamingResponse {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return StreamingResponse{
		body:   body,
		status: status,
		header: header,
	}
}

// JSONDownload creates a JSON response indicating that it should be downloaded.
func JSONDownload(status int, body any, filename string) *NormalResponse {
	return JSON(status, body).
		SetHeader("Content-Disposition", fmt.Sprintf(`attachment;filename="%s"`, filename))
}

// YAML creates a YAML response.
func YAML(status int, body any) *NormalResponse {
	b, err := yaml.Marshal(body)
	if err != nil {
		return Error(http.StatusInternalServerError, "body yaml marshal", err)
	}
	// As of now, application/yaml is downloaded by default in chrome regardless of Content-Disposition, so we use text/yaml instead.
	return Respond(status, b).
		SetHeader("Content-Type", "text/yaml")
}

// YAMLDownload creates a YAML response indicating that it should be downloaded.
func YAMLDownload(status int, body any, filename string) *NormalResponse {
	return YAML(status, body).
		SetHeader("Content-Type", "application/yaml").
		SetHeader("Content-Disposition", fmt.Sprintf(`attachment;filename="%s"`, filename))
}

// Success create a successful response
func Success(message string) *NormalResponse {
	resp := make(map[string]any)
	resp["message"] = message
	return JSON(http.StatusOK, resp)
}

// Error creates an error response.
func Error(status int, message string, err error) *NormalResponse {
	data := make(map[string]any)

	switch status {
	case 404:
		data["message"] = "Not Found"
	case 500:
		data["message"] = "Internal Server Error"
	}

	if message != "" {
		data["message"] = message
	}

	resp := JSON(status, data)

	if err != nil {
		resp.errMessage = message
		resp.err = err
	}

	return resp
}

// Err creates an error response based on an errutil.Error error.
func Err(err error) *NormalResponse {
	grafanaErr := errutil.Error{}
	if !errors.As(err, &grafanaErr) {
		return Error(http.StatusInternalServerError, "", fmt.Errorf("unexpected error type [%s]: %w", reflect.TypeOf(err), err))
	}

	resp := JSON(grafanaErr.Reason.Status().HTTPStatus(), grafanaErr.Public())
	resp.errMessage = string(grafanaErr.Reason.Status())
	resp.err = grafanaErr

	return resp
}

// ErrOrFallback uses the information in an errutil.Error if available
// and otherwise falls back to the status and message provided as
// arguments.
//
// The signature is equivalent to that of Error which allows us to
// rename this to Error when we're confident that that would be safe to
// do.
// If the error provided is not an errutil.Error and is/wraps context.Canceled
// the function returns an Err(errRequestCanceledBase).
func ErrOrFallback(status int, message string, err error) *NormalResponse {
	grafanaErr := &errutil.Error{}
	if errors.As(err, &grafanaErr) {
		return Err(err)
	}

	if errors.Is(err, context.Canceled) {
		return Err(errRequestCanceledBase.Errorf("response: request canceled: %w", err))
	}

	return Error(status, message, err)
}

// Empty creates an empty NormalResponse.
func Empty(status int) *NormalResponse {
	return Respond(status, nil)
}

// Respond creates a response.
func Respond(status int, body any) *NormalResponse {
	var b []byte
	switch t := body.(type) {
	case []byte:
		b = t
	case string:
		b = []byte(t)
	case nil:
		break
	default:
		var err error
		if b, err = json.Marshal(body); err != nil {
			return Error(http.StatusInternalServerError, "body json marshal", err)
		}
	}

	return &NormalResponse{
		status: status,
		body:   bytes.NewBuffer(b),
		header: make(http.Header),
	}
}

func Redirect(location string) *RedirectResponse {
	return &RedirectResponse{location: location}
}
