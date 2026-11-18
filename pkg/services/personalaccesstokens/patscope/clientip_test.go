package patscope

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientIP(t *testing.T) {
	req := func(remote, xff string) *http.Request {
		h := http.Header{}
		if xff != "" {
			h.Set("X-Forwarded-For", xff)
		}
		return &http.Request{Header: h, RemoteAddr: remote}
	}
	tp := ParseTrustedProxies("X-Forwarded-For", []string{"10.0.0.0/8", "192.168.1.1", "bogus"})

	require.Equal(t, "10.1.1.1", ClientIP(req("10.1.1.1:1", ""), tp), "no header falls back to the peer")
	require.Equal(t, "203.0.113.7", ClientIP(req("10.1.1.1:1", "203.0.113.7"), tp))
	require.Equal(t, "203.0.113.7", ClientIP(req("192.168.1.1:1", "6.6.6.6, 203.0.113.7, 10.2.2.2"), tp), "rightmost non-proxy wins; spoofed left entries ignored")
	require.Equal(t, "8.8.8.8", ClientIP(req("8.8.8.8:1", "203.0.113.7"), tp), "untrusted peer cannot set the header")
	require.Equal(t, "10.1.1.1", ClientIP(req("10.1.1.1:1", "not-an-ip"), tp), "garbage header falls back to the peer")
	require.Equal(t, "10.1.1.1", ClientIP(req("10.1.1.1:1", "203.0.113.7"), TrustedProxies{}), "disabled by default")
	require.Equal(t, "::1", ClientIP(req("[::1]:80", ""), TrustedProxies{}), "port is stripped")
}
