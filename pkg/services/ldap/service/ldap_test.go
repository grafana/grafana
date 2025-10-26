package service

import (
	"context"
	"crypto/tls"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/stretchr/testify/require"
)

const (
	validCert = `LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURYVENDQWtXZ0F3SUJBZ0lKQUxtVlZ1RFd1NE5ZTUEwR0NTcUdTSWIzRFFFQkN
3VUFNRVV4Q3pBSkJnTlYKQkFZVEFrRlZNUk13RVFZRFZRUUlEQXBUYjIxbExWTjBZWFJsTVNFd0h3WURWUVFLREJoSmJuUmxjbTVsZENCWAphV1JuYVhSekl
GQjBlU0JNZEdRd0hoY05NVFl4TWpNeE1UUXpORFEzV2hjTk5EZ3dOakkxTVRRek5EUTNXakJGCk1Rc3dDUVlEVlFRR0V3SkJWVEVUTUJFR0ExVUVDQXdLVTI
5dFpTMVRkR0YwWlRFaE1COEdBMVVFQ2d3WVNXNTAKWlhKdVpYUWdWMmxrWjJsMGN5QlFkSGtnVEhSa01JSUJJakFOQmdrcWhraUc5dzBCQVFFRkFBT0NBUTh
BTUlJQgpDZ0tDQVFFQXpVQ0ZvemdOYjFoMU0wanpOUlNDamhPQm5SK3VWYlZwYVdmWFlJUitBaFdEZEVlNXJ5WStDZ2F2Ck9nOGJmTHlieXpGZGVobFlkRFJ
na2VkRUIvR2pHOGFKdzA2bDBxRjRqRE9BdzBrRXlnV0N1Mm1jSDdYT3hSdCsKWUFIM1RWSGEvSHUxVzNXanprb2JxcXFMUThna0tXV00yN2ZPZ0FaNkdpZWF
KQk42VkJTTU1jUGV5M0hXTEJtYworVFlKbXYxZGJhTzJqSGhLaDhwZkt3MFcxMlZNOFAxUElPOGd2NFBodS91dUpZaWVCV0tpeEJFeXkwbEhqeWl4CllGQ1I
xMnhkaDRDQTQ3cTk1OFpSR25uRFVHRlZFMVFoZ1JhY0pDT1o5YmQ1dDltcjhLTGFWQllUQ0pvNUVSRTgKanltYWI1ZFBxZTVxS2ZKc0NaaXFXZ2xialVvOXR
3SURBUUFCbzFBd1RqQWRCZ05WSFE0RUZnUVV4cHV3Y3MvQwpZUU95dWkrcjFHKzNLeEJOaHhrd0h3WURWUjBqQkJnd0ZvQVV4cHV3Y3MvQ1lRT3l1aStyMUc
rM0t4Qk5oeGt3CkRBWURWUjBUQkFVd0F3RUIvekFOQmdrcWhraUc5dzBCQVFzRkFBT0NBUUVBQWlXVUtzLzJ4L3ZpTkNLaTNZNmIKbEV1Q3RBR2h6T09aOUV
qcnZKOCtDT0gzUmFnM3RWQldyY0JaMy91aGhQcTVneTlscXc0T2t2RXdzOTkvNWpGcwpYMUZKNk1LQmdxZnV5N3loNXMxWWZNMEFOSFljek1tWXBaZUFjUWY
yQ0dBYVZmd1RUZlNsek5Mc0YybFcvbHk3CnlhcEZ6bFlTSkxHb1ZFK09IRXU4ZzVTbE5BQ1VFZmtYdys1RWdoaCtLemxJTjdSNlE3cjJpeFdORkJDL2pXZjc
KTktVZkp5WDhxSUc1bWQxWVVlVDZHQlc5Qm0yLzEvUmlPMjRKVGFZbGZMZEtLOVRZYjhzRzVCK09MYWIyREltRwo5OUNKMjVSa0FjU29iV05GNXpEME82bGd
PbzNjRWRCL2tzQ3EzaG10bEMvRGxMWi9EOENKKzdWdVpuUzFyUjJuCmFRPT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQ==`
	validKey = `LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFv
SUJBUUROUUlXak9BMXZXSFV6ClNQTTFGSUtPRTRHZEg2NVZ0V2xwWjlkZ2hINENGWU4wUjdtdkpqNEtCcTg2RHh0OHZKdkxNVjE2R1ZoME5HQ1IKNTBRSDhh
TWJ4b25EVHFYU29YaU1NNEREU1FUS0JZSzdhWndmdGM3RkczNWdBZmROVWRyOGU3VmJkYVBPU2h1cQpxb3REeUNRcFpZemJ0ODZBQm5vYUo1b2tFM3BVRkl3
eHc5N0xjZFlzR1p6NU5nbWEvVjF0bzdhTWVFcUh5bDhyCkRSYlhaVXp3L1U4Zzd5Qy9nK0c3KzY0bGlKNEZZcUxFRVRMTFNVZVBLTEZnVUpIWGJGMkhnSURq
dXIzbnhsRWEKZWNOUVlWVVRWQ0dCRnB3a0k1bjF0M20zMmF2d290cFVGaE1JbWprUkVUeVBLWnB2bDArcDdtb3A4bXdKbUtwYQpDVnVOU2oyM0FnTUJBQUVD
Z2dFQUJuNEkvQjIweHhYY056QVNpVlpKdnVhOURkUkh0bXhUbGtMem5CajB4Mm9ZCnkxL05iczNkM29GUm41dUV1aEJaT1RjcGhzZ3dkUlNIRFhac1AzZ1VP
YmV3K2QyTi96aWVVSWo4aExEVmx2SlAKclUvczRVL2w1M1EwTGlOQnlFOVRodkwrekpMUENLSnRkNXVIWmpCNWZGbTY5K1E3Z3U4eGc0eEhJdWIrMHBQNQpQ
SGFubUhDRHJiZ05OL29xbGFyNEZaMk1YVGdla1c2QW15Yy9rb0U5aEluNEJhYTJLZS9CL0FVR1k0cE1STHFwClRBcnQrR1RWZVdlb0ZZOVFBQ1VwYUhwSmhH
Yi9QaW91NnRsVTU3ZTQyY0xva2kxZjArU0FSc0JCS3lYQTdCQjEKMWZNSDEwS1FZRkE2OGRUWVdsS3pRYXUvSzR4YXFnNEZLbXR3RjY2R1FRS0JnUUQ5T3BO
VVM3b1J4TUhWSmFCUgpUTldXK1YxRlh5Y3FvamVrRnBEaWpQYjJYNUNXVjE2b2VXZ2FYcDBuT0hGZHk5RVdzM0d0R3BmWmFzYVJWSHNYClNIdFBoNE5iOEpx
SGRHRTAvQ0Q2dDArNERuczhCbjljU3F0ZFFCN1IzSm43SU1YaTlYL1U4TERLbytBMTgvSnEKVjhWZ1VuZ01ueTlZak1rUUliSzhUUldrWVFLQmdRRFBmNG54
TzZqdSt0T0hIT1JRdHkzYllERDArT1YzSTArTAoweXowdVByZXJ5QlZpOW5ZNDNLYWtINTJEN1VaRXd3c0JqakdYRCtXSDh4RXNtQldzR05YSnUwMjVQdnpJ
Sm96CmxBRWlYdk1wL05tWXArdFk0ckRtTzhSaHlWb2NCcVdIemgzOG0wSUZPZDRCeUZENW5MRURyQTNwRFZvMGFOZ1kKbjBHd1J5c1pGd0tCZ1FEa0NqM202
Wk1Vc1VXRXR5K2FSMEVKaG1LeU9EQkRPblkwOUlWaEgyUy9GZXhWRnpVTgpMdGZLOTIwNmhwL0F3ZXozTG4ydVQ0WnpxcTVLN2ZNelVuaUpkQldkVkIwMDRs
OHZvZVhwSWU5T1p1d2ZjQko5CmdGaTF6eXB4L3VGRHY0MjFCelFwQk4rUWZPZEtidmJkUVZGam5xQ3hiU0RyODB5VmxHTXJJNWZid1FLQmdHMDkKb1JyZXBP
N0VJTzhHTi9HQ3J1TEsvcHRLR2t5aHkzUTZ4blZFbWRiNDdoWDduY0pBNUlvWlBtcmJsQ1ZTVU5zdwpuMTFYSGFia3NMOE9CZ2c5cnQ4b1FFVGhRdi9hRHpU
T1c5YURsSk5yYWdlamlCVHdxOTlhWWVaMWdqbzFDWnE0CjJqS3VicENmeVpDNHJHRHRySWZaWWkxcStTMlVjUWh0ZDhEZGh3UWJBb0dBQU00RXBEQTR5SEI1
eWllazFwL28KQ2JxUkN0YS9EeDZFeW8wS2xOQXlQdUZQQXNodXBHNE5CeDdtVDJBU2ZMKzJWQkhvaTZtSFNyaStCRFg1cnlZRgpmTVl2cDdVUllvcTd3N3Fp
dlJsdnZFZzV5b1lySzEzRjIrR2o2eEo0akVOOW0wS2RNL2czbUpHcTBIQlRJUXJwClNtNzVXWHNmbE94dVRuMDhMYmdHYzRzPQotLS0tLUVORCBSU0EgUFJJ
VkFURSBLRVktLS0tLQ==`
)

