package jwt

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// jwtField is a single SSO setting key paired with how to project it to and
// from setting.AuthJWTSettings. The set of fields lives in jwtFields() so the
// SSO settings strategy and the reload-from-map path read the same source of
// truth.
type jwtField struct {
	key string
	get func(s *setting.AuthJWTSettings) any
	set func(s *setting.AuthJWTSettings, v any) error
}

func stringField(key string, ptr func(*setting.AuthJWTSettings) *string) jwtField {
	return jwtField{
		key: key,
		get: func(s *setting.AuthJWTSettings) any { return *ptr(s) },
		set: func(s *setting.AuthJWTSettings, v any) error {
			if v == nil {
				return nil
			}
			out, ok := v.(string)
			if !ok {
				return fmt.Errorf("%s: expected string, got %T", key, v)
			}
			*ptr(s) = out
			return nil
		},
	}
}

func boolField(key string, ptr func(*setting.AuthJWTSettings) *bool) jwtField {
	return jwtField{
		key: key,
		get: func(s *setting.AuthJWTSettings) any { return *ptr(s) },
		set: func(s *setting.AuthJWTSettings, v any) error {
			*ptr(s) = connectors.MustBool(v, *ptr(s))
			return nil
		},
	}
}

func jwtFields() []jwtField {
	return []jwtField{
		boolField("enabled", func(s *setting.AuthJWTSettings) *bool { return &s.Enabled }),
		stringField("header_name", func(s *setting.AuthJWTSettings) *string { return &s.HeaderName }),
		boolField("url_login", func(s *setting.AuthJWTSettings) *bool { return &s.URLLogin }),
		stringField("email_claim", func(s *setting.AuthJWTSettings) *string { return &s.EmailClaim }),
		stringField("username_claim", func(s *setting.AuthJWTSettings) *string { return &s.UsernameClaim }),
		stringField("expect_claims", func(s *setting.AuthJWTSettings) *string { return &s.ExpectClaims }),
		stringField("jwk_set_url", func(s *setting.AuthJWTSettings) *string { return &s.JWKSetURL }),
		stringField("jwk_set_file", func(s *setting.AuthJWTSettings) *string { return &s.JWKSetFile }),
		stringField("jwk_set_bearer_token_file", func(s *setting.AuthJWTSettings) *string { return &s.JWKSetBearerTokenFile }),
		stringField("key_file", func(s *setting.AuthJWTSettings) *string { return &s.KeyFile }),
		stringField("key_id", func(s *setting.AuthJWTSettings) *string { return &s.KeyID }),
		{
			key: "cache_ttl",
			get: func(s *setting.AuthJWTSettings) any { return s.CacheTTL.String() },
			set: func(s *setting.AuthJWTSettings, v any) error {
				if v == nil {
					return nil
				}
				str, ok := v.(string)
				if !ok {
					return fmt.Errorf("cache_ttl: expected string, got %T", v)
				}
				if str == "" {
					return nil
				}
				d, err := time.ParseDuration(str)
				if err != nil {
					return fmt.Errorf("invalid cache_ttl: %w", err)
				}
				s.CacheTTL = d
				return nil
			},
		},
		boolField("auto_sign_up", func(s *setting.AuthJWTSettings) *bool { return &s.AutoSignUp }),
		stringField("role_attribute_path", func(s *setting.AuthJWTSettings) *string { return &s.RoleAttributePath }),
		boolField("role_attribute_strict", func(s *setting.AuthJWTSettings) *bool { return &s.RoleAttributeStrict }),
		boolField("allow_assign_grafana_admin", func(s *setting.AuthJWTSettings) *bool { return &s.AllowAssignGrafanaAdmin }),
		boolField("skip_org_role_sync", func(s *setting.AuthJWTSettings) *bool { return &s.SkipOrgRoleSync }),
		stringField("groups_attribute_path", func(s *setting.AuthJWTSettings) *string { return &s.GroupsAttributePath }),
		stringField("email_attribute_path", func(s *setting.AuthJWTSettings) *string { return &s.EmailAttributePath }),
		stringField("username_attribute_path", func(s *setting.AuthJWTSettings) *string { return &s.UsernameAttributePath }),
		stringField("org_attribute_path", func(s *setting.AuthJWTSettings) *string { return &s.OrgAttributePath }),
		{
			key: "org_mapping",
			get: func(s *setting.AuthJWTSettings) any { return strings.Join(s.OrgMapping, ",") },
			set: func(s *setting.AuthJWTSettings, v any) error {
				if v == nil {
					return nil
				}
				str, ok := v.(string)
				if !ok {
					return fmt.Errorf("org_mapping: expected string, got %T", v)
				}
				s.OrgMapping = util.SplitString(str)
				return nil
			},
		},
		stringField("tls_client_ca", func(s *setting.AuthJWTSettings) *string { return &s.TlsClientCa }),
		boolField("tls_skip_verify_insecure", func(s *setting.AuthJWTSettings) *bool { return &s.TlsSkipVerify }),
	}
}

// defaultSettings returns a struct pre-populated with the defaults that
// setting/setting_jwt.go applies when reading from the ini file.
func defaultSettings() setting.AuthJWTSettings {
	return setting.AuthJWTSettings{
		ExpectClaims: "{}",
		CacheTTL:     time.Hour,
	}
}

// SettingsToMap projects an AuthJWTSettings struct into the map shape used by
// the SSO settings API (read path).
func SettingsToMap(s setting.AuthJWTSettings) map[string]any {
	fields := jwtFields()
	m := make(map[string]any, len(fields))
	for _, f := range fields {
		m[f.key] = f.get(&s)
	}
	return m
}

// SettingsFromMap converts an SSO settings map back into AuthJWTSettings.
// Missing keys retain their default values.
func SettingsFromMap(m map[string]any) (setting.AuthJWTSettings, error) {
	out := defaultSettings()
	if m == nil {
		return out, nil
	}
	for _, f := range jwtFields() {
		v, ok := m[f.key]
		if !ok {
			continue
		}
		if err := f.set(&out, v); err != nil {
			return setting.AuthJWTSettings{}, err
		}
	}
	return out, nil
}
