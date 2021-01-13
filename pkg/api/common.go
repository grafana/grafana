package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

var (
	ServerError = func(err error) Response {
		return Error(500, "Server error", err)
	}
)

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

// JSON creates a JSON response.
func JSON(status int, body interface{}) *NormalResponse {
	return Respond(status, body).Header("Content-Type", "application/json")
}

// jsonStreaming creates a streaming JSON response.
func jsonStreaming(status int, body interface{}) streamingResponse {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return streamingResponse{
		status: status,
		body:   body,
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
		body:   b,
		status: status,
		header: make(http.Header),
	}
}

func Redirect(location string) *RedirectResponse {
	return &RedirectResponse{location: location}
}
