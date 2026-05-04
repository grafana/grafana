package legacy

import (
	"context"
	"errors"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

// fakeScopeResolverStore is an in-memory ScopeResolverStore for unit tests.
// Missing keys return the corresponding domain "not found" error so the
// resolver helpers exercise the orphan branch (drop-with-warning).
// The *Fails maps let a test inject a non-not-found error for a specific key
// to exercise the propagated-error branch.
type fakeScopeResolverStore struct {
	// uid -> id
	usersByUID    map[string]int64
	teamsByUID    map[string]int64
	saByUID       map[string]int64
	usersUIDFails map[string]error
	teamsUIDFails map[string]error
	saUIDFails    map[string]error

	// id -> uid
	usersByID    map[int64]string
	teamsByID    map[int64]string
	saByID       map[int64]string
	usersIDFails map[int64]error
	teamsIDFails map[int64]error
	saIDFails    map[int64]error
}

func newFakeStore() *fakeScopeResolverStore {
	return &fakeScopeResolverStore{
		usersByUID:    map[string]int64{},
		teamsByUID:    map[string]int64{},
		saByUID:       map[string]int64{},
		usersUIDFails: map[string]error{},
		teamsUIDFails: map[string]error{},
		saUIDFails:    map[string]error{},
		usersByID:     map[int64]string{},
		teamsByID:     map[int64]string{},
		saByID:        map[int64]string{},
		usersIDFails:  map[int64]error{},
		teamsIDFails:  map[int64]error{},
		saIDFails:     map[int64]error{},
	}
}

func (f *fakeScopeResolverStore) GetUserInternalID(_ context.Context, _ claims.NamespaceInfo, q GetUserInternalIDQuery) (*GetUserInternalIDResult, error) {
	if err, ok := f.usersUIDFails[q.UID]; ok {
		return nil, err
	}
	id, ok := f.usersByUID[q.UID]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return &GetUserInternalIDResult{ID: id}, nil
}

func (f *fakeScopeResolverStore) GetTeamInternalID(_ context.Context, _ claims.NamespaceInfo, q GetTeamInternalIDQuery) (*GetTeamInternalIDResult, error) {
	if err, ok := f.teamsUIDFails[q.UID]; ok {
		return nil, err
	}
	id, ok := f.teamsByUID[q.UID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return &GetTeamInternalIDResult{ID: id}, nil
}

func (f *fakeScopeResolverStore) GetServiceAccountInternalID(_ context.Context, _ claims.NamespaceInfo, q GetServiceAccountInternalIDQuery) (*GetServiceAccountInternalIDResult, error) {
	if err, ok := f.saUIDFails[q.UID]; ok {
		return nil, err
	}
	id, ok := f.saByUID[q.UID]
	if !ok {
		return nil, serviceaccounts.ErrServiceAccountNotFound
	}
	return &GetServiceAccountInternalIDResult{ID: id}, nil
}

func (f *fakeScopeResolverStore) GetUserUIDByID(_ context.Context, _ claims.NamespaceInfo, q GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error) {
	if err, ok := f.usersIDFails[q.ID]; ok {
		return nil, err
	}
	uid, ok := f.usersByID[q.ID]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return &GetUserUIDByIDResult{UID: uid}, nil
}

func (f *fakeScopeResolverStore) GetTeamUIDByID(_ context.Context, _ claims.NamespaceInfo, q GetTeamUIDByIDQuery) (*GetTeamUIDByIDResult, error) {
	if err, ok := f.teamsIDFails[q.ID]; ok {
		return nil, err
	}
	uid, ok := f.teamsByID[q.ID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return &GetTeamUIDByIDResult{UID: uid}, nil
}

// GetServiceAccountUIDByID matches the interface signature: id-based lookup
// reuses GetUserUIDByIDQuery/Result. SA "not found" returns user.ErrUserNotFound
// because the legacy SQL impl shares the user-table query for both subjects.
func (f *fakeScopeResolverStore) GetServiceAccountUIDByID(_ context.Context, _ claims.NamespaceInfo, q GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error) {
	if err, ok := f.saIDFails[q.ID]; ok {
		return nil, err
	}
	uid, ok := f.saByID[q.ID]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return &GetUserUIDByIDResult{UID: uid}, nil
}

// --- IsNotFoundError ---

func TestIsNotFoundError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "user not found", err: user.ErrUserNotFound, want: true},
		{name: "team not found", err: team.ErrTeamNotFound, want: true},
		{name: "service account not found", err: serviceaccounts.ErrServiceAccountNotFound, want: true},
		{name: "wrapped user not found", err: errors.New("ctx: " + user.ErrUserNotFound.Error()), want: false}, // not wrapped via fmt.Errorf %w
		{name: "nil", err: nil, want: false},
		{name: "unrelated error", err: errors.New("boom"), want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsNotFoundError(tt.err))
		})
	}
}

