package frontend

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/setting"
)

// This is a copy of dtos.FrontendSettingsDTO with only the fields that the frontend-service
// sends, to prevent default values from overriding what comes from the /bootdata call.
//
// It's important the JSON names for these fields match dtos.FrontendSettingsDTO
// so the frontend can merge the two together correctly.
type FSFrontendSettings struct {
	AuthProxyEnabled   bool   `json:"authProxyEnabled,omitempty"`
	LdapEnabled        bool   `json:"ldapEnabled,omitempty"`
	JwtHeaderName      string `json:"jwtHeaderName,omitempty"`
	JwtUrlLogin        bool   `json:"jwtUrlLogin,omitempty"`
	AutoAssignOrg      bool   `json:"autoAssignOrg,omitempty"`
	VerifyEmailEnabled bool   `json:"verifyEmailEnabled,omitempty"`
	DisableLoginForm   bool   `json:"disableLoginForm,omitempty"`
	DisableUserSignUp  bool   `json:"disableUserSignUp,omitempty"`
	LoginHint          string `json:"loginHint,omitempty"`
	PasswordHint       string `json:"passwordHint,omitempty"`
	AnonymousEnabled   bool   `json:"anonymousEnabled,omitempty"`

	BuildInfo dtos.FrontendSettingsBuildInfoDTO `json:"buildInfo"`

	GoogleAnalyticsId                   string `json:"googleAnalyticsId,omitempty"`
	GoogleAnalytics4Id                  string `json:"googleAnalytics4Id,omitempty"`
	GoogleAnalytics4SendManualPageViews bool   `json:"GoogleAnalytics4SendManualPageViews,omitempty"`

	RudderstackWriteKey        string `json:"rudderstackWriteKey,omitempty"`
	RudderstackDataPlaneUrl    string `json:"rudderstackDataPlaneUrl,omitempty"`
	RudderstackSdkUrl          string `json:"rudderstackSdkUrl,omitempty"`
	RudderstackConfigUrl       string `json:"rudderstackConfigUrl,omitempty"`
	RudderstackIntegrationsUrl string `json:"rudderstackIntegrationsUrl,omitempty"`

	AnalyticsConsoleReporting bool                           `json:"analyticsConsoleReporting,omitempty"`
	GrafanaJavascriptAgent    setting.GrafanaJavascriptAgent `json:"grafanaJavascriptAgent,omitempty"`

	ApplicationInsightsConnectionString  string `json:"applicationInsightsConnectionString,omitempty"`
	ApplicationInsightsEndpointUrl       string `json:"applicationInsightsEndpointUrl,omitempty"`
	ApplicationInsightsAutoRouteTracking bool   `json:"applicationInsightsAutoRouteTracking,omitempty"`

	TrustedTypesDefaultPolicyEnabled bool              `json:"trustedTypesDefaultPolicyEnabled,omitempty"`
	CSPReportOnlyEnabled             bool              `json:"cspReportOnlyEnabled,omitempty"`
	Http2Enabled                     bool              `json:"http2Enabled,omitempty"`
	ReportingStaticContext           map[string]string `json:"reportingStaticContext,omitempty"`
}
