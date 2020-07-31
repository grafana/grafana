package social

import (
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

func TestSocialAzureAD_UserInfo(t *testing.T) {
	type fields struct {
		allowedGroups []string
	}
	type args struct {
		client *http.Client
	}

	tests := []struct {
		name    string
		fields  fields
		claims  *azureClaims
		args    args
		want    *BasicUserInfo
		wantErr bool
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
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_VIEWER,
				},
				Groups: []string{},
			},
		},
		{
			name: "No email",
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
			name:    "No id token",
			claims:  nil,
			want:    nil,
			wantErr: true,
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
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_VIEWER,
				},
				Groups: []string{},
			},
		},
		{
			name: "Admin role",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Admin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
				Groups: []string{},
			},
		},
		{
			name: "Lowercase Admin role",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"admin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
				Groups: []string{},
			},
		},
		{
			name: "Only other roles",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"AppAdmin"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_VIEWER,
				},
				Groups: []string{},
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
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_EDITOR,
				},
				Groups: []string{},
			},
		},
		{
			name: "Admin and Editor roles in claim",
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{"Admin", "Editor"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_ADMIN,
				},
				Groups: []string{},
			},
		},
		{
			name: "Error if user is not a member of allowed_groups",
			fields: fields{
				allowedGroups: []string{"dead-beef"},
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
			name: "Error if user is a member of allowed_groups",
			fields: fields{
				allowedGroups: []string{"foo", "bar"},
			},
			claims: &azureClaims{
				Email:             "me@example.com",
				PreferredUsername: "",
				Roles:             []string{},
				Groups:            []string{"foo"},
				Name:              "My Name",
				ID:                "1234",
			},
			want: &BasicUserInfo{
				Id:      "1234",
				Name:    "My Name",
				Email:   "me@example.com",
				Login:   "me@example.com",
				Company: "",
				OrgMemberships: map[int64]models.RoleType{
					1: models.ROLE_VIEWER,
				},
				Groups: []string{"foo"},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &SocialAzureAD{
				SocialBase: &SocialBase{
					log: log.New("test"),
				},
				allowedGroups: tt.fields.allowedGroups,
			}

			key := []byte("secret")
			sig, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: key}, (&jose.SignerOptions{}).WithType("JWT"))
			require.NoError(t, err)

			cl := jwt.Claims{
				Subject:   "subject",
				Issuer:    "issuer",
				NotBefore: jwt.NewNumericDate(time.Date(2016, 1, 1, 0, 0, 0, 0, time.UTC)),
				Audience:  jwt.Audience{"leela", "fry"},
			}

			var raw string
			if tt.claims != nil {
				raw, err = jwt.Signed(sig).Claims(cl).Claims(tt.claims).CompactSerialize()
				require.NoError(t, err)
			} else {
				raw, err = jwt.Signed(sig).Claims(cl).CompactSerialize()
				require.NoError(t, err)
			}

			token := &oauth2.Token{}
			if tt.claims != nil {
				token = token.WithExtra(map[string]interface{}{"id_token": raw})
			}

			got, err := s.UserInfo(tt.args.client, token)
			if tt.wantErr {
				require.Error(t, err)
			}

			assert.Equal(t, tt.want, got)
		})
	}
}
