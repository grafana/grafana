package connectors

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func trueBoolPtr() *bool {
	b := true
	return &b
}

func falseBoolPtr() *bool {
	b := false
	return &b
}

func TestSocialAzureAD_UserInfo(t *testing.T) {
	type fields struct {
		providerCfg *social.OAuthInfo
		cfg         *setting.Cfg
		usGovURL    bool
	}
	type args struct {
		client *http.Client
	}

	tests := []struct {
		name                     string
		fields                   fields
		claims                   *azureClaims
		args                     args
		settingAutoAssignOrgRole string
		want                     *social.BasicUserInfo
		wantErr                  bool
	}{
		{
			name: "Email in email claim",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{},
			},
		},
		{
			name: "No email",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "",
				PreferredUsername: "",
				Roles:             []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name:   "No id token",
			claims: nil,
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "US Government domain",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
				usGovURL: true,
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{},
			},
		},
		{
			name: "Email in preferred_username claim",
			claims: &azureClaims{
				Email:             "",
				PreferredUsername: "me@example.com",
				Roles:             []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{},
			},
		},
		{
			name: "Admin role",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Admin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:   []string{},
			},
		},
		{
			name: "Lowercase Admin role",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"admin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:   []string{},
			},
		},
		{
			name: "Only other roles",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"AppAdmin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{},
			},
		},
		{
			name: "role from env variable",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{},
			},
		},
		{
			name: "Editor role",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
				Groups:   []string{},
			},
		},
		{
			name: "Admin and Editor roles in claim",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Admin", "Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:   []string{},
			},
		},
		{
			name: "Grafana Admin but setting is disabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: false,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},

			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"GrafanaAdmin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:             "1234",
				Name:           "My Name",
				Email:          "me@example.com",
				Login:          "me@example.com",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:         []string{},
				IsGrafanaAdmin: nil,
			},
		},
		{
			name: "Editor roles in claim and GrafanaAdminAssignment enabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: true,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:             "1234",
				Name:           "My Name",
				Email:          "me@example.com",
				Login:          "me@example.com",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleEditor},
				Groups:         []string{},
				IsGrafanaAdmin: falseBoolPtr(),
			},
		},
		{
			name: "Grafana Admin and Editor roles in claim",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: true,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"GrafanaAdmin", "Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:             "1234",
				Name:           "My Name",
				Email:          "me@example.com",
				Login:          "me@example.com",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
				Groups:         []string{},
				IsGrafanaAdmin: trueBoolPtr(),
			},
		},
		{
			name: "Error if user is not a member of allowed_groups",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: false,
					AllowedGroups:           []string{"dead-beef"},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"foo", "bar"},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "Error if user is not a member of allowed_organizations",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: false,
					Extra: map[string]string{
						"allowed_organizations": "uuid-1234",
					},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Editor",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				TenantID:          "uuid-5678",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"foo", "bar"},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "No error if user is a member of allowed_organizations",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
					Extra: map[string]string{
						"allowed_organizations": "uuid-1234,uuid-5678",
					},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				TenantID:          "uuid-5678",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"foo", "bar"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"foo", "bar"},
			},
			wantErr: false,
		},
		{
			name: "No Error if user is a member of allowed_groups",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: false,
					AllowedGroups:           []string{"foo", "bar"},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"foo"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"foo"},
			},
		},
		{
			name: "Error if user does not have groups but allowed groups",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: false,
					AllowedGroups:           []string{"foo", "bar"},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{""},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "Fetch groups when ClaimsNames and ClaimsSources is set",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				ID:                "1",
				Name:              "test",
				PreferredUsername: "test",
				Email:             "test@test.com",
				Roles:             []string{"Viewer"},
				ClaimNames:        claimNames{Groups: "src1"},
				ClaimSources:      nil, // set by the test
			},
			settingAutoAssignOrgRole: "",
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "test",
				Email:    "test@test.com",
				Login:    "test@test.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"from_server"},
			},
			wantErr: false,
		},
		{
			name: "Fetch groups when forceUseGraphAPI is set",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:     "azuread",
					ClientId: "client-id-example",
					Extra: map[string]string{
						"force_use_graph_api": "true",
					},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				ID:                "1",
				Name:              "test",
				PreferredUsername: "test",
				Email:             "test@test.com",
				Roles:             []string{"Viewer"},
				ClaimNames:        claimNames{Groups: "src1"},
				ClaimSources:      nil,                    // set by the test
				Groups:            []string{"foo", "bar"}, // must be ignored
			},
			settingAutoAssignOrgRole: "",
			want: &social.BasicUserInfo{
				Id:       "1",
				Name:     "test",
				Email:    "test@test.com",
				Login:    "test@test.com",
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
				Groups:   []string{"from_server"},
			},
			wantErr: false,
		},
		{
			name: "Fetch empty role when strict attribute role is true and no match",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"foo"},
				Groups:            []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "Fetch empty role when strict attribute role is true and no role claims returned",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{},
				Name:              "My Name",
				ID:                "1234",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name: "should map role when org mapping is set, IdP returns with invalid role and role attribute strict is enabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
					OrgMapping:          []string{"group1:Org4:Editor", "*:5:Viewer"},
				},
				cfg: &setting.Cfg{},
			},
			claims: &azureClaims{
				PreferredUsername: "",
				Roles:             []string{"Invalid"},
				Groups:            []string{"group1", "group3"},
				Name:              "My Name",
				ID:                "1234",
				Email:             "me@example.com",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{4: org.RoleEditor, 5: org.RoleViewer},
				Groups:   []string{"group1", "group3"},
			},
		},
		{
			name: "should map role when org mapping is set and IdP returns with empty role list",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:       "azuread",
					ClientId:   "client-id-example",
					OrgMapping: []string{"group1:Org4:Editor", "group2:5:Viewer"},
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "Viewer",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"group1"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{4: org.RoleEditor},
				Groups:   []string{"group1"},
			},
		},
		{
			name: "should map role when only org mapping is set and role attribute strict is enabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
					OrgMapping:          []string{"group1:Org4:Editor", "*:5:Viewer"},
				},
				cfg: &setting.Cfg{},
			},
			claims: &azureClaims{
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"group1", "group3"},
				Name:              "My Name",
				ID:                "1234",
				Email:             "me@example.com",
			},
			want: &social.BasicUserInfo{
				Id:       "1234",
				Name:     "My Name",
				Email:    "me@example.com",
				Login:    "me@example.com",
				OrgRoles: map[int64]org.RoleType{4: org.RoleEditor, 5: org.RoleViewer},
				Groups:   []string{"group1", "group3"},
			},
		},
		{
			name: "should return error when roles claim is empty and org mapping doesn't evaluate to any role and role attribute strict is enabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
					OrgMapping:          []string{"group1:Org4:Editor"},
				},
				cfg: &setting.Cfg{},
			},
			claims: &azureClaims{
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"group2"},
				Name:              "My Name",
				ID:                "1234",
			},
			wantErr: true,
		},
		{
			name: "should return error when roles claim is empty and org mapping is empty and role attribute strict is enabled",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                "azuread",
					ClientId:            "client-id-example",
					RoleAttributeStrict: true,
					OrgMapping:          []string{},
				},
				cfg: &setting.Cfg{},
			},
			claims: &azureClaims{
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"group2"},
				Name:              "My Name",
				ID:                "1234",
			},
			wantErr: true,
		},
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	// Instantiate a signer using RSASSA-PSS (SHA256) with the given private key.
	sig, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.PS256, Key: privateKey}, (&jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{"kid": "1"},
	}).WithType("JWT"))
	require.NoError(t, err)

	// generate JWKS
	jwks := &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{
				Key:       privateKey.Public(),
				KeyID:     "1",
				Algorithm: "PS256",
				Use:       "sig",
			},
		},
	}

	authURL := "https://login.microsoftonline.com/1234/oauth2/v2.0/authorize"
	usGovAuthURL := "https://login.microsoftonline.us/1234/oauth2/v2.0/authorize"

	cache := remotecache.NewFakeCacheStorage()
	// put JWKS in cache
	jwksDump, err := json.Marshal(jwks)
	require.NoError(t, err)

	err = cache.Set(context.Background(), azureCacheKeyPrefix+"client-id-example", jwksDump, 0)
	require.NoError(t, err)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewAzureADProvider(tt.fields.providerCfg,
				tt.fields.cfg,
				ProvideOrgRoleMapper(tt.fields.cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures(),
				cache)

			if tt.fields.usGovURL {
				s.Endpoint.AuthURL = usGovAuthURL
			} else {
				s.Endpoint.AuthURL = authURL
			}

			cl := jwt.Claims{
				Audience:  jwt.Audience{"client-id-example"},
				Subject:   "subject",
				Issuer:    "issuer",
				NotBefore: jwt.NewNumericDate(time.Date(2016, 1, 1, 0, 0, 0, 0, time.UTC)),
			}

			var raw string
			if tt.claims != nil {
				tt.claims.Audience = "client-id-example"
				if tt.claims.ClaimNames.Groups != "" {
					server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
						tokenParts := strings.Split(request.Header.Get("Authorization"), " ")
						require.Len(t, tokenParts, 2)
						require.Equal(t, "fake_token", tokenParts[1])

						writer.WriteHeader(http.StatusOK)

						type response struct {
							Value []string
						}
						res := response{Value: []string{"from_server"}}
						require.NoError(t, json.NewEncoder(writer).Encode(&res))
					}))
					// need to set the fake servers url as endpoint to capture request
					tt.claims.ClaimSources = map[string]claimSource{
						tt.claims.ClaimNames.Groups: {Endpoint: server.URL},
					}
				}
				raw, err = jwt.Signed(sig).Claims(cl).Claims(tt.claims).Serialize()
				require.NoError(t, err)
			} else {
				raw, err = jwt.Signed(sig).Claims(cl).Serialize()
				require.NoError(t, err)
			}

			token := &oauth2.Token{
				AccessToken: "fake_token",
			}
			if tt.claims != nil {
				token = token.WithExtra(map[string]any{"id_token": raw})
			}

			tt.args.client = s.Client(context.Background(), token)

			got, err := s.UserInfo(context.Background(), tt.args.client, token)
			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.EqualValues(t, tt.want, got)
		})
	}
}

