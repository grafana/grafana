package collections

import (
	"context"
	"strings"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

// fakeAccessControl grants exactly the actions it was given.
type fakeAccessControl struct {
	accesscontrol.AccessControl
	granted map[string]bool
}

func (f *fakeAccessControl) Evaluate(_ context.Context, _ identity.Requester, e accesscontrol.Evaluator) (bool, error) {
	for action, ok := range f.granted {
		if ok && strings.Contains(e.String(), action) {
			return true, nil
		}
	}
	return false, nil
}

func TestSlideshowAuthorization(t *testing.T) {
	viewer := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1, UserID: 1, OrgRole: identity.RoleViewer, Type: "user",
	})

	// The flag provider keys flags by running test, so it is set inside each subtest.
	authz := func(t *testing.T, granted ...string) authorizer.Authorizer {
		flagProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagPlaylistsRBAC: setting.NewInMemoryFlag(featuremgmt.FlagPlaylistsRBAC, true),
		})
		g := map[string]bool{}
		for _, a := range granted {
			g[a] = true
		}
		return newAuthorizer(&fakeAccessControl{granted: g}, log.NewNopLogger())
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
			got, _, err := authz(t, tt.granted...).Authorize(viewer, &fakeAttributes{resource: "slideshows", verb: tt.verb, name: "wall"})
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}

	t.Run("stars keep their per-user rules regardless of playlist permissions", func(t *testing.T) {
		a := authz(t, playlist.ActionPlaylistsRead, playlist.ActionPlaylistsWrite)

		// Another user's stars: playlist permissions must not open them up.
		got, _, err := a.Authorize(viewer, &fakeAttributes{resource: "stars", verb: "get", name: "user-someone-else"})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, got)
	})
}