var (
	isAdmin = true
)

func TestReload(t *testing.T) {
	testCases := []struct {
		description           string
		settings              models.SSOSettings
		expectedServersConfig *ldap.ServersConfig
		expectedConfig        *ldap.Config
	}{
		{
			description: "basic flow with minimal config",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled":            true,
					"skip_org_role_sync": false,
					"allow_sign_up":      true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host": "127.0.0.1",
								"group_mappings": []any{
									map[string]any{
										"group_dn":      "cn=admin,ou=groups,dc=ldap,dc=goauthentik,dc=io",
										"grafana_admin": true,
									},
								},
							},
						},
					},
				},
				IsDeleted: false,
			},
			expectedServersConfig: &ldap.ServersConfig{
				Servers: []*ldap.ServerConfig{
					{
						Host:    "127.0.0.1",
						Timeout: 10,
						Groups: []*ldap.GroupToOrgRole{
							{
								GroupDN:        "cn=admin,ou=groups,dc=ldap,dc=goauthentik,dc=io",
								OrgId:          1,
								IsGrafanaAdmin: &isAdmin,
							},
						},
					},
				},
			},
			expectedConfig: &ldap.Config{
				Enabled:         true,
				AllowSignUp:     true,
				SkipOrgRoleSync: false,
			},
		},
		{
			description: "complete set of server parameters",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled":            true,
					"skip_org_role_sync": false,
					"allow_sign_up":      true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":                               "127.0.0.1",
								"port":                               3389,
								"bind_dn":                            "cn=ldapservice,ou=users,dc=ldap,dc=goauthentik,dc=io",
								"bind_password":                      "grafana",
								"search_filter":                      "(cn=%s)",
								"ssl_skip_verify":                    false,
								"use_ssl":                            true,
								"start_tls":                          true,
								"min_tls_version":                    "TLS1.3",
								"timeout":                            10,
								"root_ca_cert":                       "/path/to/certificate.crt",
								"root_ca_cert_value":                 []string{validCert},
								"client_cert":                        "/path/to/client.crt",
								"client_cert_value":                  validCert,
								"client_key":                         "/path/to/client.key",
								"client_key_value":                   validKey,
								"group_search_filter":                "(&(objectClass=posixGroup)(memberUid=%s))",
								"group_search_filter_user_attribute": "distinguishedName",
								"group_search_base_dns":              []string{"ou=groups,dc=grafana,dc=org"},
								"tls_ciphers": []string{
									"TLS_AES_256_GCM_SHA384",
									"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
								},
								"attributes": map[string]string{
									"email":     "mail",
									"member_of": "memberOf",
									"name":      "displayName",
									"surname":   "sn",
									"username":  "cn",
								},
								"search_base_dns": []string{
									"DC=ldap,DC=goauthentik,DC=io",
								},
								"group_mappings": []any{
									map[string]any{
										"group_dn":      "cn=admin,ou=groups,dc=ldap,dc=goauthentik,dc=io",
										"org_id":        1,
										"org_role":      "Admin",
										"grafana_admin": true,
									},
									map[string]any{
										"group_dn": "cn=editor,ou=groups,dc=ldap,dc=goauthentik,dc=io",
										"org_id":   1,
										"org_role": "Editor",
									},
									map[string]any{
										"group_dn": "cn=viewer,ou=groups,dc=ldap,dc=goauthentik,dc=io",
										"org_id":   2,
										"org_role": "Viewer",
									},
								},
							},
						},
					},
				},
				IsDeleted: false,
			},
			expectedServersConfig: &ldap.ServersConfig{
				Servers: []*ldap.ServerConfig{
					{
						Host:            "127.0.0.1",
						Port:            3389,
						UseSSL:          true,
						StartTLS:        true,
						SkipVerifySSL:   false,
						MinTLSVersion:   "TLS1.3",
						MinTLSVersionID: tls.VersionTLS13,
						TLSCiphers: []string{
							"TLS_AES_256_GCM_SHA384",
							"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
						},
						TLSCipherIDs: []uint16{
							tls.TLS_AES_256_GCM_SHA384,
							tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
						},
						RootCACert:      "/path/to/certificate.crt",
						RootCACertValue: []string{validCert},
						ClientCert:      "/path/to/client.crt",
						ClientCertValue: validCert,
						ClientKey:       "/path/to/client.key",
						ClientKeyValue:  validKey,
						BindDN:          "cn=ldapservice,ou=users,dc=ldap,dc=goauthentik,dc=io",
						BindPassword:    "grafana",
						Timeout:         10,
						Attr: ldap.AttributeMap{
							Username: "cn",
							Name:     "displayName",
							Surname:  "sn",
							Email:    "mail",
							MemberOf: "memberOf",
						},
						SearchFilter:                   "(cn=%s)",
						SearchBaseDNs:                  []string{"DC=ldap,DC=goauthentik,DC=io"},
						GroupSearchFilter:              "(&(objectClass=posixGroup)(memberUid=%s))",
						GroupSearchFilterUserAttribute: "distinguishedName",
						GroupSearchBaseDNs:             []string{"ou=groups,dc=grafana,dc=org"},
						Groups: []*ldap.GroupToOrgRole{
							{
								GroupDN:        "cn=admin,ou=groups,dc=ldap,dc=goauthentik,dc=io",
								OrgId:          1,
								OrgRole:        "Admin",
								IsGrafanaAdmin: &isAdmin,
							},
							{
								GroupDN: "cn=editor,ou=groups,dc=ldap,dc=goauthentik,dc=io",
								OrgId:   1,
								OrgRole: "Editor",
							},
							{
								GroupDN: "cn=viewer,ou=groups,dc=ldap,dc=goauthentik,dc=io",
								OrgId:   2,
								OrgRole: "Viewer",
							},
						},
					},
				},
			},
			expectedConfig: &ldap.Config{
				Enabled:         true,
				AllowSignUp:     true,
				SkipOrgRoleSync: false,
			},
		},
		{
			description: "no servers config",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled":            true,
					"skip_org_role_sync": false,
					"allow_sign_up":      true,
				},
				IsDeleted: false,
			},
			expectedServersConfig: &ldap.ServersConfig{Servers: nil},
			expectedConfig: &ldap.Config{
				Enabled:         true,
				AllowSignUp:     true,
				SkipOrgRoleSync: false,
			},
		},
		{
			description: "invalid settings",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"invalid":     "some-value",
					"another_one": true,
				},
				IsDeleted: false,
			},
			expectedServersConfig: &ldap.ServersConfig{Servers: nil},
			expectedConfig: &ldap.Config{
				AllowSignUp: true,
			},
		},
		{
			description: "config disabled",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled":            false,
					"skip_org_role_sync": false,
					"allow_sign_up":      true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host": "127.0.0.1",
							},
						},
					},
				},
				IsDeleted: false,
			},
			expectedServersConfig: &ldap.ServersConfig{
				Servers: []*ldap.ServerConfig{
					{
						Host:    "127.0.0.1",
						Timeout: 10,
					},
				},
			},
			expectedConfig: &ldap.Config{
				Enabled:         false,
				AllowSignUp:     true,
				SkipOrgRoleSync: false,
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.description, func(t *testing.T) {
			ldapImpl := &LDAPImpl{
				loadingMutex: &sync.Mutex{},
			}

			err := ldapImpl.Reload(context.Background(), tt.settings)
			require.NoError(t, err)
			require.Equal(t, *tt.expectedServersConfig, *ldapImpl.ldapCfg)
			require.Equal(t, *tt.expectedConfig, *ldapImpl.cfg)
		})
	}
}

