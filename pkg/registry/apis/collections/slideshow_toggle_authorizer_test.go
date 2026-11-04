package collections

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func withFlags(t *testing.T, rbac, slideshows bool) {
	t.Helper()
	flagProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagPlaylistsRBAC:      setting.NewInMemoryFlag(featuremgmt.FlagPlaylistsRBAC, rbac),
		featuremgmt.FlagPlaylistSlideshows: setting.NewInMemoryFlag(featuremgmt.FlagPlaylistSlideshows, slideshows),
	})
}

// The authorizer never reads the toggle: only the install decides whether the kind is served, so a
// toggle that reads off later (the provider changed it, failed, or targets another namespace) must
// not open anything. Whatever the flags say, callers without write access are never allowed to write.
func TestSlideshowAuthorizationIgnoresTheToggle(t *testing.T) {
	writes := []string{"create", "update", "patch", "delete", "deletecollection"}
	callers := map[string]context.Context{
		"viewer":                 userCtx(identity.RoleViewer, authlib.TypeUser),
		"no role":                userCtx(identity.RoleNone, authlib.TypeUser),
		"none service account":   userCtx(identity.RoleNone, authlib.TypeServiceAccount),
		"viewer service account": userCtx(identity.RoleViewer, authlib.TypeServiceAccount),
		"anonymous":              userCtx(identity.RoleViewer, authlib.TypeAnonymous),
	}

	for _, rbac := range []bool{true, false} {
		for _, slideshows := range []bool{true, false} {
			for who, ctx := range callers {
				for _, verb := range writes {
					withFlags(t, rbac, slideshows)
					// The access client denies, as it does for anyone without playlists:write.
					checker := &fakeChecker{allowed: false}

					got, _, err := newAuthorizer(checker, log.NewNopLogger()).Authorize(ctx, slideshowAttrs(verb))

					require.NoError(t, err)
					require.NotEqual(t, authorizer.DecisionAllow, got, "%s %s rbac=%v toggle=%v", who, verb, rbac, slideshows)
				}
			}
		}
	}
}

func TestStarsAreAuthorizedTheSameWhenSlideshowsAreOff(t *testing.T) {
	withFlags(t, true, false)

	got, _, err := newAuthorizer(&fakeChecker{allowed: true}, log.NewNopLogger()).
		Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), attrs("stars", "get", "user-someone-else"))

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, got)
}
