package idresolver

import (
	"context"
	"errors"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
)

type fakeTeamLister struct {
	teams []TeamRef
	err   error
}

func (f fakeTeamLister) ListTeams(_ context.Context, _ claims.NamespaceInfo) ([]TeamRef, error) {
	return f.teams, f.err
}

func TestBulkResolver(t *testing.T) {
	ns := claims.NamespaceInfo{}
	r, err := NewBulkResolver(context.Background(), ns, fakeTeamLister{teams: []TeamRef{
		{UID: "team-five", ID: 5},
		{UID: "team-seven", ID: 7},
		{UID: "no-id", ID: 0}, // skipped
		{UID: "", ID: 9},      // skipped
	}})
	require.NoError(t, err)

	uid, err := r.IDToUID(context.Background(), ns, KindTeam, 5)
	require.NoError(t, err)
	require.Equal(t, "team-five", uid)

	id, err := r.UIDToID(context.Background(), ns, KindTeam, "team-seven")
	require.NoError(t, err)
	require.Equal(t, int64(7), id)

	_, err = r.IDToUID(context.Background(), ns, KindTeam, 999)
	require.ErrorIs(t, err, ErrNotFound)

	_, err = r.UIDToID(context.Background(), ns, KindTeam, "no-id")
	require.ErrorIs(t, err, ErrNotFound)

	_, err = r.IDToUID(context.Background(), ns, KindTeam, 9)
	require.ErrorIs(t, err, ErrNotFound)
}

func TestBulkResolver_OnlyTeams(t *testing.T) {
	ns := claims.NamespaceInfo{}
	r, err := NewBulkResolver(context.Background(), ns, fakeTeamLister{teams: []TeamRef{{UID: "t", ID: 1}}})
	require.NoError(t, err)

	_, err = r.IDToUID(context.Background(), ns, KindUser, 1)
	require.Error(t, err)
	require.NotErrorIs(t, err, ErrNotFound)
}

func TestBulkResolver_ListError(t *testing.T) {
	_, err := NewBulkResolver(context.Background(), claims.NamespaceInfo{}, fakeTeamLister{err: errors.New("boom")})
	require.Error(t, err)
}
