package strategies

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

const jwtConfig = `[auth.jwt]
enabled = true
header_name = X-JWT-Assertion
email_claim = email
username_claim = sub
jwk_set_url = https://example.com/.well-known/jwks.json
cache_ttl = 60m
expect_claims = {"iss": "https://example.com"}
role_attribute_path = roles[0]
role_attribute_strict = true
allow_assign_grafana_admin = false
skip_org_role_sync = false
auto_sign_up = true
tls_skip_verify_insecure = false`

func TestGetJWTConfig(t *testing.T) {
	iniFile, err := ini.Load([]byte(jwtConfig))
	require.NoError(t, err)

	cfg, err := setting.NewCfgFromINIFile(iniFile)
	require.NoError(t, err)

	strategy := NewJWTStrategy(cfg)

	require.True(t, strategy.IsMatch("jwt"))
	require.False(t, strategy.IsMatch("ldap"))
	require.False(t, strategy.IsMatch("generic_oauth"))

	result, err := strategy.GetProviderConfig(context.Background(), "jwt")
	require.NoError(t, err)

	require.Equal(t, true, result["enabled"])
	require.Equal(t, "X-JWT-Assertion", result["header_name"])
	require.Equal(t, "email", result["email_claim"])
	require.Equal(t, "sub", result["username_claim"])
	require.Equal(t, "https://example.com/.well-known/jwks.json", result["jwk_set_url"])
	require.Equal(t, `{"iss": "https://example.com"}`, result["expect_claims"])
	require.Equal(t, "roles[0]", result["role_attribute_path"])
	require.Equal(t, true, result["role_attribute_strict"])
	require.Equal(t, false, result["allow_assign_grafana_admin"])
	require.Equal(t, false, result["skip_org_role_sync"])
	require.Equal(t, true, result["auto_sign_up"])
	require.Equal(t, false, result["tls_skip_verify_insecure"])
}

func TestGetJWTConfigDefaults(t *testing.T) {
	// Empty config — should return safe defaults (not error)
	iniFile, err := ini.Load([]byte("[auth.jwt]"))
	require.NoError(t, err)

	cfg, err := setting.NewCfgFromINIFile(iniFile)
	require.NoError(t, err)

	strategy := NewJWTStrategy(cfg)
	result, err := strategy.GetProviderConfig(context.Background(), "jwt")
	require.NoError(t, err)

	require.Equal(t, false, result["enabled"])
	require.Equal(t, "{}", result["expect_claims"])
	require.Equal(t, false, result["role_attribute_strict"])
	require.Equal(t, false, result["tls_skip_verify_insecure"])
	require.Equal(t, false, result["auto_sign_up"])
}
