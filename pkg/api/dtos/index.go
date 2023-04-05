package dtos

import (
	"html/template"

	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/setting"
)

type IndexViewData struct {
	User                                *CurrentUser
	Settings                            *FrontendSettingsDTO
	AppUrl                              string
	AppSubUrl                           string
	GoogleAnalyticsId                   string
	GoogleAnalytics4Id                  string
	GoogleAnalytics4SendManualPageViews bool
	GoogleTagManagerId                  string
	NavTree                             *navtree.NavTreeRoot
	BuildVersion                        string
	BuildCommit                         string
	Theme                               string
	NewGrafanaVersionExists             bool
	NewGrafanaVersion                   string
	AppName                             string
	AppNameBodyClass                    string
	FavIcon                             template.URL
	AppleTouchIcon                      template.URL
	AppTitle                            string
	Sentry                              *setting.Sentry
	ContentDeliveryURL                  string
	LoadingLogo                         template.URL
	CSPEnabled                          bool
	TestModeEnabled                     bool
	TrustedTypesEnabled                 bool
	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce string
}
