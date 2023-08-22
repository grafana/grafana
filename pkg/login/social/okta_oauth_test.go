package social

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestSocialOkta_UserInfo(t *testing.T) {
	var boolPointer *bool

	tests := []struct {
		name                    string
		userRawJSON             string
		OAuth2Extra             interface{}
		autoAssignOrgRole       string
		settingSkipOrgRoleSync  bool
		allowAssignGrafanaAdmin bool
		RoleAttributePath       string
		ExpectedEmail           string
		ExpectedRole            roletype.RoleType
		ExpectedGrafanaAdmin    *bool
		ExpectedErr             error
		wantErr                 bool
	}{
		{
			name:              "Should give role from JSON and email from id token",
			userRawJSON:       `{ "email": "okta-octopus@grafana.com", "role": "Admin" }`,
			RoleAttributePath: "role",
			OAuth2Extra: map[string]interface{}{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			ExpectedEmail:        "okto.octopus@test.com",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: boolPointer,
			wantErr:              false,
		},
		{
			name:                   "Should give empty role and nil pointer for GrafanaAdmin when skip org role sync enable",
			userRawJSON:            `{ "email": "okta-octopus@grafana.com", "role": "Admin" }`,
			RoleAttributePath:      "role",
			settingSkipOrgRoleSync: true,
			OAuth2Extra: map[string]interface{}{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			ExpectedEmail:        "okto.octopus@test.com",
			ExpectedRole:         "",
			ExpectedGrafanaAdmin: boolPointer,
			wantErr:              false,
		},
		{
			name:                    "Should give grafanaAdmin role for specific GrafanaAdmin in the role assignement",
			userRawJSON:             fmt.Sprintf(`{ "email": "okta-octopus@grafana.com", "role": "%s" }`, RoleGrafanaAdmin),
			RoleAttributePath:       "role",
			allowAssignGrafanaAdmin: true,
			OAuth2Extra: map[string]interface{}{
				// {
				// "email": "okto.octopus@test.com"
				// },
				"id_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQWRtaW4iLCJlbWFpbCI6Im9rdG8ub2N0b3B1c0B0ZXN0LmNvbSJ9.yhg0nvYCpMVCVrRvwtmHzhF0RJqid_YFbjJ_xuBCyHs",
			},
			ExpectedEmail:        "okto.octopus@test.com",
			ExpectedRole:         "Admin",
			ExpectedGrafanaAdmin: trueBoolPtr(),
			wantErr:              false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.WriteHeader(http.StatusOK)
				// return JSON if matches user endpoint
				if strings.HasSuffix(request.URL.String(), "/user") {
					writer.Header().Set("Content-Type", "application/json")
					_, err := writer.Write([]byte(tt.userRawJSON))
					require.NoError(t, err)
				} else {
					writer.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()
			provider := &SocialOkta{
				SocialBase: newSocialBase("okta", &oauth2.Config{},
					&OAuthInfo{RoleAttributePath: tt.RoleAttributePath}, tt.autoAssignOrgRole, false, *featuremgmt.WithFeatures()),
				apiUrl:          server.URL + "/user",
				skipOrgRoleSync: tt.settingSkipOrgRoleSync,
			}
			provider.allowAssignGrafanaAdmin = tt.allowAssignGrafanaAdmin
			provider.roleAttributePath = tt.RoleAttributePath
			// create a oauth2 token with a id_token
			staticToken := oauth2.Token{
				AccessToken:  "",
				TokenType:    "",
				RefreshToken: "",
				Expiry:       time.Now(),
			}
			token := staticToken.WithExtra(tt.OAuth2Extra)
			got, err := provider.UserInfo(context.Background(), server.Client(), token)
			if (err != nil) != tt.wantErr {
				t.Errorf("UserInfo() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.Equal(t, tt.ExpectedEmail, got.Email)
			require.Equal(t, tt.ExpectedRole, got.Role)
			require.Equal(t, tt.ExpectedGrafanaAdmin, got.IsGrafanaAdmin)
		})
	}
}
