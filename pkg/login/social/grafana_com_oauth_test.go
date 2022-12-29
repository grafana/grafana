package social

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/require"
)

func TestSocialGrafanaCom_UserInfo(t *testing.T) {
	provider := SocialGrafanaCom{
		SocialBase: &SocialBase{
			log: newLogger("gitlab_oauth_test", "debug"),
		},
	}

	type conf struct {
		skipOrgRoleSync bool
	}

	tests := []struct {
		Name          string
		Cfg           conf
		ExpectedRole  org.RoleType
		ExpectedError error
	}{
		{
			Name:         "should return empty role as userInfo when Skip Org Role Sync Enabled",
			Cfg:          conf{skipOrgRoleSync: true},
			ExpectedRole: "",
		},
	}

	for _, test := range tests {
		provider.skipOrgRoleSync = test.Cfg.skipOrgRoleSync

		t.Run(test.Name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				switch r.RequestURI {
				case userURI:
					_, err := w.Write([]byte(test.UserRespBody))
					require.NoError(t, err)
				case groupsURI:
					_, err := w.Write([]byte(test.GroupsRespBody))
					require.NoError(t, err)
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			actualResult, err := provider.UserInfo(ts.Client(), nil)
			if test.ExpectedError != nil {
				require.Equal(t, err, test.ExpectedError)
				return
			}

			require.NoError(t, err)
			require.Equal(t, test.ExpectedRole, actualResult.Role)
		})
	}
}
