package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/rendering"

	"github.com/grafana/grafana/pkg/services/licensing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/middleware"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnvironment(t *testing.T, cfg *setting.Cfg) *macaron.Macaron {
	t.Helper()
	sqlstore.InitTestDB(t)

	r := &rendering.RenderingService{Cfg: cfg}

	hs := &HTTPServer{
		Cfg:           cfg,
		Bus:           bus.New(),
		License:       &licensing.OSSLicensingService{},
		RenderService: r,
	}

	m := macaron.New()
	m.Use(middleware.GetContextHandler(nil, nil, nil))
	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: true,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))
	m.Get("/api/frontend/settings/", hs.GetFrontendSettings)

	return m
}

func TestHTTPServer_GetFrontendSettings_hideVersionAnonyomus(t *testing.T) {
	type buildInfo struct {
		Version string `json:"version"`
		Commit  string `json:"commit"`
		Env     string `json:"env"`
	}
	type settings struct {
		BuildInfo buildInfo `json:"buildInfo"`
	}

	cfg := setting.NewCfg()
	m := setupTestEnvironment(t, cfg)

	req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)

	setting.BuildVersion = "7.8.9"
	setting.BuildCommit = "01234567"
	setting.Env = "testing"

	tests := []struct {
		hideVersion bool
		expected    settings
	}{
		{
			hideVersion: false,
			expected: settings{
				BuildInfo: buildInfo{
					Version: setting.BuildVersion,
					Commit:  setting.BuildCommit,
					Env:     setting.Env,
				},
			},
		},
		{
			hideVersion: true,
			expected: settings{
				BuildInfo: buildInfo{
					Version: "",
					Commit:  "",
					Env:     setting.Env,
				},
			},
		},
	}

	for _, test := range tests {
		setting.AnonymousHideVersion = test.hideVersion
		expected := test.expected

		recorder := httptest.NewRecorder()
		m.ServeHTTP(recorder, req)
		got := settings{}
		err := json.Unmarshal(recorder.Body.Bytes(), &got)
		require.NoError(t, err)

		assert.EqualValues(t, expected, got, "unauthenticated showing version")
	}
}