func TestSocialAzureAD_SkipOrgRole(t *testing.T) {
	type fields struct {
		SocialBase  *SocialBase
		providerCfg *social.OAuthInfo
		cfg         *setting.Cfg
	}

	tests := []struct {
		name                     string
		fields                   fields
		claims                   *azureClaims
		settingAutoAssignOrgRole string
		want                     *social.BasicUserInfo
		wantErr                  bool
	}{
		{
			name: "Grafana Admin and Editor roles in claim, skipOrgRoleSync disabled should get roles",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: true,
					SkipOrgRoleSync:         false,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"GrafanaAdmin", "Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:             "1234",
				Name:           "My Name",
				Email:          "me@example.com",
				Login:          "me@example.com",
				OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
				IsGrafanaAdmin: trueBoolPtr(),
				Groups:         []string{},
			},
		},
		{
			name: "Grafana Admin and Editor roles in claim, skipOrgRoleSync enabled should not get roles",
			fields: fields{
				providerCfg: &social.OAuthInfo{
					Name:                    "azuread",
					ClientId:                "client-id-example",
					AllowAssignGrafanaAdmin: true,
					SkipOrgRoleSync:         true,
				},
				cfg: &setting.Cfg{
					AutoAssignOrgRole: "",
				},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"GrafanaAdmin", "Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &social.BasicUserInfo{
				Id:     "1234",
				Name:   "My Name",
				Email:  "me@example.com",
				Login:  "me@example.com",
				Groups: []string{},
			},
		},
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	// Instantiate a signer using RSASSA-PSS (SHA256) with the given private key.
	sig, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.PS256, Key: privateKey}, (&jose.SignerOptions{
		ExtraHeaders: map[jose.HeaderKey]any{"kid": "1"},
	}).WithType("JWT"))
	require.NoError(t, err)

	// generate JWKS
	jwks := &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{
				Key:       privateKey.Public(),
				KeyID:     "1",
				Algorithm: string(jose.PS256),
				Use:       "sig",
			},
		},
	}

	authURL := "https://login.microsoftonline.com/1234/oauth2/v2.0/authorize"
	cache := remotecache.NewFakeCacheStorage()
	// put JWKS in cache
	jwksDump, err := json.Marshal(jwks)
	require.NoError(t, err)

	err = cache.Set(context.Background(), azureCacheKeyPrefix+"client-id-example", jwksDump, 0)
	require.NoError(t, err)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewAzureADProvider(tt.fields.providerCfg,
				tt.fields.cfg,
				ProvideOrgRoleMapper(tt.fields.cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				ssosettingstests.NewFakeService(),
				featuremgmt.WithFeatures(),
				cache)

			s.Endpoint.AuthURL = authURL

			cl := jwt.Claims{
				Subject:   "subject",
				Issuer:    "issuer",
				NotBefore: jwt.NewNumericDate(time.Date(2016, 1, 1, 0, 0, 0, 0, time.UTC)),
				Audience:  jwt.Audience{"leela", "fry"},
			}

			var raw string
			if tt.claims != nil {
				tt.claims.Audience = "client-id-example"
				if tt.claims.ClaimNames.Groups != "" {
					server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
						tokenParts := strings.Split(request.Header.Get("Authorization"), " ")
						require.Len(t, tokenParts, 2)
						require.Equal(t, "fake_token", tokenParts[1])

						writer.WriteHeader(http.StatusOK)

						type response struct {
							Value []string
						}
						res := response{Value: []string{"from_server"}}
						require.NoError(t, json.NewEncoder(writer).Encode(&res))
					}))
					// need to set the fake servers url as endpoint to capture request
					tt.claims.ClaimSources = map[string]claimSource{
						tt.claims.ClaimNames.Groups: {Endpoint: server.URL},
					}
				}
				raw, err = jwt.Signed(sig).Claims(cl).Claims(tt.claims).Serialize()
				require.NoError(t, err)
			} else {
				raw, err = jwt.Signed(sig).Claims(cl).Serialize()
				require.NoError(t, err)
			}

			token := &oauth2.Token{
				AccessToken: "fake_token",
			}
			if tt.claims != nil {
				token = token.WithExtra(map[string]any{"id_token": raw})
			}

			provClient := s.Client(context.Background(), token)

			got, err := s.UserInfo(context.Background(), provClient, token)
			if (err != nil) != tt.wantErr {
				t.Errorf("UserInfo() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			require.EqualValues(t, tt.want, got)
		})
	}
}

