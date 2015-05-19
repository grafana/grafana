package api

import (
	"encoding/json"
	"net/http"

	"github.com/Unknwon/macaron"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	NotFound    = ApiError(404, "Not found", nil)
	ServerError = ApiError(500, "Server error", nil)
)

type Response interface {
	WriteTo(out http.ResponseWriter)
}

type NormalResponse struct {
	status int
	body   []byte
	header http.Header
}

func wrap(action interface{}) macaron.Handler {

	return func(c *middleware.Context) {
		var res Response
		val, err := c.Invoke(action)
		if err == nil && val != nil && len(val) > 0 {
			res = val[0].Interface().(Response)
		} else {
			res = ServerError
		}

		res.WriteTo(c.Resp)
	}
}

func (r *NormalResponse) WriteTo(out http.ResponseWriter) {
	header := out.Header()
	for k, v := range r.header {
		header[k] = v
	}
	out.WriteHeader(r.status)
	out.Write(r.body)
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
	resp := make(map[string]interface{})

	if err != nil {
		log.Error(4, "%s: %v", message, err)
		if setting.Env != setting.PROD {
			resp["error"] = err.Error()
		}
	}

	switch status {
	case 404:
		resp["message"] = "Not Found"
		metrics.M_Api_Status_500.Inc(1)
	case 500:
		metrics.M_Api_Status_404.Inc(1)
		resp["message"] = "Internal Server Error"
	}

	if message != "" {
		resp["message"] = message
	}

	return Json(status, resp)
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
