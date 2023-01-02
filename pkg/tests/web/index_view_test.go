package web

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// TestIntegrationIndexView tests the Grafana index view.
func TestIntegrationIndexView(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("CSP enabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
			EnableCSP: true,
		})

		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr)
		assert.Regexp(t, `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' 'nonce-[^']+';object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src \* data:;base-uri 'self';connect-src 'self' grafana.com ws://localhost:3000/ wss://localhost:3000/;manifest-src 'self';media-src 'none';form-action 'self';`, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce="[^"]+"`, html)
	})

	t.Run("CSP disabled", func(t *testing.T) {
		grafDir, cfgPath := testinfra.CreateGrafDir(t)
		addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)

		// nolint:bodyclose
		resp, html := makeRequest(t, addr)

		assert.Empty(t, resp.Header.Get("Content-Security-Policy"))
		assert.Regexp(t, `<script nonce=""`, html)
	})
}

func makeRequest(t *testing.T, addr string) (*http.Response, string) {
	t.Helper()

	u := fmt.Sprintf("http://%s", addr)
	t.Logf("Making GET request to %s", u)
	// nolint:gosec
	resp, err := http.Get(u)
	require.NoError(t, err)
	require.NotNil(t, resp)
	t.Cleanup(func() {
		err := resp.Body.Close()
		assert.NoError(t, err)
	})

	var b strings.Builder
	_, err = io.Copy(&b, resp.Body)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	return resp, b.String()
}