func TestSocialAzureAD_InitializeExtraFields(t *testing.T) {
	type settingFields struct {
		forceUseGraphAPI     bool
		allowedOrganizations []string
	}
	testCases := []struct {
		name     string
		settings *social.OAuthInfo
		want     settingFields
	}{
		{
			name: "forceUseGraphAPI is set to true",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"force_use_graph_api": "true",
				},
			},
			want: settingFields{
				forceUseGraphAPI:     true,
				allowedOrganizations: []string{},
			},
		},
		{
			name: "allowedOrganizations is set",
			settings: &social.OAuthInfo{
				Extra: map[string]string{
					"allowed_organizations": "uuid-1234,uuid-5678",
				},
			},
			want: settingFields{
				forceUseGraphAPI:     false,
				allowedOrganizations: []string{"uuid-1234", "uuid-5678"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewAzureADProvider(tc.settings, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures(), nil)

			require.Equal(t, tc.want.forceUseGraphAPI, s.forceUseGraphAPI)
			require.Equal(t, tc.want.allowedOrganizations, s.allowedOrganizations)
		})
	}
}

func TestSocialAzureAD_Validate(t *testing.T) {
	testCases := []struct {
		name      string
		settings  ssoModels.SSOSettings
		requester identity.Requester
		wantErr   error
	}{
		{
			name: "SSOSettings is valid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_authentication":      "client_secret_post",
					"client_id":                  "client-id",
					"client_secret":              "client_secret",
					"allowed_groups":             "0bb9c9cc-4945-418f-9b6a-c1d3b81141b0, 6034d328-0e6a-4240-8d03-cb9f2c1f16e4",
					"allow_assign_grafana_admin": "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
		},
		{
			name: "SSOSettings is valid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_authentication":         "managed_identity",
					"client_id":                     "client-id",
					"managed_identity_client_id":    "managed-identity-client-id",
					"federated_credential_audience": "api://AzureADTokenExchange",
					"allowed_groups":                "0bb9c9cc-4945-418f-9b6a-c1d3b81141b0, 6034d328-0e6a-4240-8d03-cb9f2c1f16e4",
					"allow_assign_grafana_admin":    "true",
					"auth_url":                      "https://example.com/auth",
					"token_url":                     "https://example.com/token",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
		},
		{
			name: "fails if settings map contains an invalid field",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "client-id",
					"invalid_field": []int{1, 2, 3},
				},
			},
			wantErr: ssosettings.ErrInvalidSettings,
		},
		{
			name: "fails if client id is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if client id does not exist",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if allowed groups are not uuids",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":      "client-id",
					"allowed_groups": "abc, def",
					"auth_url":       "https://example.com/auth",
					"token_url":      "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if both allow assign grafana admin and skip org role sync are enabled",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"skip_org_role_sync":         "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
				},
			},
			requester: &user.SignedInUser{IsGrafanaAdmin: true},
			wantErr:   ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if the user is not allowed to update allow assign grafana admin",
			requester: &user.SignedInUser{
				IsGrafanaAdmin: false,
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":                  "client-id",
					"allow_assign_grafana_admin": "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if auth url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if token url is empty",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if auth url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "invalid_url",
					"token_url": "https://example.com/token",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if token url is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id": "client-id",
					"auth_url":  "https://example.com/auth",
					"token_url": "/path",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
		{
			name: "fails if login prompt is invalid",
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_authentication":      "client_secret_post",
					"client_id":                  "client-id",
					"client_secret":              "client_secret",
					"allowed_groups":             "0bb9c9cc-4945-418f-9b6a-c1d3b81141b0, 6034d328-0e6a-4240-8d03-cb9f2c1f16e4",
					"allow_assign_grafana_admin": "true",
					"auth_url":                   "https://example.com/auth",
					"token_url":                  "https://example.com/token",
					"login_prompt":               "invalid",
				},
			},
			wantErr: ssosettings.ErrBaseInvalidOAuthConfig,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewAzureADProvider(&social.OAuthInfo{}, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures(), nil)

			if tc.requester == nil {
				tc.requester = &user.SignedInUser{IsGrafanaAdmin: false}
			}
			err := s.Validate(context.Background(), tc.settings, ssoModels.SSOSettings{}, tc.requester)
			if tc.wantErr != nil {
				require.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestSocialAzureAD_Reload(t *testing.T) {
	testCases := []struct {
		name           string
		info           *social.OAuthInfo
		settings       ssoModels.SSOSettings
		expectError    bool
		expectedInfo   *social.OAuthInfo
		expectedConfig *oauth2.Config
	}{
		{
			name: "SSO provider successfully updated",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "new-client-id",
					"client_secret": "new-client-secret",
					"auth_url":      "some-new-url",
					"login_prompt":  "select_account",
				},
			},
			expectError: false,
			expectedInfo: &social.OAuthInfo{
				ClientId:     "new-client-id",
				ClientSecret: "new-client-secret",
				AuthUrl:      "some-new-url",
				LoginPrompt:  "select_account",
			},
			expectedConfig: &oauth2.Config{
				ClientID:     "new-client-id",
				ClientSecret: "new-client-secret",
				Endpoint: oauth2.Endpoint{
					AuthURL: "some-new-url",
				},
				RedirectURL: "/login/azuread",
			},
		},
		{
			name: "fails if settings contain invalid values",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"client_id":     "new-client-id",
					"client_secret": "new-client-secret",
					"auth_url":      []string{"first", "second"},
				},
			},
			expectError: true,
			expectedInfo: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
			},
			expectedConfig: &oauth2.Config{
				ClientID:     "client-id",
				ClientSecret: "client-secret",
				RedirectURL:  "/login/azuread",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewAzureADProvider(tc.info, &setting.Cfg{}, nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures(), nil)

			err := s.Reload(context.Background(), tc.settings)
			if tc.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tc.expectedInfo, s.info)
			require.EqualValues(t, tc.expectedConfig, s.Config)
		})
	}
}

