package collections

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
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

func attrs(resource, verb, name string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "collections.grafana.app",
		Namespace:       "default",
		Resource:        resource,
		Verb:            verb,
		Name:            name,
	}
}

// fakeChecker answers every check the same way and records the requests it saw.
type fakeChecker struct {
	allowed  bool
	err      error
	requests []authlib.CheckRequest
}

func (f *fakeChecker) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	f.requests = append(f.requests, req)
	return authlib.CheckResponse{Allowed: f.allowed}, f.err
}

func userCtx(role identity.RoleType, identityType authlib.IdentityType) context.Context {
	return identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1, UserID: 1, OrgRole: role, Type: identityType,
	})
}

func withRBAC(t *testing.T, on bool) {
	t.Helper()
	withFlags(t, on, true)
}

func withFlags(t *testing.T, rbac, slideshows bool) {
	t.Helper()
	// The flag provider keys flags by running test, so it is set inside each test.
	flagProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagPlaylistsRBAC:      setting.NewInMemoryFlag(featuremgmt.FlagPlaylistsRBAC, rbac),
		featuremgmt.FlagPlaylistSlideshows: setting.NewInMemoryFlag(featuremgmt.FlagPlaylistSlideshows, slideshows),
	})
}

func slideshowAttrs(verb string) authorizer.Attributes {
	return attrs("slideshows", verb, "wall")
}

func TestSlideshowAuthorizationWithPlaylistsRBAC(t *testing.T) {
	verbs := []string{"get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"}

	for _, verb := range verbs {
		t.Run("asks the access client about "+verb, func(t *testing.T) {
			withRBAC(t, true)
			checker := &fakeChecker{allowed: true}
			got, _, err := newAuthorizer(checker, log.NewNopLogger()).
				Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), slideshowAttrs(verb))

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, got)
			require.Equal(t, []authlib.CheckRequest{{
				Verb: verb, Group: "collections.grafana.app", Resource: "slideshows", Namespace: "default",
			}}, checker.requests)
		})
	}

	t.Run("denies what the access client denies, whatever the role", func(t *testing.T) {
		withRBAC(t, true)
		for _, role := range []identity.RoleType{identity.RoleNone, identity.RoleViewer, identity.RoleEditor, identity.RoleAdmin} {
			got, reason, err := newAuthorizer(&fakeChecker{allowed: false}, log.NewNopLogger()).
				Authorize(userCtx(role, authlib.TypeUser), slideshowAttrs("create"))

			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, got, role)
			require.Equal(t, "insufficient permissions", reason)
		}
	})

	t.Run("applies to service accounts as well", func(t *testing.T) {
		withRBAC(t, true)
		checker := &fakeChecker{allowed: true}
		got, _, err := newAuthorizer(checker, log.NewNopLogger()).
			Authorize(userCtx(identity.RoleViewer, authlib.TypeServiceAccount), slideshowAttrs("get"))

		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, got)
		require.Len(t, checker.requests, 1)
	})

	t.Run("denies when the access client fails", func(t *testing.T) {
		withRBAC(t, true)
		got, _, err := newAuthorizer(&fakeChecker{err: errors.New("boom")}, log.NewNopLogger()).
			Authorize(userCtx(identity.RoleAdmin, authlib.TypeUser), slideshowAttrs("get"))

		require.Error(t, err)
		require.Equal(t, authorizer.DecisionDeny, got)
	})

	t.Run("denies an unsupported verb without asking", func(t *testing.T) {
		withRBAC(t, true)
		checker := &fakeChecker{allowed: true}
		got, _, err := newAuthorizer(checker, log.NewNopLogger()).
			Authorize(userCtx(identity.RoleAdmin, authlib.TypeUser), slideshowAttrs("proxy"))

		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, got)
		require.Empty(t, checker.requests)
	})
}

