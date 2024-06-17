package ldap

import (
	"errors"
	"fmt"
	"testing"

	"github.com/go-ldap/ldap/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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

func TestNew(t *testing.T) {
	result := New(&ServerConfig{
		Attr:          AttributeMap{},
		SearchBaseDNs: []string{"BaseDNHere"},
	}, &Config{})

	assert.Implements(t, (*IServer)(nil), result)
}

func TestServer_Dial(t *testing.T) {
	t.Run("fails having no host but with valid root and client certificate files", func(t *testing.T) {
		serverConfig := &ServerConfig{
			Host:       "",
			RootCACert: "./testdata/parsable.cert",
			ClientCert: "./testdata/parsable.cert",
			ClientKey:  "./testdata/parsable.pem",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "connect")
	})

	t.Run("fails with invalid root certificate file", func(t *testing.T) {
		serverConfig := &ServerConfig{
			RootCACert: "./testdata/invalid.cert",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to append CA certificate")
	})

	t.Run("fails with non existing root certificate file", func(t *testing.T) {
		serverConfig := &ServerConfig{
			RootCACert: "./testdata/nofile.cert",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "no such file or directory")
	})

	t.Run("fails with invalid client certificate file", func(t *testing.T) {
		serverConfig := &ServerConfig{
			ClientCert: "./testdata/invalid.cert",
			ClientKey:  "./testdata/invalid.pem",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to find any PEM data")
	})

	t.Run("fails with non existing client certificate file", func(t *testing.T) {
		serverConfig := &ServerConfig{
			ClientCert: "./testdata/nofile.cert",
			ClientKey:  "./testdata/parsable.pem",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "no such file or directory")
	})

	t.Run("fails having no host but with valid root and client certificate values", func(t *testing.T) {
		serverConfig := &ServerConfig{
			Host:            "",
			RootCACertValue: []string{validCert},
			ClientCertValue: validCert,
			ClientKeyValue:  validKey,
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "connect")
	})

	t.Run("fails with invalid base64 root certificate value", func(t *testing.T) {
		serverConfig := &ServerConfig{
			RootCACertValue: []string{"invalid-certificate"},
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "illegal base64 data")
	})

	t.Run("fails with invalid root certificate value", func(t *testing.T) {
		serverConfig := &ServerConfig{
			RootCACertValue: []string{"aW52YWxpZC1jZXJ0aWZpY2F0ZQ=="},
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to append CA certificate")
	})

	t.Run("fails with invalid base64 client certificate value", func(t *testing.T) {
		serverConfig := &ServerConfig{
			ClientCertValue: "invalid-certificate",
			ClientKeyValue:  validKey,
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "illegal base64 data")
	})

	t.Run("fails with invalid client certificate value", func(t *testing.T) {
		serverConfig := &ServerConfig{
			ClientCertValue: validCert,
			ClientKeyValue:  "aW52YWxpZC1rZXk=",
		}
		server := New(serverConfig, &Config{})

		err := server.Dial()
		require.Error(t, err)
		require.ErrorContains(t, err, "failed to find any PEM data")
	})
}

func TestServer_Close(t *testing.T) {
	t.Run("close the connection", func(t *testing.T) {
		connection := &MockConnection{}

		server := &Server{
			Config: &ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: connection,
		}

		assert.NotPanics(t, server.Close)
		assert.True(t, connection.CloseCalled)
	})

	t.Run("panic if no connection", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: nil,
		}

		assert.Panics(t, server.Close)
	})
}

func TestServer_Users(t *testing.T) {
	t.Run("one user", func(t *testing.T) {
		conn := &MockConnection{}
		entry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"roelgerrits"}},
				{Name: "surname", Values: []string{"Gerrits"}},
				{Name: "email", Values: []string{"roel@test.com"}},
				{Name: "name", Values: []string{"Roel"}},
				{Name: "memberof", Values: []string{"admins"}},
			}}
		result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
		conn.setSearchResult(&result)

		// Set up attribute map without surname and email
		cfg := &Config{
			Enabled: true,
		}

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
					MemberOf: "memberof",
				},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"roelgerrits"})

		require.NoError(t, err)
		assert.NotNil(t, searchResult)

		// User should be searched in ldap
		assert.True(t, conn.SearchCalled)
		// No empty attributes should be added to the search request
		assert.Len(t, conn.SearchAttributes, 3)
	})

	t.Run("error", func(t *testing.T) {
		expected := errors.New("Killa-gorilla")
		conn := &MockConnection{}
		conn.setSearchError(expected)

		// Set up attribute map without surname and email
		server := &Server{
			Config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		_, err := server.Users([]string{"roelgerrits"})

		assert.ErrorIs(t, err, expected)
	})

	t.Run("no user", func(t *testing.T) {
		conn := &MockConnection{}
		result := ldap.SearchResult{Entries: []*ldap.Entry{}}
		conn.setSearchResult(&result)

		// Set up attribute map without surname and email
		server := &Server{
			Config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"roelgerrits"})

		require.NoError(t, err)
		assert.Empty(t, searchResult)
	})

	t.Run("multiple DNs", func(t *testing.T) {
		conn := &MockConnection{}
		serviceDN := "dc=svc,dc=example,dc=org"
		serviceEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"imgrenderer"}},
				{Name: "name", Values: []string{"Image renderer"}},
			}}
		services := ldap.SearchResult{Entries: []*ldap.Entry{&serviceEntry}}

		userDN := "dc=users,dc=example,dc=org"
		userEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot"}},
			}}
		users := ldap.SearchResult{Entries: []*ldap.Entry{&userEntry}}

		conn.setSearchFunc(func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
			switch request.BaseDN {
			case userDN:
				return &users, nil
			case serviceDN:
				return &services, nil
			default:
				return nil, fmt.Errorf("test case not defined for baseDN: '%s'", request.BaseDN)
			}
		})

		server := &Server{
			cfg: &Config{},
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
				},
				SearchBaseDNs: []string{serviceDN, userDN},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"imgrenderer", "grot"})
		require.NoError(t, err)

		assert.Len(t, searchResult, 2)
	})

	t.Run("same user in multiple DNs", func(t *testing.T) {
		conn := &MockConnection{}
		firstDN := "dc=users1,dc=example,dc=org"
		firstEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot the First"}},
			}}
		firsts := ldap.SearchResult{Entries: []*ldap.Entry{&firstEntry}}

		secondDN := "dc=users2,dc=example,dc=org"
		secondEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot the Second"}},
			}}
		seconds := ldap.SearchResult{Entries: []*ldap.Entry{&secondEntry}}

		conn.setSearchFunc(func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
			switch request.BaseDN {
			case secondDN:
				return &seconds, nil
			case firstDN:
				return &firsts, nil
			default:
				return nil, fmt.Errorf("test case not defined for baseDN: '%s'", request.BaseDN)
			}
		})

		cfg := &Config{
			Enabled: true,
		}

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
				},
				SearchBaseDNs: []string{firstDN, secondDN},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		res, err := server.Users([]string{"grot"})
		require.NoError(t, err)
		require.Len(t, res, 1)
		assert.Equal(t, "Grot the First", res[0].Name)
	})

	t.Run("org role mapping", func(t *testing.T) {
		conn := &MockConnection{}

		usersOU := "ou=users,dc=example,dc=org"
		grootDN := "dn=groot," + usersOU
		grootSearch := ldap.SearchResult{Entries: []*ldap.Entry{{DN: grootDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"groot"}},
				{Name: "name", Values: []string{"I am Groot"}},
			}}}}
		babyGrootDN := "dn=babygroot," + usersOU
		babyGrootSearch := ldap.SearchResult{Entries: []*ldap.Entry{{DN: grootDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"babygroot"}},
				{Name: "name", Values: []string{"I am baby Groot"}},
			}}}}
		peterDN := "dn=peter," + usersOU
		peterSearch := ldap.SearchResult{Entries: []*ldap.Entry{{DN: peterDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"peter"}},
				{Name: "name", Values: []string{"Peter"}},
			}}}}
		groupsOU := "ou=groups,dc=example,dc=org"
		creaturesDN := "dn=creatures," + groupsOU
		grootGroups := ldap.SearchResult{Entries: []*ldap.Entry{{DN: creaturesDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "member", Values: []string{grootDN}},
			}}},
		}
		babyCreaturesDN := "dn=babycreatures," + groupsOU
		babyGrootGroups := ldap.SearchResult{Entries: []*ldap.Entry{{DN: babyCreaturesDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "member", Values: []string{babyGrootDN}},
			}}},
		}
		humansDN := "dn=humans," + groupsOU
		peterGroups := ldap.SearchResult{Entries: []*ldap.Entry{{DN: humansDN,
			Attributes: []*ldap.EntryAttribute{
				{Name: "member", Values: []string{peterDN}},
			}}},
		}

		conn.setSearchFunc(func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
			switch request.BaseDN {
			case usersOU:
				switch request.Filter {
				case "(|(username=groot))":
					return &grootSearch, nil
				case "(|(username=babygroot))":
					return &babyGrootSearch, nil
				case "(|(username=peter))":
					return &peterSearch, nil
				default:
					return nil, fmt.Errorf("test case not defined for user filter: '%s'", request.Filter)
				}
			case groupsOU:
				switch request.Filter {
				case "(member=groot)":
					return &grootGroups, nil
				case "(member=babygroot)":
					return &babyGrootGroups, nil
				case "(member=peter)":
					return &peterGroups, nil
				default:
					return nil, fmt.Errorf("test case not defined for group filter: '%s'", request.Filter)
				}
			default:
				return nil, fmt.Errorf("test case not defined for baseDN: '%s'", request.BaseDN)
			}
		})

		isGrafanaAdmin := true
		cfg := &Config{
			Enabled: true,
		}

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
				},
				SearchBaseDNs:      []string{usersOU},
				SearchFilter:       "(username=%s)",
				GroupSearchFilter:  "(member=%s)",
				GroupSearchBaseDNs: []string{groupsOU},
				Groups: []*GroupToOrgRole{
					{
						GroupDN:        creaturesDN,
						OrgId:          2,
						IsGrafanaAdmin: &isGrafanaAdmin,
						OrgRole:        "Admin",
					},
					{
						GroupDN: babyCreaturesDN,
						OrgId:   2,
						OrgRole: "Editor",
					},
				},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		t.Run("disable user with no mapping", func(t *testing.T) {
			res, err := server.Users([]string{"peter"})
			require.NoError(t, err)
			require.Len(t, res, 1)
			require.Equal(t, "Peter", res[0].Name)
			require.ElementsMatch(t, res[0].Groups, []string{humansDN})
			require.Empty(t, res[0].OrgRoles)
			require.True(t, res[0].IsDisabled)
		})
		t.Run("skip org role sync", func(t *testing.T) {
			server.cfg.SkipOrgRoleSync = true

			res, err := server.Users([]string{"groot"})
			require.NoError(t, err)
			require.Len(t, res, 1)
			require.Equal(t, "I am Groot", res[0].Name)
			require.ElementsMatch(t, res[0].Groups, []string{creaturesDN})
			require.Empty(t, res[0].OrgRoles)
			require.False(t, res[0].IsDisabled)
		})
		t.Run("sync org role", func(t *testing.T) {
			server.cfg.SkipOrgRoleSync = false
			res, err := server.Users([]string{"groot"})
			require.NoError(t, err)
			require.Len(t, res, 1)
			require.Equal(t, "I am Groot", res[0].Name)
			require.ElementsMatch(t, res[0].Groups, []string{creaturesDN})
			require.Len(t, res[0].OrgRoles, 1)
			role, mappingExist := res[0].OrgRoles[2]
			require.True(t, mappingExist)
			require.Equal(t, identity.RoleAdmin, role)
			require.False(t, res[0].IsDisabled)
			require.NotNil(t, res[0].IsGrafanaAdmin)
			assert.True(t, *res[0].IsGrafanaAdmin)
		})
		t.Run("set Grafana Admin to false by default", func(t *testing.T) {
			res, err := server.Users([]string{"babygroot"})
			require.NoError(t, err)
			require.Len(t, res, 1)
			require.Equal(t, "I am baby Groot", res[0].Name)
			require.ElementsMatch(t, res[0].Groups, []string{babyCreaturesDN})
			require.Len(t, res[0].OrgRoles, 1)
			role, mappingExist := res[0].OrgRoles[2]
			require.True(t, mappingExist)
			require.Equal(t, identity.RoleEditor, role)
			require.False(t, res[0].IsDisabled)
			require.NotNil(t, res[0].IsGrafanaAdmin)
			assert.False(t, *res[0].IsGrafanaAdmin)
		})
	})
}

