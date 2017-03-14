package middleware

import (
	"net/http"

	"gopkg.in/macaron.v1"
)

func MeasureRequestTime() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *Context) {
	}
}
