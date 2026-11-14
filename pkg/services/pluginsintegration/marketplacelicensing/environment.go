package marketplacelicensing

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

// Licensing provides marketplace licensing data for a Grafana deployment.
type Licensing interface {
	// AppURL returns the deployment's application URL.
	AppURL() string
	// LicenseToken returns the marketplace license token for a plugin.
	LicenseToken(context.Context, string) (string, error)
	// ValidationKeys returns the validation key bundle that Grafana trusts for marketplace license tokens,
	// or an empty string to trust only the keys embedded in the plugin SDK.
	ValidationKeys() string
}

// OSS provides marketplace licensing data for OSS Grafana.
// This implementation always returns an empty license token
// (license tokens are Enterprise-only).
type OSS struct {
	appURL string
}

// Provide returns the OSS marketplace licensing environment.
func Provide(cfg *setting.Cfg) Licensing {
	return &OSS{appURL: cfg.AppURL}
}

// AppURL returns the configured application URL.
func (e *OSS) AppURL() string {
	return e.appURL
}

// LicenseToken returns no marketplace license token for OSS Grafana.
func (e *OSS) LicenseToken(context.Context, string) (string, error) {
	return "", nil
}

// ValidationKeys returns no validation keys for OSS Grafana.
func (e *OSS) ValidationKeys() string {
	return ""
}