func TestServer_UserBind(t *testing.T) {
	t.Run("use provided DN and password", func(t *testing.T) {
		connection := &MockConnection{}
		var actualUsername, actualPassword string
		connection.BindProvider = func(username, password string) error {
			actualUsername = username
			actualPassword = password
			return nil
		}
		server := &Server{
			Connection: connection,
			Config: &ServerConfig{
				BindDN: "cn=admin,dc=grafana,dc=org",
			},
		}

		dn := "cn=user,ou=users,dc=grafana,dc=org"
		err := server.UserBind(dn, "pwd")

		require.NoError(t, err)
		assert.Equal(t, dn, actualUsername)
		assert.Equal(t, "pwd", actualPassword)
	})

	t.Run("error", func(t *testing.T) {
		connection := &MockConnection{}
		expected := &ldap.Error{
			ResultCode: uint16(25),
		}
		connection.BindProvider = func(username, password string) error {
			return expected
		}
		server := &Server{
			Connection: connection,
			Config: &ServerConfig{
				BindDN: "cn=%s,ou=users,dc=grafana,dc=org",
			},
			log: log.New("test-logger"),
		}
		err := server.UserBind("user", "pwd")
		assert.ErrorIs(t, err, expected)
	})
}

func TestServer_AdminBind(t *testing.T) {
	t.Run("use admin DN and password", func(t *testing.T) {
		connection := &MockConnection{}
		var actualUsername, actualPassword string
		connection.BindProvider = func(username, password string) error {
			actualUsername = username
			actualPassword = password
			return nil
		}

		dn := "cn=admin,dc=grafana,dc=org"

		server := &Server{
			Connection: connection,
			Config: &ServerConfig{
				BindPassword: "pwd",
				BindDN:       dn,
			},
		}

		err := server.AdminBind()
		require.NoError(t, err)

		assert.Equal(t, dn, actualUsername)
		assert.Equal(t, "pwd", actualPassword)
	})

	t.Run("error", func(t *testing.T) {
		connection := &MockConnection{}
		expected := &ldap.Error{
			ResultCode: uint16(25),
		}
		connection.BindProvider = func(username, password string) error {
			return expected
		}

		dn := "cn=admin,dc=grafana,dc=org"

		server := &Server{
			Connection: connection,
			Config: &ServerConfig{
				BindPassword: "pwd",
				BindDN:       dn,
			},
			log: log.New("test-logger"),
		}

		err := server.AdminBind()
		assert.ErrorIs(t, err, expected)
	})
}
