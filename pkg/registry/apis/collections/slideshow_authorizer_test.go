package collections

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var flagProvider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(flagProvider); err != nil {
		panic(err)
	}
	m.Run()
}

type fakeAttributes struct {
	authorizer.Attributes
	resource string
	verb     string
	name     string
}

func (f *fakeAttributes) IsResourceRequest() bool { return true }
func (f *fakeAttributes) GetResource() string     { return f.resource }
func (f *fakeAttributes) GetVerb() string         { return f.verb }
func (f *fakeAttributes) GetName() string         { return f.name }
func (f *fakeAttributes) GetAPIGroup() string     { return "collections.grafana.app" }
func (f *fakeAttributes) IsReadOnly() bool {
	return f.verb == "get" || f.verb == "list" || f.verb == "watch"
}

func TestSlideshowAuthorization(t *testing.T) {
	// A user holding exactly the given actions in org 1.
	userWith := func(actions ...string) context.Context {
		perms := map[string][]string{}
		for _, a := range actions {
			perms[a] = []string{""}
		}
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID: 1, UserID: 1, OrgRole: identity.RoleViewer, Type: "user",
			Permissions: map[int64]map[string][]string{1: perms},
		})
	}

	// The flag provider keys flags by running test, so it is set inside each subtest.
	authz := func(t *testing.T) authorizer.Authorizer {
		flagProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagPlaylistsRBAC: setting.NewInMemoryFlag(featuremgmt.FlagPlaylistsRBAC, true),
		})
		return newAuthorizer(log.NewNopLogger())
	}
	tests := []struct {
		name    string
		granted []string
		verb    string
		want    authorizer.Decision
	}{
		{"reader can get", []string{playlist.ActionPlaylistsRead}, "get", authorizer.DecisionAllow},
		{"reader can list", []string{playlist.ActionPlaylistsRead}, "list", authorizer.DecisionAllow},
		{"reader cannot create", []string{playlist.ActionPlaylistsRead}, "create", authorizer.DecisionDeny},
		{"reader cannot delete", []string{playlist.ActionPlaylistsRead}, "delete", authorizer.DecisionDeny},
		{"writer can create", []string{playlist.ActionPlaylistsWrite}, "create", authorizer.DecisionAllow},
		{"writer can delete", []string{playlist.ActionPlaylistsWrite}, "delete", authorizer.DecisionAllow},
		{"no permissions cannot get", nil, "get", authorizer.DecisionDeny},
		{"no permissions cannot create", nil, "create", authorizer.DecisionDeny},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _, err := authz(t).Authorize(userWith(tt.granted...), &fakeAttributes{resource: "slideshows", verb: tt.verb, name: "wall"})
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}

	t.Run("stars keep their per-user rules regardless of playlist permissions", func(t *testing.T) {
		a := authz(t)
		viewer := userWith(playlist.ActionPlaylistsRead, playlist.ActionPlaylistsWrite)

		// Another user's stars: playlist permissions must not open them up.
		got, _, err := a.Authorize(viewer, &fakeAttributes{resource: "stars", verb: "get", name: "user-someone-else"})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, got)
	})
}
