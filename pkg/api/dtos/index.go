package dtos

import (
	"html/template"

	"github.com/grafana/grafana/pkg/services/navtree"
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
	ThemeType                           string
	NewGrafanaVersionExists             bool
	NewGrafanaVersion                   string
	AppName                             string
	AppNameBodyClass                    string
	FrontendDevServer                   bool
	FavIcon                             template.URL
	AppleTouchIcon                      template.URL
	AppTitle                            string
	LoadingLogo                         template.URL
	CSPContent                          string
	CSPEnabled                          bool
	IsDevelopmentEnv                    bool
	// Nonce is a cryptographic identifier for use with Content Security Policy.
	Nonce           string
	NewsFeedEnabled bool
	Assets          *EntryPointAssets // Includes CDN info
}

type EntryPointAssets struct {
	ContentDeliveryURL string            `json:"cdn,omitempty"`
	JSFiles            []EntryPointAsset `json:"jsFiles"`
	// CSSFiles           []EntryPointAsset `json:"cssFiles"`
	Dark  string `json:"dark"`
	Light string `json:"light"`
	// Swagger            []EntryPointAsset `json:"swagger"`
	// SwaggerCSSFiles    []EntryPointAsset `json:"swaggerCssFiles"`
}

type EntryPointAsset struct {
	FilePath  string `json:"filePath"`
	Integrity string `json:"integrity"`
}

func (a *EntryPointAssets) SetContentDeliveryURL(prefix string) {
	if prefix == "" {
		return
	}
	a.ContentDeliveryURL = prefix
	a.Dark = prefix + a.Dark
	a.Light = prefix + a.Light
	for i, p := range a.JSFiles {
		a.JSFiles[i].FilePath = prefix + p.FilePath
	}
	// for i, p := range a.CSSFiles {
	// 	a.CSSFiles[i].FilePath = prefix + p.FilePath
	// }
	// for i, p := range a.Swagger {
	// 	a.Swagger[i].FilePath = prefix + p.FilePath
	// }
	// for i, p := range a.SwaggerCSSFiles {
	// 	a.SwaggerCSSFiles[i].FilePath = prefix + p.FilePath
	// }
}
