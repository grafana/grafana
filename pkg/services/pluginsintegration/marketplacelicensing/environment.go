package marketplacelicensing

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

// Environment provides marketplace licensing data for a Grafana deployment.
type Environment interface {
	// AppURL returns the deployment's application URL.
	AppURL() string
	// LicenseToken returns the marketplace license token for a plugin.
	LicenseToken(context.Context, string) (string, error)
}

// OSSEnvironment provides marketplace licensing data for OSS Grafana.
type OSSEnvironment struct {
	appURL string
}

// ProvideEnvironment returns the OSS marketplace licensing environment.
func ProvideEnvironment(cfg *setting.Cfg) Environment {
	return &OSSEnvironment{appURL: cfg.AppURL}
}

// AppURL returns the configured application URL.
func (e *OSSEnvironment) AppURL() string {
	return e.appURL
}

// LicenseToken returns no marketplace license token for OSS Grafana.
func (e *OSSEnvironment) LicenseToken(context.Context, string) (string, error) {
	return "", nil
}
