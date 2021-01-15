package response

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
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

func CreateStreamingResponse(header http.Header, body interface{}, status int) StreamingResponse {
	return StreamingResponse{
		header: header,
		body:   body,
		status: status,
	}
}

func CreateRedirectResponse(location string) *RedirectResponse {
	return &RedirectResponse{
		location: location,
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

// SetStatus sets the response's status.
func (r *NormalResponse) SetStatus(status int) {
	r.status = status
}

// Body gets the response's body.
func (r *NormalResponse) Body() []byte {
	return r.body
}

// Err gets the response's err.
func (r *NormalResponse) Err() error {
	return r.err
}

// SetErr sets the response's err.
func (r *NormalResponse) SetErr(err error) {
	r.err = err
}

// ErrMessage gets the response's errMessage.
func (r *NormalResponse) ErrMessage() string {
	return r.errMessage
}

// SetErrMessage sets the response's errMessage.
func (r *NormalResponse) SetErrMessage(errMessage string) {
	r.errMessage = errMessage
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
