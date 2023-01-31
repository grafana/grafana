package social

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const testOktaUserRawJSON = `{
  "sub": "00u7dfyci33dabAc25d7",
  "name": "Okta Grafana",
  "locale": "en_US",
  "email": "okta-grafana-test@grafana.com",
  "preferred_username": "okta-grafana-test@grafana.com",
  "given_name": "Okta",
  "family_name": "Grafana",
  "zoneinfo": "UTC",
  "updated_at": 1669222099,
  "email_verified": true
}`

func TestSocialOkta_UserInfo(t *testing.T) {
	var boolPointer *bool
	tests := []struct {
		name                   string
		userRawJSON            string
		autoAssignOrgRole      string
		settingSkipOrgRoleSync bool
		roleAttributePath      string
		want                   *BasicUserInfo
		wantErr                bool
	}{
		{
			name:              "Basic User info",
			userRawJSON:       testOktaUserRawJSON,
			autoAssignOrgRole: "Editor",
			roleAttributePath: "",
			want: &BasicUserInfo{
				Id:             "1",
				Name:           "monalisa octocat",
				Email:          "octocat@github.com",
				Login:          "octocat",
				Role:           "",
				IsGrafanaAdmin: boolPointer,
			},
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

			s := &SocialOkta{
				SocialBase: newSocialBase("okta", &oauth2.Config{},
					&OAuthInfo{RoleAttributePath: tt.roleAttributePath}, tt.autoAssignOrgRole, false, *featuremgmt.WithFeatures()),
				apiUrl:          server.URL + "/user",
				skipOrgRoleSync: tt.settingSkipOrgRoleSync,
			}

			// create a oauth2 token with a id_token
			token := &oauth2.Token{}
			token = token.WithExtra(map[string]interface{}{"id_token": "eyJraWQiOiJLT1FJT2wwbEhtYUJiam1zVVBOald2Y082b1E1eWdvdUhibUtPRms3YUNFIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwMHU3ZGZ5Y2kzM2RhYkFjMjVkNyIsIm5hbWUiOiJPa3RhIEdyYWZhbmEiLCJlbWFpbCI6Im9rdGEtZ3JhZmFuYS10ZXN0QGdyYWZhbmEuY29tIiwidmVyIjoxLCJpc3MiOiJodHRwczovL2Rldi0yNTQxNjU0NS5va3RhLmNvbSIsImF1ZCI6IjBvYTdkZnkzb2d4WlZWUE1qNWQ3IiwiaWF0IjoxNjc1MDgyNjUwLCJleHAiOjE2NzUwODYyNTAsImp0aSI6IklELnNvRGlTUkFJR0ZaamI2ZHhCbzUzX3BHc2llaUlqdVFQX3hpVkdySUdUNGciLCJhbXIiOlsicHdkIl0sImlkcCI6IjAwbzZpa3pxempsOXhJUjgwNWQ3IiwicHJlZmVycmVkX3VzZXJuYW1lIjoib2t0YS1ncmFmYW5hLXRlc3RAZ3JhZmFuYS5jb20iLCJhdXRoX3RpbWUiOjE2NzUwNzg5NjUsImF0X2hhc2giOiJKUURfbzhDcGM3U3lBWGVYR1ZvMmZ3In0.Ee9bUOi1Fki4gfuymRhInt_6vzydConbfiemg552U-YlAgYTOGPBrfIoCxSZjBlF0EkONMs3bmmNzfi1CT_McBlEpXnl3KZcHjP2hSKrMLNJX8aUf3FXsL2_tbnjSr_0kuI2r1OrlWjdp7FZ4Inn564Ppq583MaE-qp0EgFpmj7_2bdh_oG8VjDYWM0nqLzEroCYr8rh2yptMBu89MOFnPwzS7ilQdT7zg6FtTgajJb46hVAzR_PeWEJIg1-xZfV4SNjlZ2zfW3d04vnI1k_UE2wTX3L76ew0tUBOscoode_zAvDAD0nPDykLivp8byQkZdfN3wS0k5axP6yTTaBLg"})

			got, err := s.UserInfo(server.Client(), token)
			if (err != nil) != tt.wantErr {
				t.Errorf("UserInfo() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("UserInfo() got = %v, want %v", got, tt.want)
			}
		})
	}
}
