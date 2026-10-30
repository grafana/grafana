package frontend

import (
	"fmt"
	"html"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestFrontendService_Meticulous(t *testing.T) {
	for _, tc := range []struct {
		name         string
		enabled      bool
		production   bool
		token        string
		hosts        []string
		host         string
		wantRecorder bool
	}{
		{name: "disabled", token: "test-token", host: "play.grafana.org"},
		{name: "missing token", enabled: true, host: "play.grafana.org"},
		{name: "production", enabled: true, production: true, token: "test-token", hosts: []string{"play.grafana.org"}, host: "play.grafana.org", wantRecorder: true},
		{name: "development", enabled: true, token: "test-token", hosts: []string{"localhost:3000"}, host: "localhost:3000", wantRecorder: true},
		{name: "other tenant", enabled: true, token: "test-token", hosts: []string{"play.grafana.org"}, host: "customer.grafana.net"},
		{name: "suffix lookalike", enabled: true, token: "test-token", hosts: []string{"play.grafana.org"}, host: "play.grafana.org.example.com"},
		{name: "port must match", enabled: true, token: "test-token", hosts: []string{"localhost:3000"}, host: "localhost:3001"},
		{name: "empty allowlist", enabled: true, token: "test-token", host: "localhost:3000", wantRecorder: true},
		{name: "wildcard is literal", enabled: true, token: "test-token", hosts: []string{"*"}, host: "localhost:3000"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				Raw: ini.Empty(), HTTPPort: "3000", StaticRootPath: setupTestWebAssets(t), Env: setting.Dev,
				CSPEnabled: true, CSPTemplate: "script-src 'self' $NONCE",
				Meticulous: setting.MeticulousSettings{Enabled: tc.enabled, Production: tc.production, RecordingToken: tc.token, AllowedHosts: tc.hosts},
			}
			service := createTestService(t, cfg)
			mux := web.New()
			service.addMiddlewares(mux)
			service.registerRoutes(mux)
			req := httptest.NewRequest("GET", "http://"+tc.host+"/", nil)
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, req)
			require.Equal(t, 200, response.Code)
			body := response.Body.String()
			if !tc.wantRecorder {
				assert.NotContains(t, body, "https://snippet.meticulous.ai/v1/meticulous.js")
				assert.NotContains(t, body, "data-recording-token")
				return
			}
			script := regexp.MustCompile(`(?s)<script\s+data-is-production-environment=.*?</script>`).FindString(body)
			require.NotEmpty(t, script)
			assert.Contains(t, script, "https://snippet.meticulous.ai/v1/meticulous.js")
			assert.Contains(t, script, fmt.Sprintf(`data-is-production-environment="%t"`, tc.production))
			assert.Contains(t, script, `data-recording-token="`+tc.token+`"`)
			nonce := regexp.MustCompile(`'nonce-([^']+)'`).FindStringSubmatch(response.Header().Get("Content-Security-Policy"))
			require.Len(t, nonce, 2)
			assert.Contains(t, html.UnescapeString(script), `nonce="`+nonce[1]+`"`)
		})
	}
}
