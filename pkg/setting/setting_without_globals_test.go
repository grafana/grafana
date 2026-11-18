package setting

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func stackINI(t *testing.T, rootURL string) *ini.File {
	t.Helper()
	iniFile := ini.Empty()
	server, err := iniFile.NewSection("server")
	require.NoError(t, err)
	_, err = server.NewKey("root_url", rootURL)
	require.NoError(t, err)
	security, err := iniFile.NewSection("security")
	require.NoError(t, err)
	_, err = security.NewKey("cookie_secure", "false")
	require.NoError(t, err)
	_, err = security.NewKey("cookie_samesite", "lax")
	require.NoError(t, err)
	return iniFile
}

func setProcessGlobals(t *testing.T) {
	t.Helper()
	appURL, appSubURL := AppUrl, AppSubUrl
	secure, sameSiteDisabled, sameSiteMode := CookieSecure, CookieSameSiteDisabled, CookieSameSiteMode
	t.Cleanup(func() {
		AppUrl, AppSubUrl = appURL, appSubURL
		CookieSecure, CookieSameSiteDisabled, CookieSameSiteMode = secure, sameSiteDisabled, sameSiteMode
	})
	AppUrl, AppSubUrl = "https://process.example/", ""
	CookieSecure, CookieSameSiteDisabled, CookieSameSiteMode = true, false, http.SameSiteStrictMode
}

func TestNewCfgFromINIFileGlobals(t *testing.T) {
	tests := []struct {
		name         string
		parse        func(*ini.File) (*Cfg, error)
		wantAppURL   string
		wantSubURL   string
		wantSecure   bool
		wantSameSite http.SameSite
	}{
		{
			name:         "NewCfgFromINIFile copies the parsed settings to the globals",
			parse:        NewCfgFromINIFile,
			wantAppURL:   "https://stack.example/grafana/",
			wantSubURL:   "/grafana",
			wantSecure:   false,
			wantSameSite: http.SameSiteLaxMode,
		},
		{
			name:         "NewCfgFromINIFileWithoutGlobals leaves the globals unchanged",
			parse:        NewCfgFromINIFileWithoutGlobals,
			wantAppURL:   "https://process.example/",
			wantSubURL:   "",
			wantSecure:   true,
			wantSameSite: http.SameSiteStrictMode,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setProcessGlobals(t)

			cfg, err := tc.parse(stackINI(t, "https://stack.example/grafana/"))
			require.NoError(t, err)
			require.Equal(t, "https://stack.example/grafana/", cfg.AppURL)
			require.Equal(t, "/grafana", cfg.AppSubURL)
			require.False(t, cfg.CookieSecure)
			require.Equal(t, http.SameSiteLaxMode, cfg.CookieSameSiteMode)

			require.Equal(t, tc.wantAppURL, AppUrl)
			require.Equal(t, tc.wantSubURL, AppSubUrl)
			require.Equal(t, tc.wantSecure, CookieSecure)
			require.False(t, CookieSameSiteDisabled)
			require.Equal(t, tc.wantSameSite, CookieSameSiteMode)
		})
	}
}

func TestNewCfgFromINIFileWithoutGlobalsConcurrently(t *testing.T) {
	const parses = 8
	var wg sync.WaitGroup
	for i := range parses {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rootURL := fmt.Sprintf("https://stack-%d.example/", i)
			cfg, err := NewCfgFromINIFileWithoutGlobals(stackINI(t, rootURL))
			if assert.NoError(t, err) {
				assert.Equal(t, rootURL, cfg.AppURL)
			}
		}()
	}
	wg.Wait()
}
