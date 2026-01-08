package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/util"
)

const (
	extJWTAccessTokenExpectAudience = "grafana"
)

type AuthJWTSettings struct {
	// JWT Auth
	Enabled                 bool
	HeaderName              string
	URLLogin                bool
	EmailClaim              string
	UsernameClaim           string
	ExpectClaims            string
	JWKSetURL               string
	JWKSetBearerTokenFile   string
	CacheTTL                time.Duration
	KeyFile                 string
	KeyID                   string
	JWKSetFile              string
	AutoSignUp              bool
	RoleAttributePath       string
	RoleAttributeStrict     bool
	OrgMapping              []string
	OrgAttributePath        string
	AllowAssignGrafanaAdmin bool
	SkipOrgRoleSync         bool
	GroupsAttributePath     string
	EmailAttributePath      string
	UsernameAttributePath   string
	TlsClientCa             string
	TlsSkipVerify           bool
}

type ExtJWTSettings struct {
	Enabled      bool
	ExpectIssuer string
	JWKSUrl      string
	Audiences    []string
}

func (cfg *Cfg) readAuthExtJWTSettings() {
	authExtendedJWT := cfg.SectionWithEnvOverrides("auth.extended_jwt")
	jwtSettings := ExtJWTSettings{}
	jwtSettings.Enabled = authExtendedJWT.Key("enabled").MustBool(false)
	jwtSettings.JWKSUrl = authExtendedJWT.Key("jwks_url").MustString("")
	// for Grafana, this is hard coded, but we leave it as a configurable param for other use-cases
	jwtSettings.Audiences = []string{extJWTAccessTokenExpectAudience}

	cfg.ExtJWTAuth = jwtSettings
}

func (cfg *Cfg) readAuthJWTSettings() {
	jwtSettings := AuthJWTSettings{}
	authJWT := cfg.Raw.Section("auth.jwt")
	jwtSettings.Enabled = authJWT.Key("enabled").MustBool(false)
	jwtSettings.HeaderName = valueAsString(authJWT, "header_name", "")
	jwtSettings.URLLogin = authJWT.Key("url_login").MustBool(false)
	jwtSettings.EmailClaim = valueAsString(authJWT, "email_claim", "")
	jwtSettings.UsernameClaim = valueAsString(authJWT, "username_claim", "")
	jwtSettings.ExpectClaims = valueAsString(authJWT, "expect_claims", "{}")
	jwtSettings.JWKSetURL = valueAsString(authJWT, "jwk_set_url", "")
	jwtSettings.JWKSetBearerTokenFile = valueAsString(authJWT, "jwk_set_bearer_token_file", "")
	jwtSettings.CacheTTL = authJWT.Key("cache_ttl").MustDuration(time.Minute * 60)
	jwtSettings.KeyFile = valueAsString(authJWT, "key_file", "")
	jwtSettings.KeyID = authJWT.Key("key_id").MustString("")
	jwtSettings.JWKSetFile = valueAsString(authJWT, "jwk_set_file", "")
	jwtSettings.AutoSignUp = authJWT.Key("auto_sign_up").MustBool(false)
	jwtSettings.RoleAttributePath = valueAsString(authJWT, "role_attribute_path", "")
	jwtSettings.RoleAttributeStrict = authJWT.Key("role_attribute_strict").MustBool(false)
	jwtSettings.AllowAssignGrafanaAdmin = authJWT.Key("allow_assign_grafana_admin").MustBool(false)
	jwtSettings.SkipOrgRoleSync = authJWT.Key("skip_org_role_sync").MustBool(false)
	jwtSettings.GroupsAttributePath = valueAsString(authJWT, "groups_attribute_path", "")
	jwtSettings.EmailAttributePath = valueAsString(authJWT, "email_attribute_path", "")
	jwtSettings.UsernameAttributePath = valueAsString(authJWT, "username_attribute_path", "")
	jwtSettings.TlsClientCa = valueAsString(authJWT, "tls_client_ca", "")
	jwtSettings.TlsSkipVerify = authJWT.Key("tls_skip_verify_insecure").MustBool(false)
	jwtSettings.OrgAttributePath = valueAsString(authJWT, "org_attribute_path", "")
	jwtSettings.OrgMapping = util.SplitString(valueAsString(authJWT, "org_mapping", ""))

	cfg.JWTAuth = jwtSettings
}
