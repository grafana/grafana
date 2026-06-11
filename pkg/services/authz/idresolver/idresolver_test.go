package idresolver

import (
	"context"
	"errors"
	"os"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	openfeaturetesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
)

// openfeature relies on global state; the provider is shared across tests and uses
// goroutine-local storage to keep per-test flag state isolated.
var ofProvider = openfeaturetesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(ofProvider); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

// withTeamsApiFlag sets the kubernetesTeamsApi flag for the duration of the test.
func withTeamsApiFlag(t *testing.T, enabled bool) {
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}
	ofProvider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesTeamsApi: {
			Key:            featuremgmt.FlagKubernetesTeamsApi,
			DefaultVariant: variant,
			Variants:       map[string]interface{}{"enabled": true, "disabled": false},
		},
	})
	t.Cleanup(ofProvider.Cleanup)
}

// fakeTeamClient is an app-platform (mode-5) team client backed by fixed maps.
type fakeTeamClient struct {
	byID  map[int64]string
	byUID map[string]int64
}

func (f *fakeTeamClient) UIDByID(_ context.Context, _ claims.NamespaceInfo, id int64) (string, error) {
	uid, ok := f.byID[id]
	if !ok {
		return "", ErrNotFound
	}
	return uid, nil
}

func (f *fakeTeamClient) IDByUID(_ context.Context, _ claims.NamespaceInfo, uid string) (int64, error) {
	id, ok := f.byUID[uid]
	if !ok {
		return 0, ErrNotFound
	}
	return id, nil
}

// fakeLegacyStore implements legacy.ScopeResolverStore for the SQL path.
type fakeLegacyStore struct {
	teamUIDByID map[int64]string
}

func (f *fakeLegacyStore) GetTeamUIDByID(_ context.Context, _ claims.NamespaceInfo, q legacy.GetTeamUIDByIDQuery) (*legacy.GetTeamUIDByIDResult, error) {
	uid, ok := f.teamUIDByID[q.ID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return &legacy.GetTeamUIDByIDResult{UID: uid}, nil
}

func (f *fakeLegacyStore) GetTeamInternalID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeLegacyStore) GetUserInternalID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeLegacyStore) GetServiceAccountInternalID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeLegacyStore) GetUserUIDByID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetUserUIDByIDQuery) (*legacy.GetUserUIDByIDResult, error) {
	return &legacy.GetUserUIDByIDResult{UID: "user-uid"}, nil
}
func (f *fakeLegacyStore) GetServiceAccountUIDByID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetUserUIDByIDQuery) (*legacy.GetUserUIDByIDResult, error) {
	return &legacy.GetUserUIDByIDResult{UID: "sa-uid"}, nil
}

func TestResolver_Teams_FlagSwitch(t *testing.T) {
	ns := claims.NamespaceInfo{}
	legacyStore := &fakeLegacyStore{teamUIDByID: map[int64]string{1: "legacy-team"}}
	client := &fakeTeamClient{byID: map[int64]string{1: "client-team"}, byUID: map[string]int64{"client-team": 1}}

	t.Run("flag off uses legacy", func(t *testing.T) {
		withTeamsApiFlag(t, false)
		r := NewResolver(legacyStore, client)
		uid, err := r.IDToUID(context.Background(), ns, KindTeam, 1)
		require.NoError(t, err)
		require.Equal(t, "legacy-team", uid)
	})

	t.Run("flag on uses client", func(t *testing.T) {
		withTeamsApiFlag(t, true)
		r := NewResolver(legacyStore, client)
		uid, err := r.IDToUID(context.Background(), ns, KindTeam, 1)
		require.NoError(t, err)
		require.Equal(t, "client-team", uid)
	})

	t.Run("no legacy store always uses client", func(t *testing.T) {
		r := NewResolver(nil, client)
		uid, err := r.IDToUID(context.Background(), ns, KindTeam, 1)
		require.NoError(t, err)
		require.Equal(t, "client-team", uid)
	})
}

func TestSingleResolver_NotFoundNormalized(t *testing.T) {
	ns := claims.NamespaceInfo{}

	t.Run("legacy sentinel becomes ErrNotFound", func(t *testing.T) {
		withTeamsApiFlag(t, false)
		r := NewResolver(&fakeLegacyStore{teamUIDByID: map[int64]string{}}, nil)
		_, err := r.IDToUID(context.Background(), ns, KindTeam, 42)
		require.ErrorIs(t, err, ErrNotFound)
	})

	t.Run("client ErrNotFound is propagated", func(t *testing.T) {
		r := NewResolver(nil, &fakeTeamClient{byID: map[int64]string{}, byUID: map[string]int64{}})
		_, err := r.IDToUID(context.Background(), ns, KindTeam, 42)
		require.ErrorIs(t, err, ErrNotFound)
	})
}

func TestSingleResolver_UsersAndServiceAccountsUseLegacy(t *testing.T) {
	ns := claims.NamespaceInfo{}
	// Client present + flag on must NOT affect users/service accounts.
	withTeamsApiFlag(t, true)
	r := NewResolver(&fakeLegacyStore{}, &fakeTeamClient{})

	uid, err := r.IDToUID(context.Background(), ns, KindUser, 1)
	require.NoError(t, err)
	require.Equal(t, "user-uid", uid)

	uid, err = r.IDToUID(context.Background(), ns, KindServiceAccount, 1)
	require.NoError(t, err)
	require.Equal(t, "sa-uid", uid)
}

func TestSingleResolver_NoStoreConfigured(t *testing.T) {
	ns := claims.NamespaceInfo{}
	r := NewResolver(nil, nil)
	_, err := r.IDToUID(context.Background(), ns, KindTeam, 1)
	require.Error(t, err)
	require.NotErrorIs(t, err, ErrNotFound)
}