// --- ResolveUIDScopeForWrite ---

func TestResolveUIDScopeForWrite(t *testing.T) {
	store := newFakeStore()
	store.usersByUID["alice"] = 1
	store.teamsByUID["devs"] = 10
	store.saByUID["robot"] = 100
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}

	tests := []struct {
		name      string
		scope     string
		want      string
		wantErrIs error
	}{
		{name: "user uid resolves to id", scope: "users:uid:alice", want: "users:id:1"},
		{name: "team uid resolves to id", scope: "teams:uid:devs", want: "teams:id:10"},
		{name: "service account uid resolves to id", scope: "serviceaccounts:uid:robot", want: "serviceaccounts:id:100"},
		{name: "user wildcard rewrites without lookup", scope: "users:uid:*", want: "users:id:*"},
		{name: "team wildcard rewrites without lookup", scope: "teams:uid:*", want: "teams:id:*"},
		{name: "service account wildcard rewrites without lookup", scope: "serviceaccounts:uid:*", want: "serviceaccounts:id:*"},
		{name: "unknown prefix returns scope unchanged", scope: "folders:uid:abc", want: "folders:uid:abc"},
		{name: "id-scoped scope returns unchanged", scope: "users:id:1", want: "users:id:1"},
		{name: "missing user surfaces not found", scope: "users:uid:ghost", wantErrIs: user.ErrUserNotFound},
		{name: "missing team surfaces not found", scope: "teams:uid:ghost", wantErrIs: team.ErrTeamNotFound},
		{name: "missing service account surfaces not found", scope: "serviceaccounts:uid:ghost", wantErrIs: serviceaccounts.ErrServiceAccountNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveUIDScopeForWrite(context.Background(), store, ns, tt.scope)
			if tt.wantErrIs != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErrIs)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

// --- ResolveUIDScopesForWrite ---

func TestResolveUIDScopesForWrite(t *testing.T) {
	store := newFakeStore()
	store.usersByUID["alice"] = 1
	store.saByUID["robot"] = 100
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}

	t.Run("translates uid scopes and preserves the rest", func(t *testing.T) {
		input := []accesscontrol.Permission{
			{Action: "folders:read", Scope: "folders:uid:abc"},
			{Action: "users:write", Scope: "users:uid:alice"},
			{Action: "serviceaccounts:write", Scope: "serviceaccounts:uid:robot"},
		}
		got, err := ResolveUIDScopesForWrite(context.Background(), store, ns, input)
		require.NoError(t, err)
		require.Len(t, got, 3)

		// folders entry passes through unchanged
		assert.Equal(t, "folders:uid:abc", got[0].Scope)

		// users uid translated to id and Kind/Attribute/Identifier reflect the new scope
		assert.Equal(t, "users:id:1", got[1].Scope)
		assert.Equal(t, "users", got[1].Kind)
		assert.Equal(t, "id", got[1].Attribute)
		assert.Equal(t, "1", got[1].Identifier)

		// service account uid translated to id
		assert.Equal(t, "serviceaccounts:id:100", got[2].Scope)
		assert.Equal(t, "serviceaccounts", got[2].Kind)
		assert.Equal(t, "id", got[2].Attribute)
		assert.Equal(t, "100", got[2].Identifier)
	})

	t.Run("input slice is not mutated", func(t *testing.T) {
		input := []accesscontrol.Permission{{Action: "users:write", Scope: "users:uid:alice"}}
		_, err := ResolveUIDScopesForWrite(context.Background(), store, ns, input)
		require.NoError(t, err)
		assert.Equal(t, "users:uid:alice", input[0].Scope, "input must not be mutated")
	})

	t.Run("missing entity errors out", func(t *testing.T) {
		input := []accesscontrol.Permission{{Action: "users:write", Scope: "users:uid:ghost"}}
		_, err := ResolveUIDScopesForWrite(context.Background(), store, ns, input)
		require.Error(t, err)
		assert.ErrorIs(t, err, user.ErrUserNotFound)
	})
}