func TestSocialAzureAD_Reload_ExtraFields(t *testing.T) {
	testCases := []struct {
		name                         string
		settings                     ssoModels.SSOSettings
		info                         *social.OAuthInfo
		expectError                  bool
		expectedInfo                 *social.OAuthInfo
		expectedAllowedOrganizations []string
		expectedForceUseGraphApi     bool
	}{
		{
			name: "successfully reloads the settings",
			info: &social.OAuthInfo{
				ClientId:     "client-id",
				ClientSecret: "client-secret",
				Extra: map[string]string{
					"allowed_organizations": "previous",
					"force_use_graph_api":   "true",
				},
			},
			settings: ssoModels.SSOSettings{
				Settings: map[string]any{
					"allowed_organizations": "uuid-1234,uuid-5678",
					"force_use_graph_api":   "false",
				},
			},
			expectedInfo: &social.OAuthInfo{
				ClientId:     "new-client-id",
				ClientSecret: "new-client-secret",
				Name:         "a-new-name",
				Extra: map[string]string{
					"allowed_organizations": "uuid-1234,uuid-5678",
					"force_use_graph_api":   "false",
				},
			},
			expectedAllowedOrganizations: []string{"uuid-1234", "uuid-5678"},
			expectedForceUseGraphApi:     false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := NewAzureADProvider(tc.info, setting.NewCfg(), nil, ssosettingstests.NewFakeService(), featuremgmt.WithFeatures(), remotecache.FakeCacheStorage{})

			err := s.Reload(context.Background(), tc.settings)
			require.NoError(t, err)

			require.EqualValues(t, tc.expectedAllowedOrganizations, s.allowedOrganizations)
			require.EqualValues(t, tc.expectedForceUseGraphApi, s.forceUseGraphAPI)
		})
	}
}
