package dtos

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestIsHiddenUser(t *testing.T) {
	emptyHiddenUsers := map[string]struct{}{}
	hiddenUser := map[string]struct{}{
		"user": {},
	}

	testcases := []struct {
		desc         string
		userLogin    string
		signedInUser *user.SignedInUser
		hiddenUsers  map[string]struct{}
		expected     bool
	}{
		{
			desc:      "non-server admin user should see non-hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: emptyHiddenUsers,
			expected:    false,
		},
		{
			desc:      "non-server admin user should not see hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: hiddenUser,
			expected:    true,
		},
		{
			desc:      "non-server admin user should see himself, even if he's hidden",
			userLogin: "admin",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: map[string]struct{}{
				"admin": {},
			},
			expected: false,
		},
		{
			desc:      "server admin user should see hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: true,
				Login:          "admin",
			},
			hiddenUsers: hiddenUser,
			expected:    false,
		},
		{
			desc:      "server admin user should see non-hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: true,
				Login:          "admin",
			},
			hiddenUsers: emptyHiddenUsers,
			expected:    false,
		},
	}

	for _, c := range testcases {
		t.Run(c.desc, func(t *testing.T) {
			isHidden := IsHiddenUser(c.userLogin, c.signedInUser, &setting.Cfg{
				HiddenUsers: c.hiddenUsers,
			})
			assert.Equal(t, c.expected, isHidden)
		})
	}
}