// --- ResolveUIDScopesForRead ---

func TestResolveUIDScopesForRead(t *testing.T) {
	store := newFakeStore()
	store.usersByUID["alice"] = 1
	store.saByUID["robot"] = 100
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}
	logger := log.NewNopLogger()

	t.Run("orphan permissions are omitted with a warning", func(t *testing.T) {
		input := []accesscontrol.Permission{
			{Action: "users:read", Scope: "users:uid:alice"},
			{Action: "users:read", Scope: "users:uid:ghost"},                     // dropped
			{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:robot"}, // kept
			{Action: "serviceaccounts:read", Scope: "serviceaccounts:uid:ghost"}, // dropped
			{Action: "folders:read", Scope: "folders:uid:abc"},                   // unchanged
		}
		got, err := ResolveUIDScopesForRead(context.Background(), store, ns, input, logger)
		require.NoError(t, err)
		require.Len(t, got, 3)
		assert.Equal(t, "users:id:1", got[0].Scope)
		assert.Equal(t, "serviceaccounts:id:100", got[1].Scope)
		assert.Equal(t, "folders:uid:abc", got[2].Scope)
	})

	t.Run("non-not-found errors propagate", func(t *testing.T) {
		store.usersUIDFails["broken"] = errors.New("db boom")
		input := []accesscontrol.Permission{{Action: "users:read", Scope: "users:uid:broken"}}
		_, err := ResolveUIDScopesForRead(context.Background(), store, ns, input, logger)
		require.Error(t, err)
		assert.NotErrorIs(t, err, user.ErrUserNotFound)
	})
}

// --- ResolveIDScopeToUIDName ---