func TestValidate(t *testing.T) {
	testCases := []struct {
		description   string
		settings      models.SSOSettings
		isValid       bool
		containsError string
	}{
		{
			description: "successfully validate basic settings",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
								"min_tls_version": "TLS1.3",
								"tls_ciphers":     []string{"TLS_AES_128_GCM_SHA256", "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"},
								"group_mappings": []any{
									map[string]any{
										"group_dn":      "cn=admins,ou=groups,dc=grafana,dc=org",
										"grafana_admin": true,
									},
									map[string]any{
										"group_dn": "cn=users,ou=groups,dc=grafana,dc=org",
										"org_role": "Editor",
									},
								},
							},
						},
					},
				},
			},
			isValid: true,
		},
		{
			description: "successfully validate settings that are not enabled",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": false,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"port": 123,
							},
						},
					},
				},
			},
			isValid: true,
		},
		{
			description: "validation fails for invalid settings",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": "invalid server config",
					},
				},
			},
			isValid:       false,
			containsError: "cannot unmarshal",
		},
		{
			description: "validation fails when no servers are configured",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{},
					},
				},
			},
			isValid:       false,
			containsError: "no servers configured",
		},
		{
			description: "validation fails if one server does not have a host configured",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
							},
							map[string]any{
								"port":            123,
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "no host configured",
		},
		{
			description: "validation fails if search filter is not configured",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_base_dns": []string{"dc=grafana,dc=org"},
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "no search filter",
		},
		{
			description: "validation fails if search base DN is not configured",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":          "127.0.0.1",
								"search_filter": "(cn=%s)",
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "no search base DN",
		},
		{
			description: "validation fails if min TLS version is invalid",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
								"min_tls_version": "TLS5.18",
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "invalid min TLS version",
		},
		{
			description: "validation fails if TLS cyphers are invalid",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
								"tls_ciphers":     []string{"TLS_AES_128_GCM_SHA256", "invalid-tls-cypher"},
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "invalid TLS ciphers",
		},
		{
			description: "validation fails if a group mapping contains no organization role",
			settings: models.SSOSettings{
				Provider: "ldap",
				Settings: map[string]any{
					"enabled": true,
					"config": map[string]any{
						"servers": []any{
							map[string]any{
								"host":            "127.0.0.1",
								"search_filter":   "(cn=%s)",
								"search_base_dns": []string{"dc=grafana,dc=org"},
								"group_mappings": []any{
									map[string]any{
										"group_dn":      "cn=admins,ou=groups,dc=grafana,dc=org",
										"org_role":      "Admin",
										"grafana_admin": true,
									},
									map[string]any{
										"group_dn": "cn=users,ou=groups,dc=grafana,dc=org",
									},
								},
							},
						},
					},
				},
			},
			isValid:       false,
			containsError: "organization role",
		},
	}

	for _, tt := range testCases {
		t.Run(tt.description, func(t *testing.T) {
			ldapImpl := &LDAPImpl{
				loadingMutex: &sync.Mutex{},
			}

			err := ldapImpl.Validate(context.Background(), tt.settings, models.SSOSettings{}, nil)

			if tt.isValid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.containsError)
			}
		})
	}
}
