package middleware

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanGetRouteNameFromContext(t *testing.T) {
	tcs := []struct {
		namedHandler string
		path         string

		expected string
	}{
		{namedHandler: "", path: "/public/img/apple-touch-icon.png", expected: "public-assets"},
		{namedHandler: "", path: "/favicon.ico", expected: "public-assets"},
		{namedHandler: "", path: "/robots.txt", expected: "/robots.txt"},
		{namedHandler: "", path: "/debug/pprof/heap", expected: "/debug/pprof-handlers"},
		{namedHandler: "", path: "/debug/pprof/allocs", expected: "/debug/pprof-handlers"},
		{namedHandler: "", path: "/debug/pprof/threadcreate", expected: "/debug/pprof-handlers"},
		{namedHandler: "/api/dashboard/:uid", path: "/api/dashboard/ddfgeasdfr", expected: "/api/dashboard/:uid"},
		{namedHandler: "", path: "/metrics", expected: "/metrics"},
	}

	for _, tc := range tcs {
		req, err := http.NewRequest(http.MethodPost, "https://ops.grafana.net"+tc.path, nil)

		if tc.namedHandler != "" {
			req = req.WithContext(context.WithValue(context.Background(), routeOperationNameKey, tc.namedHandler))
		}

		assert.NoError(t, err)

		handler, _ := routeOperationName(req)
		assert.Equal(t, tc.expected, handler)
	}
}

func TestOperationNameCanOnlyBeSetOnce(t *testing.T) {
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, "https://grafana.com", nil)

	// set the the initial operation name
	req = addRouteNameToContext(req, "first")

	// check that the operation name is set correctly
	value, exists := routeOperationName(req)
	assert.True(t, exists, "route name should exist")
	assert.Equal(t, "first", value)

	// check that it cannot be overwritten
	req = addRouteNameToContext(req, "second")
	value, exists = routeOperationName(req)
	assert.True(t, exists, "route name should exist")
	assert.Equal(t, "first", value)
}