func TestResolveIDScopeToUIDName(t *testing.T) {
	store := newFakeStore()
	store.usersByID[1] = "alice"
	store.teamsByID[10] = "devs"
	store.saByID[100] = "robot"
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}

	tests := []struct {
		name      string
		scope     string
		want      string
		wantErrIs error
		wantErr   bool
	}{
		{name: "user id resolves to uid name", scope: "users:id:1", want: "alice"},
		{name: "team id resolves to uid name", scope: "teams:id:10", want: "devs"},
		{name: "service account id resolves to uid name", scope: "serviceaccounts:id:100", want: "robot"},
		{name: "missing user errors", scope: "users:id:404", wantErrIs: user.ErrUserNotFound},
		{name: "missing team errors", scope: "teams:id:404", wantErrIs: team.ErrTeamNotFound},
		{name: "missing service account errors with user.ErrUserNotFound", scope: "serviceaccounts:id:404", wantErrIs: user.ErrUserNotFound},
		{name: "invalid scope shape", scope: "teams:id", wantErr: true},
		{name: "non-numeric id", scope: "users:id:not-a-number", wantErr: true},
		{name: "unknown id-scoped resource", scope: "things:id:1", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveIDScopeToUIDName(context.Background(), store, ns, tt.scope)
			switch {
			case tt.wantErrIs != nil:
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErrIs)
			case tt.wantErr:
				require.Error(t, err)
			default:
				require.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

// --- ResolveIDScopeToUID ---

func TestResolveIDScopeToUID(t *testing.T) {
	store := newFakeStore()
	store.usersByID[1] = "alice"
	store.teamsByID[10] = "devs"
	store.saByID[100] = "robot"
	store.usersIDFails[500] = errors.New("db boom")
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}
	logger := log.NewNopLogger()

	tests := []struct {
		name     string
		scope    string
		want     string
		wantDrop bool
		wantErr  bool
	}{
		{name: "user id resolves", scope: "users:id:1", want: "users:uid:alice"},
		{name: "team id resolves", scope: "teams:id:10", want: "teams:uid:devs"},
		{name: "service account id resolves", scope: "serviceaccounts:id:100", want: "serviceaccounts:uid:robot"},
		{name: "user wildcard rewrites without lookup", scope: "users:id:*", want: "users:uid:*"},
		{name: "team wildcard rewrites without lookup", scope: "teams:id:*", want: "teams:uid:*"},
		{name: "service account wildcard rewrites without lookup", scope: "serviceaccounts:id:*", want: "serviceaccounts:uid:*"},
		{name: "unknown prefix returns scope unchanged", scope: "folders:uid:abc", want: "folders:uid:abc"},
		{name: "non-numeric id returns scope unchanged", scope: "users:id:bogus", want: "users:id:bogus"},
		{name: "orphaned user is dropped", scope: "users:id:404", wantDrop: true},
		{name: "orphaned team is dropped", scope: "teams:id:404", wantDrop: true},
		{name: "orphaned service account is dropped", scope: "serviceaccounts:id:404", wantDrop: true},
		{name: "non-not-found error propagates", scope: "users:id:500", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, drop, err := ResolveIDScopeToUID(context.Background(), store, ns, tt.scope, logger)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if tt.wantDrop {
				assert.True(t, drop)
				return
			}
			assert.False(t, drop)
			assert.Equal(t, tt.want, got)
		})
	}
}

// --- ResolveIDScopesToUID / ResolveIDScopesToUIDStrict ---

func TestResolveIDScopesToUID_DropsOrphans(t *testing.T) {
	store := newFakeStore()
	store.usersByID[1] = "alice"
	store.saByID[100] = "robot"
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}
	logger := log.NewNopLogger()

	input := []accesscontrol.Permission{
		{Action: "users:read", Scope: "users:id:1"},
		{Action: "users:read", Scope: "users:id:404"},                     // orphan, dropped
		{Action: "serviceaccounts:read", Scope: "serviceaccounts:id:100"}, // kept
		{Action: "serviceaccounts:read", Scope: "serviceaccounts:id:404"}, // orphan, dropped
		{Action: "folders:read", Scope: "folders:uid:abc"},                // unchanged
	}
	got, err := ResolveIDScopesToUID(context.Background(), store, ns, input, logger)
	require.NoError(t, err)
	require.Len(t, got, 3)

	assert.Equal(t, "users:uid:alice", got[0].Scope)
	assert.Equal(t, "users", got[0].Kind)
	assert.Equal(t, "uid", got[0].Attribute)
	assert.Equal(t, "alice", got[0].Identifier)

	assert.Equal(t, "serviceaccounts:uid:robot", got[1].Scope)
	assert.Equal(t, "serviceaccounts", got[1].Kind)
	assert.Equal(t, "uid", got[1].Attribute)
	assert.Equal(t, "robot", got[1].Identifier)

	assert.Equal(t, "folders:uid:abc", got[2].Scope)
}

func TestResolveIDScopesToUIDStrict_RejectsOrphans(t *testing.T) {
	store := newFakeStore()
	store.usersByID[1] = "alice"
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}
	logger := log.NewNopLogger()

	t.Run("happy path passes through", func(t *testing.T) {
		input := []accesscontrol.Permission{{Action: "users:write", Scope: "users:id:1"}}
		got, err := ResolveIDScopesToUIDStrict(context.Background(), store, ns, input, logger)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, "users:uid:alice", got[0].Scope)
	})

	t.Run("orphan errors out instead of dropping", func(t *testing.T) {
		input := []accesscontrol.Permission{{Action: "users:write", Scope: "users:id:404"}}
		_, err := ResolveIDScopesToUIDStrict(context.Background(), store, ns, input, logger)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "users:id:404")
	})
}
