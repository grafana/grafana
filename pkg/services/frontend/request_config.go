package frontend

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

// FSRequestConfig contains all configuration that can be overridden on a per-request basis.
type FSRequestConfig struct {
	FSFrontendSettings

	CSPEnabled            bool
	CSPTemplate           string
	CSPReportOnlyEnabled  bool
	CSPReportOnlyTemplate string
	AppURL                string
}

// NewFSRequestConfig creates a new FSRequestConfig from the global configuration.
// This is used to create the base configuration at service startup.
func NewFSRequestConfig(cfg *setting.Cfg, license licensing.Licensing) FSRequestConfig {
	frontendSettings := FSFrontendSettings{
		AnalyticsConsoleReporting:            cfg.FrontendAnalyticsConsoleReporting,
		AnonymousEnabled:                     cfg.Anonymous.Enabled,
		ApplicationInsightsConnectionString:  cfg.ApplicationInsightsConnectionString,
		ApplicationInsightsEndpointUrl:       cfg.ApplicationInsightsEndpointUrl,
		ApplicationInsightsAutoRouteTracking: cfg.ApplicationInsightsAutoRouteTracking,
		AuthProxyEnabled:                     cfg.AuthProxy.Enabled,
		AutoAssignOrg:                        cfg.AutoAssignOrg,
		CSPReportOnlyEnabled:                 cfg.CSPReportOnlyEnabled,
		DisableLoginForm:                     cfg.DisableLoginForm,
		DisableUserSignUp:                    !cfg.AllowUserSignUp,
		GoogleAnalytics4Id:                   cfg.GoogleAnalytics4ID,
		GoogleAnalytics4SendManualPageViews:  cfg.GoogleAnalytics4SendManualPageViews,
		GoogleAnalyticsId:                    cfg.GoogleAnalyticsID,
		GrafanaJavascriptAgent:               cfg.GrafanaJavascriptAgent,
		Http2Enabled:                         cfg.Protocol == setting.HTTP2Scheme,
		JwtHeaderName:                        cfg.JWTAuth.HeaderName,
		JwtUrlLogin:                          cfg.JWTAuth.URLLogin,
		LdapEnabled:                          cfg.LDAPAuthEnabled,
		LoginHint:                            cfg.LoginHint,
		PasswordHint:                         cfg.PasswordHint,
		ReportingStaticContext:               cfg.ReportingStaticContext,
		RudderstackConfigUrl:                 cfg.RudderstackConfigURL,
		RudderstackDataPlaneUrl:              cfg.RudderstackDataPlaneURL,
		RudderstackIntegrationsUrl:           cfg.RudderstackIntegrationsURL,
		RudderstackSdkUrl:                    cfg.RudderstackSDKURL,
		RudderstackV3SdkUrl:                  cfg.RudderstackV3SDKURL,
		RudderstackWriteKey:                  cfg.RudderstackWriteKey,
		TrustedTypesDefaultPolicyEnabled:     (cfg.CSPEnabled && strings.Contains(cfg.CSPTemplate, "require-trusted-types-for")) || (cfg.CSPReportOnlyEnabled && strings.Contains(cfg.CSPReportOnlyTemplate, "require-trusted-types-for")),
		VerifyEmailEnabled:                   cfg.VerifyEmailEnabled,
		BuildInfo:                            getBuildInfo(license, cfg),
	}

	return FSRequestConfig{
		FSFrontendSettings:    frontendSettings,
		CSPEnabled:            cfg.CSPEnabled,
		CSPTemplate:           cfg.CSPTemplate,
		CSPReportOnlyEnabled:  cfg.CSPReportOnlyEnabled,
		CSPReportOnlyTemplate: cfg.CSPReportOnlyTemplate,
		AppURL:                cfg.AppURL,
	}
}

type requestConfigKey struct{}

// FromContext retrieves the FSRequestConfig from the request context.
// Returns an error if no config is found in the context.
func FSRequestConfigFromContext(ctx context.Context) (FSRequestConfig, error) {
	if config, ok := ctx.Value(requestConfigKey{}).(FSRequestConfig); ok {
		return config, nil
	}
	return FSRequestConfig{}, fmt.Errorf("request config not found in context")
}

func (c FSRequestConfig) WithContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, requestConfigKey{}, c)
}

func getBuildInfo(license licensing.Licensing, cfg *setting.Cfg) dtos.FrontendSettingsBuildInfoDTO {
	version := setting.BuildVersion
	commit := setting.BuildCommit
	commitShort := getShortCommitHash(setting.BuildCommit, 10)
	buildstamp := setting.BuildStamp
	versionString := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, version, commitShort)

	buildInfo := dtos.FrontendSettingsBuildInfoDTO{
		Version:       version,
		VersionString: versionString,
		Commit:        commit,
		CommitShort:   commitShort,
		Buildstamp:    buildstamp,
		Edition:       license.Edition(),
		Env:           cfg.Env,
	}

	return buildInfo
}

func getShortCommitHash(commitHash string, maxLength int) string {
	if len(commitHash) > maxLength {
		return commitHash[:maxLength]
	}
	return commitHash
}
