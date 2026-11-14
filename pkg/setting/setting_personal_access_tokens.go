package setting

import (
	"strings"
	"time"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

type PersonalAccessTokensSettings struct {
	Enabled             bool
	DefaultLifetimeDays int
	MaxLifetimeDays     int
	AllowNoExpiry       bool
	MaxTokensPerUser    int
	RequireScopes       bool
	AllowAdminActions   bool
	// AllowRuntimeOverride lets server admins change the enabled switch at runtime through the API.
	AllowRuntimeOverride bool
	// RevokeOnIdPLogout revokes an OAuth user's tokens when they sign out of Grafana.
	RevokeOnIdPLogout bool
	// IdPRevalidateInterval is how often tokens of externally authenticated owners are revalidated; 0 disables it.
	IdPRevalidateInterval time.Duration
	// TrustedProxies lists IPs/CIDRs of reverse proxies whose forwarding header is trusted for failed-auth rate limiting.
	TrustedProxies []string
	// TrustedProxyHeader is the header carrying the client IP when the peer is a trusted proxy.
	TrustedProxyHeader string
}

func readPersonalAccessTokensSettings(iniFile *ini.File) PersonalAccessTokensSettings {
	sec := iniFile.Section("personal_access_tokens")
	s := PersonalAccessTokensSettings{
		Enabled:               sec.Key("enabled").MustBool(false),
		DefaultLifetimeDays:   sec.Key("default_lifetime_days").MustInt(30),
		MaxLifetimeDays:       sec.Key("max_lifetime_days").MustInt(90),
		AllowNoExpiry:         sec.Key("allow_no_expiry").MustBool(false),
		MaxTokensPerUser:      sec.Key("max_tokens_per_user").MustInt(10),
		RequireScopes:         sec.Key("require_scopes").MustBool(false),
		AllowAdminActions:     sec.Key("allow_admin_actions").MustBool(false),
		AllowRuntimeOverride:  sec.Key("allow_runtime_override").MustBool(true),
		RevokeOnIdPLogout:     sec.Key("revoke_on_idp_logout").MustBool(false),
		IdPRevalidateInterval: sec.Key("idp_revalidate_interval").MustDuration(time.Hour),
		TrustedProxies:        util.SplitString(sec.Key("trusted_proxies").MustString("")),
		TrustedProxyHeader:    strings.TrimSpace(sec.Key("trusted_proxy_header").MustString("X-Forwarded-For")),
	}
	if s.DefaultLifetimeDays <= 0 {
		s.DefaultLifetimeDays = 30
	}
	if s.MaxLifetimeDays <= 0 {
		s.MaxLifetimeDays = 90
	}
	// A default longer than the maximum would make every default-lifetime request invalid.
	if s.DefaultLifetimeDays > s.MaxLifetimeDays {
		s.DefaultLifetimeDays = s.MaxLifetimeDays
	}
	if s.IdPRevalidateInterval < 0 {
		s.IdPRevalidateInterval = time.Hour
	}
	if s.MaxTokensPerUser < 0 {
		s.MaxTokensPerUser = 10
	}
	return s
}
