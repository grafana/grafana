package user

import (
	"testing"

	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSetAvatarURLs(t *testing.T) {
	hits := func() []iamv0.GetSearchUsersUserHit {
		return []iamv0.GetSearchUsersUserHit{{Email: "Jane@Example.com "}, {Email: "jane@example.com"}, {Email: ""}}
	}

	t.Run("hashes the normalised email and honours the sub url", func(t *testing.T) {
		h := hits()
		setAvatarURLs(&setting.Cfg{AppSubURL: "/grafana"}, h)
		require.NotNil(t, h[0].AvatarUrl)
		require.Regexp(t, `^/grafana/avatar/[0-9a-f]{64}$`, *h[0].AvatarUrl)
		require.Equal(t, *h[0].AvatarUrl, *h[1].AvatarUrl)
		require.Nil(t, h[2].AvatarUrl)
	})

	t.Run("uses the default image when gravatar is disabled", func(t *testing.T) {
		h := hits()
		setAvatarURLs(&setting.Cfg{DisableGravatar: true}, h)
		require.NotNil(t, h[0].AvatarUrl)
		require.Equal(t, "/public/img/user_profile.png", *h[0].AvatarUrl)
	})

	t.Run("tolerates a nil config", func(t *testing.T) {
		h := hits()
		setAvatarURLs(nil, h)
		require.NotNil(t, h[0].AvatarUrl)
		require.Regexp(t, `^/avatar/[0-9a-f]{64}$`, *h[0].AvatarUrl)
	})
}
