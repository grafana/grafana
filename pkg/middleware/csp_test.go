package middleware

import (
	"regexp"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCSPHeaders(t *testing.T) {
	const dfltTemplate = "script-src 'unsafe-eval' 'strict-dynamic' $NONCE;object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data:;base-uri 'self';connect-src 'self' grafana.com;manifest-src 'self';media-src 'none';block-all-mixed-content;"
	reCSP := regexp.MustCompile(`script-src 'unsafe-eval' 'strict-dynamic' 'nonce-[^;']{22}';object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline';img-src 'self' data:;base-uri 'self';connect-src 'self' grafana.com;manifest-src 'self';media-src 'none';block-all-mixed-content;`)

	middlewareScenario(t, "Middleware should inject Content Security Policy header when enabled",
		func(t *testing.T, sc *scenarioContext) {
			sc.fakeReq("GET", "/api/").exec()
			got := sc.resp.Header().Get("Content-Security-Policy")
			t.Logf("Got CSP header %q", got)
			assert.Regexp(t, reCSP, got)
		}, func(cfg *setting.Cfg) {
			cfg.CSPEnabled = true
			cfg.CSPTemplate = dfltTemplate
		})

	middlewareScenario(t, "Middleware should not inject Content Security Policy header when disabled",
		func(t *testing.T, sc *scenarioContext) {
			require.False(t, sc.cfg.CSPEnabled, "CSP should be disabled by default")
			sc.fakeReq("GET", "/api/").exec()
			assert.Empty(t, sc.resp.Header().Get("Content-Security-Policy"))
		}, func(cfg *setting.Cfg) {
			cfg.CSPTemplate = dfltTemplate
		})
}
