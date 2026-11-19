// Package legacyapi serves Grafana's legacy /api endpoints by translating
// them to the app platform APIs. Each resource has its own package.
package legacyapi

import (
	"net/http"

	"github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/legacyapi/dashboards"
	"github.com/grafana/grafana/pkg/legacyapi/internal/apis"
)

type Config struct {
	DashboardAPIURL string
	FolderAPIURL    string
	IAMAPIURL       string

	// HTTPClient calls the API servers. When nil, http.DefaultClient is used.
	HTTPClient *http.Client
	// TokenExchanger gets the service's own token, for lookups single-tenant
	// Grafana makes with server privileges.
	TokenExchanger authn.TokenExchanger
}

// NewHandler returns the handler for the legacy endpoints this service
// translates. Requests for any other path get 404.
func NewHandler(cfg Config) http.Handler {
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	mux := http.NewServeMux()
	mux.Handle("GET /api/dashboards/uid/{uid}", &dashboards.GetHandler{
		Dashboards:     apis.NewClient(cfg.DashboardAPIURL, httpClient),
		Folders:        apis.NewClient(cfg.FolderAPIURL, httpClient),
		IAM:            apis.NewClient(cfg.IAMAPIURL, httpClient),
		TokenExchanger: cfg.TokenExchanger,
	})
	return mux
}
