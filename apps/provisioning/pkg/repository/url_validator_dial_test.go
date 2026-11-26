package repository

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestURLValidatorDialContext(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) }))
	t.Cleanup(srv.Close)
	_, port, err := net.SplitHostPort(srv.Listener.Addr().String())
	require.NoError(t, err)

	get := func(t *testing.T, entries []string, host string) error {
		t.Helper()
		allowlist, err := NewAllowlist(entries)
		require.NoError(t, err)
		validator := NewURLValidator(allowlist, net.DefaultResolver.LookupIPAddr)

		client := &http.Client{Transport: &http.Transport{
			DialContext: validator.DialContext(&net.Dialer{Timeout: 2 * time.Second}),
		}}
		resp, err := client.Get("http://" + net.JoinHostPort(host, port))
		if err == nil {
			_ = resp.Body.Close()
		}
		return err
	}

	t.Run("loopback is refused at dial time", func(t *testing.T) {
		assert.ErrorContains(t, get(t, nil, "127.0.0.1"), "blocked IP")
	})
	t.Run("a name that resolves to loopback is refused", func(t *testing.T) {
		assert.ErrorContains(t, get(t, nil, "localhost"), "blocked IP")
	})
	t.Run("an allowlisted address is dialed", func(t *testing.T) {
		assert.NoError(t, get(t, []string{"127.0.0.1"}, "127.0.0.1"))
	})
	t.Run("an allowlisted host is dialed whatever it resolves to", func(t *testing.T) {
		assert.NoError(t, get(t, []string{"localhost"}, "localhost"))
	})
	t.Run("an allowlisted network is dialed", func(t *testing.T) {
		assert.NoError(t, get(t, []string{"127.0.0.0/8"}, "127.0.0.1"))
	})
}
