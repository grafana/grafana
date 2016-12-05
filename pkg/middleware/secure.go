package middleware

import (
	"net/http"

	"gopkg.in/macaron.v1"
	"gopkg.in/unrolled/secure.v1"
)

func Secure(options secure.Options) macaron.Handler {
	middleware := secure.New(options)
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		err := middleware.Process(res, req)
		if err == nil {
			c.Next()
		}
	}
}
