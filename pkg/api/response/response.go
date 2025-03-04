package response

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
	"github.com/launchdarkly/go-jsonstream/v3/jwriter"
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
	body          any
	status        int
	header        http.Header
	queryResponse *backend.QueryDataResponse
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

func (r StreamingResponse) WriteToJSONWriter(jsonWriter *jwriter.Writer) error {
	topLevel := jsonWriter.Object()
	topLevel.Name("results")
	resO := jsonWriter.Object()
	for refid, res := range r.queryResponse.Responses {
		resO.Name(refid)

		res1 := jsonWriter.Object()
		res1.Name("status").Int(r.status)
		res1.Name("frames")

		jsonFrames := jsonWriter.Array()
		if r.queryResponse.PagedResponses {
			for {
				frames, err := r.queryResponse.FrameGenerator()
				if err == nil || err == backend.ErrFrameGeneratorEOF {
					for _, frame := range frames {
						r.processFrame(frame, &jsonFrames, jsonWriter)
					}
				}
				if err != nil {
					break
				}
			}
		} else {
			for _, frame := range res.Frames {
				r.processFrame(frame, &jsonFrames, jsonWriter)
			}
		}

		jsonFrames.End()
		res1.End()
	}
	resO.End()

	topLevel.End()
	jsonWriter.Flush()
	return jsonWriter.Error()
}

func (r StreamingResponse) processFrame(frame *data.Frame, frames *jwriter.ArrayState, jsonWriter *jwriter.Writer) {
	f := frames.Object()
	f.Name("schema")
	s := jsonWriter.Object()

	if frame.Meta != nil {
		s.Name("meta")
		m := jsonWriter.Object()
		if frame.Meta.ExecutedQueryString != "" {
			m.Name("executedQueryString").String(frame.Meta.ExecutedQueryString)
		}
		if customBytes, err := json.Marshal(frame.Meta.Custom); err == nil {
			m.Name("custom").Raw(customBytes)
		}
		m.Name("type").String(string(frame.Meta.Type))
		tv := m.Name("typeVersion").Array()
		tv.Int(int(frame.Meta.TypeVersion[0]))
		tv.Int(int(frame.Meta.TypeVersion[1]))
		tv.End()
		m.End()
	}
	s.Name("refId").String(frame.RefID)
	s.Name("fields")
	fs := jsonWriter.Array()
	for _, field := range frame.Fields {
		fj := jsonWriter.Object()
		fj.Name("name").String(field.Name)

		if len(field.Labels) > 0 {
			l := fj.Name("labels").Object()
			for k, v := range field.Labels {
				l.Name(k).String(v)
			}
			l.End()
		}

		if field.Config != nil {
			c := fj.Name("config").Object()
			if field.Config.Interval > 0 {
				c.Name("interval").Float64(field.Config.Interval)
			}
			if len(field.Config.Links) > 0 {
				ls := c.Name("links").Array()
				for _, link := range field.Config.Links {
					lj := jsonWriter.Object()
					lj.Name("url").String(link.URL)
					lj.Name("targetBlank").Bool(link.TargetBlank)
					lj.Name("title").String(link.Title)
					lj.End()
				}
				ls.End()
			}
			if field.Config.DisplayNameFromDS != "" {
				c.Name("displayNameFromDS").String(field.Config.DisplayNameFromDS)
			}
			if len(field.Config.Custom) > 0 {
				if customBytes, err := json.Marshal(field.Config.Custom); err == nil {
					c.Name("custom").Raw(customBytes)
				}
			}
			c.End()
		}

		typeString := "string"
		switch true {
		case field.Type().Numeric():
			typeString = "number"
		case field.Type().Time():
			typeString = "time"
		}
		fj.Name("type").String(typeString)
		ti := fj.Name("typeInfo").Object()
		ti.Name("frame").String(field.Type().ItemTypeString())
		if field.Type().Nullable() {
			ti.Name("nullable").Bool(true)
		}
		ti.End()
		fj.End()
	}
	fs.End()
	s.End()
	f.Name("data")
	v := jsonWriter.Object()
	v.Name("values")
	vOuter := jsonWriter.Array()
	for _, field := range frame.Fields {
		vInner := jsonWriter.Array()
		for i := 0; i < field.Len(); i++ {
			val, ok := field.ConcreteAt(i)
			switch {
			case field.Type().Numeric():
				if intVal, intOk := val.(int64); intOk {
					vInner.Int(int(intVal))
				} else if floatVal, floatOk := val.(float64); floatOk {
					vInner.Float64(floatVal)
				}
			case field.Type().Time():
				vInner.Int(int(val.(time.Time).UnixMilli()))
			case !ok:
				vInner.Null()
			default:
				vInner.String(val.(string))
			}
		}
		vInner.End()
	}
	vOuter.End()
	v.End()
	f.End()
}

// WriteTo writes the response to the provided context.
// Required to implement api.Response.
func (r StreamingResponse) WriteTo(ctx *contextmodel.ReqContext) {
	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)

	var err error
	if r.queryResponse != nil {
		ctx.Logger.Info("Using json v2 response writer")
		w := jwriter.NewStreamingWriter(ctx.Resp, 1024)
		err = r.WriteToJSONWriter(&w)
	} else {
		// Use a configuration that's compatible with the standard library
		// to minimize the risk of introducing bugs. This will make sure
		// that map keys is ordered.
		jsonCfg := jsoniter.ConfigCompatibleWithStandardLibrary
		enc := jsonCfg.NewEncoder(ctx.Resp)
		err = enc.Encode(r.body)
	}
	if err != nil {
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

// JSONStreamingV2 creates a streaming JSON response.
func JSONStreamingV2(status int, queryData *backend.QueryDataResponse) StreamingResponse {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return StreamingResponse{
		status:        status,
		queryResponse: queryData,
		header:        header,
	}
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
	grafanaErr := errutil.Error{}
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
