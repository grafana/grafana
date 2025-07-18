package strategies

import (
	"context"
	"testing"
	"time"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

var (
	iniSAMLContent = `
	[auth.saml]
	enabled = true
	entity_id = custom-entity-id
	single_logout = true
	name = "SAML Test"
	allow_sign_up = true
	auto_login = true
	certificate = devenv/docker/blocks/auth/saml-enterprise/cert.crt
	certificate_path = /path/to/cert
	private_key = dGhpcyBpcyBteSBwcml2YXRlIGtleSB0aGF0IEkgd2FudCB0byBnZXQgZW5jb2RlZCBpbiBiYXNlIDY0
	private_key_path = devenv/docker/blocks/auth/saml-enterprise/key.pem
	signature_algorithm = rsa-sha256
	idp_metadata = dGhpcyBpcyBteSBwcml2YXRlIGtleSB0aGF0IEkgd2FudCB0byBnZXQgZW5jb2RlZCBpbiBiYXNlIDY0
	idp_metadata_path = /path/to/metadata
	idp_metadata_url = http://localhost:8086/realms/grafana/protocol/saml/descriptor
	max_issue_delay = 90s
	metadata_valid_duration = 48h
	allow_idp_initiated = false
	relay_state = relay_state
	assertion_attribute_name = name
	assertion_attribute_login = login
	assertion_attribute_email = email
	assertion_attribute_groups = groups
	assertion_attribute_role = roles
	assertion_attribute_org = orgs
	allowed_organizations = org1 org2
	org_mapping = org1:1:editor, *:2:viewer
	role_values_viewer = viewer
	role_values_editor = editor
	role_values_admin = admin
	role_values_grafana_admin = serveradmin
	name_id_format = urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
	skip_org_role_sync = false
	role_values_none = guest disabled
	token_url = http://localhost:8086/auth/realms/grafana/protocol/openid-connect/token
	client_id = grafana
	client_secret = grafana
	force_use_graph_api = false
	`

	expectedSAMLInfo = map[string]any{
		"enabled":                          true,
		"entity_id":                        "custom-entity-id",
		"single_logout":                    true,
		"allow_sign_up":                    true,
		"auto_login":                       true,
		"name":                             "SAML Test",
		"certificate":                      "devenv/docker/blocks/auth/saml-enterprise/cert.crt",
		"certificate_path":                 "/path/to/cert",
		"private_key":                      "dGhpcyBpcyBteSBwcml2YXRlIGtleSB0aGF0IEkgd2FudCB0byBnZXQgZW5jb2RlZCBpbiBiYXNlIDY0",
		"private_key_path":                 "devenv/docker/blocks/auth/saml-enterprise/key.pem",
		"signature_algorithm":              "rsa-sha256",
		"idp_metadata":                     "dGhpcyBpcyBteSBwcml2YXRlIGtleSB0aGF0IEkgd2FudCB0byBnZXQgZW5jb2RlZCBpbiBiYXNlIDY0",
		"idp_metadata_path":                "/path/to/metadata",
		"idp_metadata_url":                 "http://localhost:8086/realms/grafana/protocol/saml/descriptor",
		"max_issue_delay":                  90 * time.Second,
		"metadata_valid_duration":          48 * time.Hour,
		"allow_idp_initiated":              false,
		"relay_state":                      "relay_state",
		"assertion_attribute_name":         "name",
		"assertion_attribute_login":        "login",
		"assertion_attribute_email":        "email",
		"assertion_attribute_external_uid": "",
		"assertion_attribute_groups":       "groups",
		"assertion_attribute_role":         "roles",
		"assertion_attribute_org":          "orgs",
		"allowed_organizations":            "org1 org2",
		"org_mapping":                      "org1:1:editor, *:2:viewer",
		"role_values_viewer":               "viewer",
		"role_values_editor":               "editor",
		"role_values_admin":                "admin",
		"role_values_grafana_admin":        "serveradmin",
		"name_id_format":                   "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
		"skip_org_role_sync":               false,
		"role_values_none":                 "guest disabled",
		"token_url":                        "http://localhost:8086/auth/realms/grafana/protocol/openid-connect/token",
		"client_id":                        "grafana",
		"client_secret":                    "grafana",
		"force_use_graph_api":              false,
	}
)

func TestSAMLIsMatch(t *testing.T) {
	cfg := setting.NewCfg()
	strategy := NewSAMLStrategy(&setting.OSSImpl{Cfg: cfg})
	require.True(t, strategy.IsMatch("saml"))
	require.False(t, strategy.IsMatch("oauth"))
}

func TestSAMLGetProviderConfig(t *testing.T) {
	configurationFile, err := ini.Load([]byte(iniSAMLContent))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = configurationFile

	strategy := NewSAMLStrategy(&setting.OSSImpl{Cfg: cfg})

	result, err := strategy.GetProviderConfig(context.Background(), "saml")
	require.NoError(t, err)

	require.Equal(t, expectedSAMLInfo, result)
}
