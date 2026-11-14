package clients

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
)

func TestFailureLimiter(t *testing.T) {
	now := time.Now()
	l := newFailureLimiter(3, time.Minute)

	for range 3 {
		require.False(t, l.blocked("1.1.1.1", now))
		l.record("1.1.1.1", now)
	}
	require.True(t, l.blocked("1.1.1.1", now))
	require.False(t, l.blocked("2.2.2.2", now), "other IPs are unaffected")
	require.False(t, l.blocked("1.1.1.1", now.Add(time.Minute)), "window expires")
}

func TestRequestIPIgnoresForwardingHeaders(t *testing.T) {
	h := http.Header{}
	h.Set("X-Forwarded-For", "1.2.3.4")
	h.Set("X-Real-IP", "5.6.7.8")
	r := &authn.Request{HTTPRequest: &http.Request{Header: h, RemoteAddr: "10.0.0.9:51234"}}
	require.Equal(t, "10.0.0.9", requestIP(r))
	r.HTTPRequest.RemoteAddr = "[::1]:80"
	require.Equal(t, "::1", requestIP(r))
}
