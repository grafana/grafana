package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateHostHeader(t *testing.T) {
	t.Run("without sub path", func(t *testing.T) {
		testValidateHostHeader(t, hostHeaderScenario{
			appURL:           "http://grafana.example.com:3000/",
			url:              "/connections/datasources",
			host:             "other.example.com",
			expectedRedirect: "http://grafana.example.com:3000/connections/datasources",
		})
	})

	t.Run("with serve_from_sub_path the sub path is not duplicated", func(t *testing.T) {
		testValidateHostHeader(t, hostHeaderScenario{
			appURL:           "http://grafana.example.com:3000/grafana/",
			appSubURL:        "/grafana",
			url:              "/grafana/connections/datasources",
			host:             "other.example.com",
			expectedRedirect: "http://grafana.example.com:3000/grafana/connections/datasources",
		})
	})

	t.Run("with sub path stripped by a reverse proxy", func(t *testing.T) {
		testValidateHostHeader(t, hostHeaderScenario{
			appURL:           "http://grafana.example.com:3000/grafana/",
			appSubURL:        "/grafana",
			url:              "/connections/datasources",
			host:             "other.example.com",
			expectedRedirect: "http://grafana.example.com:3000/grafana/connections/datasources",
		})
	})

	t.Run("query parameters are preserved", func(t *testing.T) {
		testValidateHostHeader(t, hostHeaderScenario{
			appURL:           "http://grafana.example.com:3000/grafana/",
			appSubURL:        "/grafana",
			url:              "/grafana/connections/datasources?search=loki",
			host:             "other.example.com",
			expectedRedirect: "http://grafana.example.com:3000/grafana/connections/datasources?search=loki",
		})
	})

	t.Run("matching host is not redirected", func(t *testing.T) {
		testValidateHostHeader(t, hostHeaderScenario{
			appURL: "http://grafana.example.com:3000/",
			url:    "/connections/datasources",
			host:   "grafana.example.com:3000",
		})
	})
}

type hostHeaderScenario struct {
	appURL           string
	appSubURL        string
	url              string
	host             string
	expectedRedirect string
}

func testValidateHostHeader(t *testing.T, ts hostHeaderScenario) {
	middlewareScenario(t, "GET "+ts.url, func(t *testing.T, sc *scenarioContext) {
		sc.cfg.Domain = "grafana.example.com"
		sc.cfg.AppURL = ts.appURL
		sc.cfg.AppSubURL = ts.appSubURL
		if ts.appSubURL != "" {
			sc.m.SetURLPrefix(ts.appSubURL)
		}

		sc.m.Use(ValidateHostHeader(sc.cfg))
		sc.m.Get("/connections/datasources", sc.defaultHandler)

		sc.fakeReqWithParams("GET", ts.url, map[string]string{})
		sc.req.Host = ts.host
		sc.exec()

		if ts.expectedRedirect != "" {
			assert.Equal(t, 301, sc.resp.Code)

			// nolint:bodyclose
			resp := sc.resp.Result()
			t.Cleanup(func() {
				err := resp.Body.Close()
				assert.NoError(t, err)
			})
			redirectURL, err := resp.Location()
			require.NoError(t, err)

			assert.Equal(t, ts.expectedRedirect, redirectURL.String())
		} else {
			assert.Equal(t, 200, sc.resp.Code)
		}
	})
}
