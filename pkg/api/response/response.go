package response

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	jsoniter "github.com/json-iterator/go"
)

// Response is an HTTP response interface.
type Response interface {
	// WriteTo writes to a context.
	WriteTo(ctx *models.ReqContext)
	// Body gets the response's body.
	Body() []byte
	// Status gets the response's status.
	Status() int
}

func CreateNormalResponse(header http.Header, body []byte, status int) *NormalResponse {
	return &NormalResponse{
		header: header,
		body:   body,
		status: status,
	}
}

type NormalResponse struct {
	status     int
	body       []byte
	header     http.Header
	errMessage string
	err        error
}

// Status gets the response's status.
func (r *NormalResponse) Status() int {
	return r.status
}

// Body gets the response's body.
func (r *NormalResponse) Body() []byte {
	return r.body
}

// Err gets the response's err.
func (r *NormalResponse) Err() error {
	return r.err
}

// ErrMessage gets the response's errMessage.
func (r *NormalResponse) ErrMessage() string {
	return r.errMessage
}

func (r *NormalResponse) WriteTo(ctx *models.ReqContext) {
	if r.err != nil {
		ctx.Logger.Error(r.errMessage, "error", r.err, "remote_addr", ctx.RemoteAddr())
	}

	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)
	if _, err := ctx.Resp.Write(r.body); err != nil {
		ctx.Logger.Error("Error writing to response", "err", err)
	}
}

func (r *NormalResponse) Header(key, value string) *NormalResponse {
	r.header.Set(key, value)
	return r
}

// StreamingResponse is a response that streams itself back to the client.
type StreamingResponse struct {
	body   interface{}
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
func (r StreamingResponse) WriteTo(ctx *models.ReqContext) {
	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)
	enc := jsoniter.NewEncoder(ctx.Resp)
	if err := enc.Encode(r.body); err != nil {
		ctx.Logger.Error("Error writing to response", "err", err)
	}
}

// RedirectResponse represents a redirect response.
type RedirectResponse struct {
	location string
}

// WriteTo writes to a response.
func (r *RedirectResponse) WriteTo(ctx *models.ReqContext) {
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
func JSON(status int, body interface{}) *NormalResponse {
	return Respond(status, body).Header("Content-Type", "application/json")
}

// JSONStreaming creates a streaming JSON response.
func JSONStreaming(status int, body interface{}) StreamingResponse {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return StreamingResponse{
		body:   body,
		status: status,
		header: header,
	}
}

// Success create a successful response
func Success(message string) *NormalResponse {
	resp := make(map[string]interface{})
	resp["message"] = message
	return JSON(200, resp)
}

// Error creates an error response.
func Error(status int, message string, err error) *NormalResponse {
	data := make(map[string]interface{})

	switch status {
	case 404:
		data["message"] = "Not Found"
	case 500:
		data["message"] = "Internal Server Error"
	}

	if message != "" {
		data["message"] = message
	}

	if err != nil {
		if setting.Env != setting.Prod {
			data["error"] = err.Error()
		}
	}

	resp := JSON(status, data)

	if err != nil {
		resp.errMessage = message
		resp.err = err
	}

	return resp
}

// Empty creates an empty NormalResponse.
func Empty(status int) *NormalResponse {
	return Respond(status, nil)
}

// Respond creates a response.
func Respond(status int, body interface{}) *NormalResponse {
	var b []byte
	switch t := body.(type) {
	case []byte:
		b = t
	case string:
		b = []byte(t)
	default:
		var err error
		if b, err = json.Marshal(body); err != nil {
			return Error(500, "body json marshal", err)
		}
	}

	return &NormalResponse{
		status: status,
		body:   b,
		header: make(http.Header),
	}
}

func Redirect(location string) *RedirectResponse {
	return &RedirectResponse{location: location}
}
