package api

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/torkelo/grafana-pro/pkg/log"
)

var (
	green  = string([]byte{27, 91, 57, 55, 59, 52, 50, 109})
	white  = string([]byte{27, 91, 57, 48, 59, 52, 55, 109})
	yellow = string([]byte{27, 91, 57, 55, 59, 52, 51, 109})
	red    = string([]byte{27, 91, 57, 55, 59, 52, 49, 109})
	reset  = string([]byte{27, 91, 48, 109})
)

func ignoreLoggingRequest(code int, contentType string) bool {
	return code == 304 ||
		strings.HasPrefix(contentType, "application/javascript") ||
		strings.HasPrefix(contentType, "text/") ||
		strings.HasPrefix(contentType, "application/x-font-woff")
}

func apiLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		code := c.Writer.Status()
		contentType := c.Writer.Header().Get("Content-Type")

		// ignore logging some requests
		if ignoreLoggingRequest(code, contentType) {
			return
		}

		// save the IP of the requester
		requester := c.Request.Header.Get("X-Real-IP")
		// if the requester-header is empty, check the forwarded-header
		if len(requester) == 0 {
			requester = c.Request.Header.Get("X-Forwarded-For")
		}
		// if the requester is still empty, use the hard-coded address from the socket
		if len(requester) == 0 {
			requester = c.Request.RemoteAddr
		}

		end := time.Now()
		latency := end.Sub(start)
		log.Info("[http] %s %s %3d %12v %s %s",
			c.Request.Method, c.Request.URL.Path,
			code,
			latency,
			requester,
			c.Errors.String(),
		)
	}
}
