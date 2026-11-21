package frontend

import (
	"context"
	"fmt"
	"html"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestFrontendService_Meticulous(t *testing.T) {
	for _, tc := range []struct {
		name         string
		enabled      bool
		production   bool
		token        string
		host         string
		wantRecorder bool
	}{
		{name: "disabled", token: "test-token", host: "play.grafana.org"},
		{name: "missing token", enabled: true, host: "play.grafana.org"},
		{name: "production", enabled: true, production: true, token: "test-token", host: "play.grafana.org", wantRecorder: true},
		{name: "development", enabled: true, token: "test-token", host: "localhost:3000", wantRecorder: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{
				Raw: ini.Empty(), HTTPPort: "3000", StaticRootPath: setupTestWebAssets(t), Env: setting.Dev,
				CSPEnabled: true, CSPTemplate: "script-src 'self' $NONCE",
				Meticulous: setting.MeticulousSettings{Enabled: tc.enabled, Production: tc.production, RecordingToken: tc.token},
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

func TestFrontendService_MeticulousPerStack(t *testing.T) {
	for _, reducedBootData := range []bool{false, true} {
		t.Run(fmt.Sprintf("reduced boot data %t", reducedBootData), func(t *testing.T) {
			if reducedBootData {
				enableReducedBootDataToggle(t)
			}
			cfg := setting.NewCfg()
			cfg.StaticRootPath = setupTestWebAssets(t)
			cfg.Env = setting.Dev
			cfg.Meticulous = setting.MeticulousSettings{Production: true}
			service := createTestService(t, cfg)
			service.settingsService = &mockSettingsService{
				listAsIni: func(ctx context.Context, selector metav1.LabelSelector) (*ini.File, error) {
					if selector.MatchLabels["section"] != "meticulous" {
						if request.NamespaceValue(ctx) == "stacks-analytics-error" {
							return nil, assert.AnError
						}
						return ini.Empty(), nil
					}
					switch request.NamespaceValue(ctx) {
					case "stacks-play", "stacks-analytics-error":
						return ini.Load([]byte("[meticulous]\nenabled = true\nrecording_token = play-token\nproduction = true\n"))
					case "stacks-dev":
						return ini.Load([]byte("[meticulous]\nenabled = true\nrecording_token = dev-token\nproduction = false\n"))
					case "stacks-disabled":
						return ini.Load([]byte("[meticulous]\nenabled = false\nrecording_token = disabled-token\n"))
					case "stacks-missing-token":
						return ini.Load([]byte("[meticulous]\nenabled = true\n"))
					case "stacks-error":
						return nil, assert.AnError
					default:
						return ini.Empty(), nil
					}
				},
			}
			mux := web.New()
			service.addMiddlewares(mux)
			service.registerRoutes(mux)
			for _, tc := range []struct {
				namespace, host, token string
				production             bool
			}{
				{"stacks-play", "play.grafana.org", "play-token", true},
				{"stacks-other", "other.grafana.net", "", false},
				{"stacks-play", "play-alias.example.com", "play-token", true},
				{"stacks-other", "play.grafana.org", "", false},
				{"stacks-dev", "dev.example.com", "dev-token", false},
				{"stacks-disabled", "disabled.example.com", "", false},
				{"stacks-missing-token", "missing.example.com", "", false},
				{"stacks-error", "error.example.com", "", false},
				{"stacks-analytics-error", "play.grafana.org", "play-token", true},
				{"", "play.grafana.org", "", false},
			} {
				t.Run(tc.namespace+"/"+tc.host, func(t *testing.T) {
					req := httptest.NewRequest("GET", "http://"+tc.host+"/", nil)
					if tc.namespace != "" {
						req.Header.Set("baggage", "namespace="+tc.namespace)
					}
					response := httptest.NewRecorder()
					mux.ServeHTTP(response, req)
					require.Equal(t, 200, response.Code)
					body := response.Body.String()
					if tc.token == "" {
						assert.NotContains(t, body, "https://snippet.meticulous.ai/v1/meticulous.js")
						assert.NotContains(t, body, "data-recording-token")
					} else {
						assert.Contains(t, body, `data-recording-token="`+tc.token+`"`)
						assert.Contains(t, body, fmt.Sprintf(`data-is-production-environment="%t"`, tc.production))
					}
				})
			}
			assert.Equal(t, setting.MeticulousSettings{Production: true}, cfg.Meticulous)
		})
	}
}
