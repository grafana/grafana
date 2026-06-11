package idresolver

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
)

func TestBulkTeamClient(t *testing.T) {
	ns := claims.NamespaceInfo{}
	client := NewBulkTeamClient([]TeamRef{
		{UID: "team-five", ID: 5},
		{UID: "team-seven", ID: 7},
		{UID: "no-id", ID: 0}, // skipped
		{UID: "", ID: 9},      // skipped
	})

	uid, err := client.UIDByID(context.Background(), ns, 5)
	require.NoError(t, err)
	require.Equal(t, "team-five", uid)

	id, err := client.IDByUID(context.Background(), ns, "team-seven")
	require.NoError(t, err)
	require.Equal(t, int64(7), id)

	_, err = client.UIDByID(context.Background(), ns, 999)
	require.ErrorIs(t, err, ErrNotFound)

	_, err = client.IDByUID(context.Background(), ns, "no-id")
	require.ErrorIs(t, err, ErrNotFound)

	_, err = client.UIDByID(context.Background(), ns, 9)
	require.ErrorIs(t, err, ErrNotFound)
}

// TestBulkResolver verifies the bulk client composed into a Resolver resolves both
// directions and normalizes not-found.
func TestBulkResolver(t *testing.T) {
	ns := claims.NamespaceInfo{}
	r := NewResolver(nil, NewBulkTeamClient([]TeamRef{{UID: "team-five", ID: 5}}), nil)

	uid, err := r.IDToUID(context.Background(), ns, KindTeam, 5)
	require.NoError(t, err)
	require.Equal(t, "team-five", uid)

	id, err := r.UIDToID(context.Background(), ns, KindTeam, "team-five")
	require.NoError(t, err)
	require.Equal(t, int64(5), id)

	_, err = r.IDToUID(context.Background(), ns, KindTeam, 404)
	require.ErrorIs(t, err, ErrNotFound)
}