func TestSlideshowAuthorizationWithoutPlaylistsRBAC(t *testing.T) {
	t.Run("a user with no role can read but not write, without asking the access client", func(t *testing.T) {
		withRBAC(t, false)
		checker := &fakeChecker{allowed: false}
		a := newAuthorizer(checker, log.NewNopLogger())

		got, _, err := a.Authorize(userCtx(identity.RoleNone, authlib.TypeUser), slideshowAttrs("get"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, got)

		got, _, err = a.Authorize(userCtx(identity.RoleNone, authlib.TypeUser), slideshowAttrs("create"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionNoOpinion, got)
		require.Empty(t, checker.requests)
	})

	t.Run("other roles follow the org role rules", func(t *testing.T) {
		withRBAC(t, false)
		a := newAuthorizer(&fakeChecker{allowed: false}, log.NewNopLogger())

		viewerRead, _, err := a.Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), slideshowAttrs("get"))
		require.NoError(t, err)
		viewerWrite, _, err := a.Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), slideshowAttrs("create"))
		require.NoError(t, err)
		editorWrite, _, err := a.Authorize(userCtx(identity.RoleEditor, authlib.TypeUser), slideshowAttrs("create"))
		require.NoError(t, err)

		require.Equal(t, authorizer.DecisionAllow, viewerRead)
		require.NotEqual(t, authorizer.DecisionAllow, viewerWrite, "a viewer must not write")
		require.Equal(t, authorizer.DecisionAllow, editorWrite)
	})
}

func TestStarsKeepTheirPerUserRules(t *testing.T) {
	withRBAC(t, true)
	checker := &fakeChecker{allowed: true}

	// Another user's stars: slideshow permissions must not open them up.
	got, _, err := newAuthorizer(checker, log.NewNopLogger()).
		Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), attrs("stars", "get", "user-someone-else"))

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, got)
	require.Empty(t, checker.requests)
}

type fakeAccessClient struct {
	fakeChecker
	authlib.AccessClient
}

func (f *fakeAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return f.fakeChecker.Check(ctx, info, req, folder)
}

func TestAccessClientIsHandedOverAfterConstruction(t *testing.T) {
	withRBAC(t, true)
	b := RegisterAPIService(&setting.Cfg{}, nil, nil, nil, nil, noopRegistrar{})
	ctx := userCtx(identity.RoleAdmin, authlib.TypeUser)

	// Until the apiserver provides the client, nothing is allowed.
	got, _, err := b.GetAuthorizer().Authorize(ctx, slideshowAttrs("get"))
	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, got)

	client := &fakeAccessClient{fakeChecker: fakeChecker{allowed: true}}
	b.SetAccessClient(client)

	got, _, err = b.GetAuthorizer().Authorize(ctx, slideshowAttrs("get"))
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, got)
	require.Len(t, client.requests, 1)
}

type noopRegistrar struct{}

func (noopRegistrar) RegisterAPI(builder.APIGroupBuilder) {}

func (noopRegistrar) RegisterAppInstaller(appsdkapiserver.AppInstaller) {}

func TestAccessClientNilIsIgnored(t *testing.T) {
	withRBAC(t, true)
	b := RegisterAPIService(&setting.Cfg{}, nil, nil, nil, nil, noopRegistrar{})

	// Handing over a nil client must not turn a later check into a panic.
	b.SetAccessClient(nil)

	got, _, err := b.GetAuthorizer().Authorize(userCtx(identity.RoleAdmin, authlib.TypeUser), slideshowAttrs("get"))
	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, got)
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

// The same holds when the provider cannot answer at all and every flag falls back to its default.
func TestSlideshowAuthorizationWhenTheFlagProviderIsUnavailable(t *testing.T) {
	flagProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{})
	checker := &fakeChecker{allowed: false}

	for _, verb := range []string{"create", "patch", "delete", "deletecollection"} {
		got, _, err := newAuthorizer(checker, log.NewNopLogger()).
			Authorize(userCtx(identity.RoleViewer, authlib.TypeAnonymous), slideshowAttrs(verb))

		require.NoError(t, err)
		require.NotEqual(t, authorizer.DecisionAllow, got, verb)
	}
}

func TestStarsAreAuthorizedTheSameWhenSlideshowsAreOff(t *testing.T) {
	withFlags(t, true, false)

	got, _, err := newAuthorizer(&fakeChecker{allowed: true}, log.NewNopLogger()).
		Authorize(userCtx(identity.RoleViewer, authlib.TypeUser), attrs("stars", "get", "user-someone-else"))

	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, got)
}
