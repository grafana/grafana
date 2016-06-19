package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

var (
	NotFound = func() Response {
		return ApiError(404, "Not found", nil)
	}
	ServerError = func(err error) Response {
		return ApiError(500, "Server error", err)
	}
)

type Response interface {
	WriteTo(ctx *middleware.Context)
}

type NormalResponse struct {
	status     int
	body       []byte
	header     http.Header
	errMessage string
	err        error
}

func wrap(action interface{}) macaron.Handler {

	return func(c *middleware.Context) {
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

func (r *NormalResponse) WriteTo(ctx *middleware.Context) {
	if r.err != nil {
		ctx.Logger.Error(r.errMessage, "error", r.err)
	}

	header := ctx.Resp.Header()
	for k, v := range r.header {
		header[k] = v
	}
	ctx.Resp.WriteHeader(r.status)
	ctx.Resp.Write(r.body)
}

func (r *NormalResponse) Cache(ttl string) *NormalResponse {
	return r.Header("Cache-Control", "public,max-age="+ttl)
}

func (r *NormalResponse) Header(key, value string) *NormalResponse {
	r.header.Set(key, value)
	return r
}

// functions to create responses
func Empty(status int) *NormalResponse {
	return Respond(status, nil)
}

func Json(status int, body interface{}) *NormalResponse {
	return Respond(status, body).Header("Content-Type", "application/json")
}

func ApiSuccess(message string) *NormalResponse {
	resp := make(map[string]interface{})
	resp["message"] = message
	return Respond(200, resp)
}

func ApiError(status int, message string, err error) *NormalResponse {
	data := make(map[string]interface{})

	switch status {
	case 404:
		metrics.M_Api_Status_404.Inc(1)
		data["message"] = "Not Found"
	case 500:
		metrics.M_Api_Status_500.Inc(1)
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

	resp := Json(status, data)

	if err != nil {
		resp.errMessage = message
		resp.err = err
	}

	return resp
}

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
			return ApiError(500, "body json marshal", err)
		}
	}
	return &NormalResponse{
		body:   b,
		status: status,
		header: make(http.Header),
	}
}
