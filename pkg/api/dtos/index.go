package dtos

import (
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/setting"

	"html/template"
)

type IndexViewData struct {
	User                    *CurrentUser
	Settings                map[string]interface{}
	AppUrl                  string
	AppSubUrl               string
	GoogleAnalyticsId       string
	GoogleAnalytics4Id      string
	GoogleTagManagerId      string
	NavTree                 []*navtree.NavLink
	BuildVersion            string
	BuildCommit             string
	Theme                   string
	NewGrafanaVersionExists bool
	NewGrafanaVersion       string
	AppName                 string
	AppNameBodyClass        string
	FavIcon                 template.URL
	AppleTouchIcon          template.URL
	AppTitle                string
	Sentry                  *setting.Sentry
	ContentDeliveryURL      string
	LoadingLogo             template.URL
	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string

	// @PERCONA
	Env string
}
