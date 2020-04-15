package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

var (
	NotFound = func() Response {
		return Error(404, "Not found", nil)
	}
	ServerError = func(err error) Response {
		return Error(500, "Server error", err)
	}
)

type Response interface {
	WriteTo(ctx *models.ReqContext)
}

type NormalResponse struct {
	status     int
	body       []byte
	header     http.Header
	errMessage string
	err        error
}

func Wrap(action interface{}) macaron.Handler {

	return func(c *models.ReqContext) {
		var res Response
		val, err := c.Invoke(action)
		if err == nil && val != nil && len(val) > 0 {
			res = val[0].Interface().(Response)
		} else {
			res = ServerError(err)
		}

		res.WriteTo(c)
	}
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

func (r *NormalResponse) Cache(ttl string) *NormalResponse {
	return r.Header("Cache-Control", "public,max-age="+ttl)
}

func (r *NormalResponse) Header(key, value string) *NormalResponse {
	r.header.Set(key, value)
	return r
}

// Empty create an empty response
func Empty(status int) *NormalResponse {
	return Respond(status, nil)
}

// JSON create a JSON response
func JSON(status int, body interface{}) *NormalResponse {
	return Respond(status, body).Header("Content-Type", "application/json")
}

// Success create a successful response
func Success(message string) *NormalResponse {
	resp := make(map[string]interface{})
	resp["message"] = message
	return JSON(200, resp)
}

// Error create a erroneous response
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
		if setting.Env != setting.PROD {
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

// Respond create a response
func Respond(status int, body interface{}) *NormalResponse {
	var b []byte
	var err error
	switch t := body.(type) {
	case []byte:
		b = t
	case string:
		b = []byte(t)
	default:
		if b, err = json.Marshal(body); err != nil {
			return Error(500, "body json marshal", err)
		}
	}
	return &NormalResponse{
		body:   b,
		status: status,
		header: make(http.Header),
	}
}

type RedirectResponse struct {
	location string
}

func (r *RedirectResponse) WriteTo(ctx *models.ReqContext) {
	ctx.Redirect(r.location)
}

func Redirect(location string) *RedirectResponse {
	return &RedirectResponse{location: location}
}
