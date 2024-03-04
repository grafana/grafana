package setting

import "time"

type AuthJWTSettings struct {
	// JWT Auth
	Enabled                 bool
	HeaderName              string
	URLLogin                bool
	EmailClaim              string
	UsernameClaim           string
	ExpectClaims            string
	JWKSetURL               string
	CacheTTL                time.Duration
	KeyFile                 string
	KeyID                   string
	JWKSetFile              string
	AutoSignUp              bool
	RoleAttributePath       string
	RoleAttributeStrict     bool
	AllowAssignGrafanaAdmin bool
	SkipOrgRoleSync         bool
	GroupsAttributePath     string
}

type ExtJWTSettings struct {
	Enabled        bool
	ExpectIssuer   string
	ExpectAudience string
}

func (cfg *Cfg) readAuthExtJWTSettings() {
	authExtendedJWT := cfg.SectionWithEnvOverrides("auth.extended_jwt")
	jwtSettings := ExtJWTSettings{}
	jwtSettings.Enabled = authExtendedJWT.Key("enabled").MustBool(false)
	jwtSettings.ExpectAudience = authExtendedJWT.Key("expect_audience").MustString("")
	jwtSettings.ExpectIssuer = authExtendedJWT.Key("expect_issuer").MustString("")
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

	cfg.JWTAuth = jwtSettings
}
