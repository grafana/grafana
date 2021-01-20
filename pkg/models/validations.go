package models

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type PluginRequestValidator interface {
	// Validate performs a request validation based
	// on some plugin's settings (i.e. datasource.URL)
	// and request contents (headers, cookies, etc).
	Validate(backend.PluginContext, *http.Request) error
}
