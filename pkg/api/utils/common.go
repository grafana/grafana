package utils

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

var (
	ServerError = func(err error) response.Response {
		return Error(500, "Server error", err)
	}
)

func Wrap(action interface{}) macaron.Handler {
	return func(c *models.ReqContext) {
		var res response.Response
		val, err := c.Invoke(action)
		if err == nil && val != nil && len(val) > 0 {
			res = val[0].Interface().(response.Response)
		} else {
			res = ServerError(err)
		}

		res.WriteTo(c)
	}
}

// JSON creates a JSON response.
func JSON(status int, body interface{}) *response.NormalResponse {
	return Respond(status, body).Header("Content-Type", "application/json")
}

// JSONStreaming creates a streaming JSON response.
func JSONStreaming(status int, body interface{}) response.StreamingResponse {
	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return response.CreateStreamingResponse(header, body, status)
}

// Success create a successful response
func Success(message string) *response.NormalResponse {
	resp := make(map[string]interface{})
	resp["message"] = message
	return JSON(200, resp)
}

// Error creates an error response.
func Error(status int, message string, err error) *response.NormalResponse {
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
		resp.SetErrMessage(message)
		resp.SetErr(err)
	}

	return resp
}

// Empty creates an empty NormalResponse.
func Empty(status int) *response.NormalResponse {
	return Respond(status, nil)
}

// Respond creates a response.
func Respond(status int, body interface{}) *response.NormalResponse {
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
	return response.CreateNormalResponse(make(http.Header), b, status)
}

func Redirect(location string) *response.RedirectResponse {
	return response.CreateRedirectResponse(location)
}
