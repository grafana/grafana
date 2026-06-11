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

// TestResolver_BulkMethods verifies the bulk lookups return only resolved entries and
// omit (rather than error on) ids/uids with no matching identity.
func TestResolver_BulkMethods(t *testing.T) {
	ns := claims.NamespaceInfo{}
	r := NewResolver(nil, NewBulkTeamClient([]TeamRef{
		{UID: "team-five", ID: 5},
		{UID: "team-seven", ID: 7},
	}), nil)

	t.Run("IDsToUIDs returns resolved subset", func(t *testing.T) {
		got, err := r.IDsToUIDs(context.Background(), ns, KindTeam, []int64{5, 7, 999, 5})
		require.NoError(t, err)
		require.Equal(t, map[int64]string{5: "team-five", 7: "team-seven"}, got)
	})

	t.Run("UIDsToIDs returns resolved subset", func(t *testing.T) {
		got, err := r.UIDsToIDs(context.Background(), ns, KindTeam, []string{"team-five", "missing"})
		require.NoError(t, err)
		require.Equal(t, map[string]int64{"team-five": 5}, got)
	})

	t.Run("empty input", func(t *testing.T) {
		got, err := r.IDsToUIDs(context.Background(), ns, KindTeam, nil)
		require.NoError(t, err)
		require.Empty(t, got)
	})
}
